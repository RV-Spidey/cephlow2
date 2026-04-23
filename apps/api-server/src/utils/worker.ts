import { supabaseAdmin, toCamel } from '@workspace/supabase';
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
const CONCURRENCY_LIMIT = parseInt(
  process.env.WORKER_CONCURRENCY || Math.max(1, os.cpus().length - 1).toString(), 
  10
);

let activeTaskCount = 0;
let totalCompleted = 0;

// Initialize Piscina Pool
// minThreads is set to match maxThreads to start all threads immediately as requested
const pool = new Piscina({
  filename: path.resolve(__dirname, 'pdf-worker.ts'),
  minThreads: CONCURRENCY_LIMIT,
  maxThreads: CONCURRENCY_LIMIT,
  execArgv: ['--import', 'tsx']
});

export async function startWorker() {
  console.log(`[WORKER] Starting THREAD POOL processor (Concurrency: ${CONCURRENCY_LIMIT})...`);
  
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
    // grab_pending_tasks is an RPC that uses FOR UPDATE SKIP LOCKED
    const { data: rawTasks, error } = await supabaseAdmin.rpc('grab_pending_tasks', { p_limit: limit });

    if (error) {
      console.error('[WORKER] Error grabbing tasks:', error);
      setTimeout(pollTasks, 5000);
      return;
    }

    const tasks = rawTasks || [];
    if (tasks.length === 0) {
      if (activeTaskCount === 0) {
        // console.log('[WORKER] 💤 Queue empty. Waiting for new tasks...');
      }
      setTimeout(pollTasks, 2000);
      return;
    }

    console.log(`[WORKER] 🚀 Grabbed ${tasks.length} tasks. (Active: ${activeTaskCount}/${CONCURRENCY_LIMIT})`);

    for (const rawTask of tasks) {
      const task = toCamel(rawTask);
      
      activeTaskCount++;
      // Offload to thread pool
      pool.run(task)
        .then(() => {
          totalCompleted++;
          console.log(`[PROGRESS] 📊 Total Completed: ${totalCompleted}`);
        })
        .catch(err => {
          // Errors are already handled inside pdf-worker.ts, but we catch pool-level errors here
          console.error(`[WORKER] Pool execution error for task ${task.id}:`, err);
        })
        .finally(() => {
          activeTaskCount--;
        });
    }
    
    // Quick poll for more tasks if capacity remains
    setTimeout(pollTasks, 100);

  } catch (err) {
    console.error('[WORKER] Polling error:', err);
    setTimeout(pollTasks, 5000);
  }
}
