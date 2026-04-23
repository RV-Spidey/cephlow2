import { generateCertificatePDF } from '../lib/pdfGenerator.js';
import { supabaseAdmin } from '@workspace/supabase';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_OUTPUT_DIR = path.join(__dirname, '..', '..', 'local_output');

export default async function (task: any) {
  try {
    const payload = task.payload || {};
    const batchId = task.batchId || task.batch_id || payload.batchId || payload.batch_id;
    const certificateId = task.certificateId || task.certificate_id || payload.certificateId || payload.certificate_id;
    const recipientName = payload.recipientName || payload.recipient_name || 'Unknown';
    const replacements = payload.replacements || {};
    const qrCodeUrl = payload.qrCodeUrl || payload.qr_code_url;
    const slideIndex = payload.slideIndex !== undefined ? payload.slideIndex : payload.slide_index;

    const start = Date.now();
    // console.log(`[THREAD-WORKER] Processing Cert: ${certificateId}`); // Removed verbose log

    if (!certificateId) throw new Error("Missing certificate_id in task");

    // 1. Generate the PDF bytes
    const pdfBytes = await generateCertificatePDF(
      batchId,
      certificateId,
      recipientName,
      replacements,
      qrCodeUrl,
      slideIndex || 0
    );

    // 2. Save locally
    const fileName = `${recipientName.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_')}_${certificateId.substring(0, 8)}.pdf`;
    const filePath = path.join(LOCAL_OUTPUT_DIR, fileName);

    if (!fs.existsSync(LOCAL_OUTPUT_DIR)) {
      fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true });
    }

    fs.writeFileSync(filePath, pdfBytes);
    
    const duration = Date.now() - start;
    console.log(`[CERT] 📄 Saved: ${recipientName} (${duration}ms)`);
    
    // 3. Update DB
    try {
      const { error: certErr } = await supabaseAdmin.from('certificates').update({
        status: 'generated',
        pdf_url: `local:///${fileName}`,
        error_message: null
      }).eq('id', certificateId);

      if (certErr) throw certErr;

      // Delete the task on success to keep the table clean
      const { error: taskErr } = await supabaseAdmin.from('tasks')
        .delete()
        .eq('id', task.id);

      if (taskErr) throw taskErr;
    } catch (dbError: any) {
      console.error(`[WORKER-DB] ⚠️ DB Update failed for ${recipientName}: ${dbError.message}`);
      // We don't re-throw here because the file IS generated and saved locally
    }

    return { success: true, taskId: task.id };
  } catch (error: any) {
    console.error(`[THREAD-WORKER] Failed task ${task.id}:`, error);
    try {
        await supabaseAdmin.from('tasks').update({
            status: 'failed',
            error_message: error.message,
            updated_at: new Date().toISOString()
        }).eq('id', task.id);
    } catch (e) {
        console.error(`[THREAD-WORKER] Critical DB error while marking task failure:`, e);
    }
    throw error;
  }
}
