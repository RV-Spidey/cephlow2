import { generateCertificatePDF } from '../lib/pdfGenerator.js';
import { ensureTemplateInCache } from '../lib/pdfExtractor.js';
import { supabaseAdmin, type Task, type Certificate } from '@workspace/supabase';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { isR2Configured, uploadPdfToR2, getR2PublicUrl } from '../lib/cloudflareR2.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_OUTPUT_DIR = path.join(__dirname, '..', '..', 'local_output');

async function processTask(task: Task) {
  try {
    const payload = task.payload || {};
    const batchId = task.batchId || String(payload.batchId || payload.batch_id || "");
    const certificateId = task.certificateId || String(payload.certificateId || payload.certificate_id || "");
    const recipientName = String(payload.recipientName || payload.recipient_name || 'Unknown');
    const recipientEmail = String(payload.recipientEmail || payload.recipient_email || '');
    const replacements = (payload.replacements || {}) as Record<string, string>;
    const qrCodeUrl = payload.qrCodeUrl || payload.qr_code_url ? String(payload.qrCodeUrl || payload.qr_code_url) : undefined;
    const slideIndex = payload.slideIndex !== undefined ? Number(payload.slideIndex) : payload.slide_index !== undefined ? Number(payload.slide_index) : 0;
    const requestStartTime = payload.requestStartTime ? Number(payload.requestStartTime) : payload.request_start_time ? Number(payload.request_start_time) : 0;

    const start = Date.now();

    if (!certificateId) throw new Error("Missing certificate_id in task");

    // Update status to generating
    await supabaseAdmin.from('certificates').update({
        status: 'generating',
        error_message: null
    }).eq('id', certificateId);

    const userId = String(payload.userId || payload.user_id || "");
    const templateId = String(payload.templateId || payload.template_id || "");

    if (!userId || !templateId) throw new Error("Missing userId or templateId in task payload");

    // 0. Ensure template is in this worker thread's in-memory cache
    await ensureTemplateInCache(userId, templateId);

    // 1. Generate the PDF bytes
    const pdfBytesUint8 = await generateCertificatePDF(
      batchId,
      certificateId,
      recipientName,
      replacements,
      qrCodeUrl,
      slideIndex || 0
    );
    const pdfBytes = Buffer.from(pdfBytesUint8);

    const fileName = `${recipientName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${certificateId.substring(0, 8)}.pdf`;
    
    // 2. Upload to Cloudflare R2
    let r2Url = null;
    if (isR2Configured()) {
        try {
            const uploadStart = Date.now();
            const phone = payload.recipientPhone || payload.recipient_phone;
            const folderName = phone ? String(phone) : batchId;
            const r2Key = await uploadPdfToR2(folderName, fileName, pdfBytes);
            r2Url = getR2PublicUrl(r2Key);
            const uploadDuration = Date.now() - uploadStart;
            console.log(`[R2] ☁️ Uploaded/Overwrote: ${fileName} (${uploadDuration}ms)`);
        } catch (r2Err: unknown) {
            console.error(`[R2] ❌ Upload failed for ${fileName}:`, r2Err instanceof Error ? r2Err.message : r2Err);
        }
    }

    const duration = Date.now() - start;
    const endToEndDuration = requestStartTime ? (Date.now() - requestStartTime) : duration;
    console.log(`[CERT] ✅ Fully Processed: ${recipientName} [Batch: ${batchId}] (Worker: ${duration}ms, End-to-End: ${endToEndDuration}ms)`);
    
    // 3. Update DB
    try {
      const updateData: Partial<Certificate & Record<string, unknown>> = {
        status: 'generated',
        error_message: null
      };

      if (r2Url) {
          updateData.r2_pdf_url = r2Url;
      }

      const { error: certErr } = await supabaseAdmin.from('certificates').update(updateData).eq('id', certificateId);

      if (certErr) throw certErr;

      // Sync to student profile if email exists
      if (recipientEmail && recipientName) {
          try {
            const emailKey = recipientEmail.toLowerCase().replace(/[^a-z0-9]/g, "_");
            const { data: profileIndex } = await supabaseAdmin
                .from('student_profile_index')
                .select('slug')
                .eq('email_key', emailKey)
                .maybeSingle();
            
            if (profileIndex) {
                await supabaseAdmin.from('student_profile_certs').upsert({
                    profile_slug: profileIndex.slug,
                    cert_id: certificateId,
                    batch_id: batchId,
                    recipient_name: recipientName,
                    r2_pdf_url: r2Url,
                    status: 'generated',
                    issued_at: new Date().toISOString()
                }, { onConflict: 'profile_slug,cert_id' });
            }
          } catch (profileErr) {
              console.error(`[PROFILE-SYNC] ⚠️ Failed for ${recipientEmail}:`, profileErr);
          }
      }

      // Delete the task on success to keep the table clean
      const { error: taskErr } = await supabaseAdmin.from('tasks')
        .delete()
        .eq('id', task.id);

      if (taskErr) throw taskErr;

      // Recovery: If no more active tasks for this batch, mark batch as draft
      const { count: remainingTasks } = await supabaseAdmin
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', batchId)
        .in('status', ['pending', 'processing']);

      if (remainingTasks === 0) {
          // Determine final status based on all certificates in the batch
          const { data: allCerts } = await supabaseAdmin
            .from('certificates')
            .select('status')
            .eq('batch_id', batchId);
          
          const statuses = (allCerts || []).map(c => c.status);
          const allGenerated = statuses.every(s => s === 'generated' || s === 'sent');
          const finalStatus = allGenerated ? 'generated' : 'partial';

          await supabaseAdmin.from('batches').update({ status: finalStatus }).eq('id', batchId);
      }

    } catch (dbError: unknown) {
      console.error(`[WORKER-DB] ⚠️ DB Update failed for ${recipientName}:`, dbError instanceof Error ? dbError.message : dbError);
    }

    return { success: true, taskId: task.id };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? (error instanceof Error ? error.message : String(error)) : String(error);
    console.error(`[THREAD-WORKER] Failed task ${task.id}:`, error);
    try {
        const payload = task.payload || {};
        const batchId = task.batchId || String(payload.batchId || payload.batch_id || "");
        const certificateId = task.certificateId || String(payload.certificateId || payload.certificate_id || "");

        if (certificateId) {
            await supabaseAdmin.from('certificates').update({
                status: 'failed',
                error_message: errorMessage
            }).eq('id', certificateId);
        }

        await supabaseAdmin.from('tasks').update({
            status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString()
        }).eq('id', task.id);

        // Recovery: If no more active tasks for this batch, mark batch as draft
        if (batchId) {
            const { count: remainingTasks } = await supabaseAdmin
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('batch_id', batchId)
                .in('status', ['pending', 'processing']);

            if (remainingTasks === 0) {
                // Determine final status based on all certificates in the batch
                const { data: allCerts } = await supabaseAdmin
                    .from('certificates')
                    .select('status')
                    .eq('batch_id', batchId);
                
                const statuses = (allCerts || []).map(c => c.status);
                const allGenerated = statuses.every(s => s === 'generated' || s === 'sent');
                const finalStatus = allGenerated ? 'generated' : 'partial';

                await supabaseAdmin.from('batches').update({ status: finalStatus }).eq('id', batchId);
            }
        }
    } catch (e) {
        console.error(`[THREAD-WORKER] Critical DB error while marking task failure:`, e);
    }
    return { success: false, taskId: task.id, error: errorMessage };
  }
}

export default async function (tasks: Task[]) {
  return Promise.all(tasks.map(task => processTask(task)));
}
