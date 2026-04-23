import { supabaseAdmin, toCamel } from '@workspace/supabase';
import { generateCertificatePDF } from '../lib/pdfGenerator.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to local_output relative to this file
const LOCAL_OUTPUT_DIR = path.join(__dirname, '..', '..', 'local_output');

const CONCURRENCY_LIMIT = 10;
let activeTaskCount = 0;

export async function startWorker() {
  console.log(`[WORKER] Starting LOCAL TEST processor (Concurrency: ${CONCURRENCY_LIMIT})...`);
  
  // Ensure directory exists
  if (!fs.existsSync(LOCAL_OUTPUT_DIR)) {
    fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true });
  }
  
  pollTasks();
}

async function pollTasks() {
  if (activeTaskCount >= CONCURRENCY_LIMIT) {
    setTimeout(pollTasks, 500);
    return;
  }

  try {
    const limit = CONCURRENCY_LIMIT - activeTaskCount;
    const { data: rawTasks, error } = await supabaseAdmin.rpc('grab_pending_tasks', { p_limit: limit });

    if (error) {
      console.error('[WORKER] Error grabbing tasks:', error);
      setTimeout(pollTasks, 5000);
      return;
    }

    const tasks = rawTasks || [];
    if (tasks.length === 0) {
      setTimeout(pollTasks, 2000);
      return;
    }

    console.log(`[WORKER] Grabbed ${tasks.length} tasks. Processing locally...`);

    for (const rawTask of tasks) {
      const task = toCamel(rawTask);
      processTask(task);
    }
    
    setTimeout(pollTasks, 100);

  } catch (err) {
    console.error('[WORKER] Polling error:', err);
    setTimeout(pollTasks, 5000);
  }
}

async function processTask(task: any) {
  activeTaskCount++;
  
  try {
    if (task.type === 'generate') {
      const payload = task.payload || {};
      
      const batchId = task.batchId || task.batch_id || payload.batchId || payload.batch_id;
      const certificateId = task.certificateId || task.certificate_id || payload.certificateId || payload.certificate_id;
      const recipientName = payload.recipientName || payload.recipient_name || 'Unknown';
      const replacements = payload.replacements || {};
      const qrCodeUrl = payload.qrCodeUrl || payload.qr_code_url;
      const slideIndex = payload.slideIndex !== undefined ? payload.slideIndex : payload.slide_index;

      console.log(`[LOCAL-TASK] Generating PDF for Cert: ${certificateId}`);
      
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
      const fileName = `${recipientName.replace(/\s+/g, '_')}_${certificateId.substring(0, 8)}.pdf`;
      const filePath = path.join(LOCAL_OUTPUT_DIR, fileName);
      
      fs.writeFileSync(filePath, pdfBytes);
      console.log(`[LOCAL-TASK] Saved to: ${filePath}`);

      // 3. Update DB with the local filename/path
      await supabaseAdmin.from('certificates').update({
        status: 'generated',
        pdf_url: `local:///${fileName}`, // Marker for local testing
        error_message: null
      }).eq('id', certificateId);

      await supabaseAdmin.from('tasks').update({
        status: 'completed',
        updated_at: new Date().toISOString()
      }).eq('id', task.id);

      console.log(`[LOCAL-TASK] Done: ${task.id}`);
    }
  } catch (error: any) {
    console.error(`[LOCAL-TASK] Failed ${task.id}:`, error);
    await supabaseAdmin.from('tasks').update({
        status: 'failed',
        error_message: error.message,
        updated_at: new Date().toISOString()
    }).eq('id', task.id);
  } finally {
    activeTaskCount--;
  }
}
