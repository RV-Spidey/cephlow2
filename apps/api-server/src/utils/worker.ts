import { supabaseAdmin, toCamel, type Task } from '@workspace/supabase';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import { Piscina } from 'piscina';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to local_output relative to this file
const LOCAL_OUTPUT_DIR = path.join(__dirname, '..', '..', 'local_output');

// Read from env or fallback to (logical cores - 1) to leave room for the main event loop
const THREAD_CONCURRENCY = parseInt(
  process.env.CONCURRENCY_LIMIT || Math.max(1, os.cpus().length - 1).toString(), 
  10
);

const ASYNC_CONCURRENCY = parseInt(process.env.ASYNC_CONCURRENCY || '10', 10);
let activeThreadCount = 0;
let totalCompleted = 0;

// Initialize Piscina Pool
// minThreads is set to match maxThreads to start all threads immediately as requested
const pool = new Piscina({
  filename: path.resolve(__dirname, 'pdf-worker.ts'),
  minThreads: THREAD_CONCURRENCY,
  maxThreads: THREAD_CONCURRENCY,
  execArgv: ['--import', 'tsx']
});

export async function startWorker() {
  console.log(`[WORKER] Starting THREAD POOL processor (Threads: ${THREAD_CONCURRENCY}, Async/Thread: ${ASYNC_CONCURRENCY})...`);
  
  // 1. Recovery: Reset tasks stuck in 'processing' due to server crash
  try {
      const { data: stuckTasks } = await supabaseAdmin
        .from('tasks')
        .select('id, certificate_id')
        .eq('status', 'processing');
      
      if (stuckTasks && stuckTasks.length > 0) {
          console.log(`[WORKER] 🛠️ Recovering ${stuckTasks.length} stuck tasks...`);
          
          const taskIds = stuckTasks.map(t => t.id);
          const certIds = stuckTasks.map(t => t.certificate_id).filter(Boolean);

          // Reset tasks to pending
          await supabaseAdmin.from('tasks').update({ status: 'pending' }).in('id', taskIds);
          
          // Reset certificates to pending
          if (certIds.length > 0) {
              await supabaseAdmin.from('certificates').update({ status: 'pending' }).in('id', certIds);
          }
          console.log(`[WORKER] ✅ Recovery complete.`);
      }
  } catch (err) {
      console.error('[WORKER] Recovery error:', err);
  }

  // 2. Ensure directory exists
  if (!fs.existsSync(LOCAL_OUTPUT_DIR)) {
    fs.mkdirSync(LOCAL_OUTPUT_DIR, { recursive: true });
  }
  
  pollTasks();
}

async function pollTasks() {
  if (activeThreadCount >= THREAD_CONCURRENCY) {
    setTimeout(pollTasks, 500);
    return;
  }

  try {
    const availableThreads = THREAD_CONCURRENCY - activeThreadCount;
    const limit = availableThreads * ASYNC_CONCURRENCY;
    // grab_pending_tasks is an RPC that uses FOR UPDATE SKIP LOCKED
    const { data: rawTasks, error } = await supabaseAdmin.rpc('grab_pending_tasks', { p_limit: limit });

    if (error) {
      console.error('[WORKER] Error grabbing tasks:', error);
      setTimeout(pollTasks, 5000);
      return;
    }

    const tasks = (rawTasks || []).map((t: unknown) => toCamel<Task>(t as Record<string, unknown>));
    if (tasks.length === 0) {
      if (activeThreadCount === 0) {
        // console.log('[WORKER] 💤 Queue empty. Waiting for new tasks...');
      }
      setTimeout(pollTasks, 2000);
      return;
    }

    console.log(`[WORKER] 🚀 Grabbed ${tasks.length} tasks. (Active Threads: ${activeThreadCount}/${THREAD_CONCURRENCY})`);

    // Chunk tasks into groups of ASYNC_CONCURRENCY
    const chunks: Task[][] = [];
    for (let i = 0; i < tasks.length; i += ASYNC_CONCURRENCY) {
      chunks.push(tasks.slice(i, i + ASYNC_CONCURRENCY));
    }

    for (const chunk of chunks) {
      activeThreadCount++;
      // Offload batch to thread pool
      pool.run(chunk)
        .then(() => {
          totalCompleted += chunk.length;
          console.log(`[PROGRESS] 📊 Total Completed: ${totalCompleted}`);
        })
        .catch(err => {
          // Errors are already handled inside pdf-worker.ts, but we catch pool-level errors here
          console.error(`[WORKER] Pool execution error for batch:`, err);
        })
        .finally(() => {
          activeThreadCount--;
        });
    }
    
    // Quick poll for more tasks if capacity remains
    setTimeout(pollTasks, 100);

  } catch (err) {
    console.error('[WORKER] Polling error:', err);
    setTimeout(pollTasks, 5000);
  }
}
