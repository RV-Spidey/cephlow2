# Concurrent PDF Certificate Generation Plan

## Objective
Implement a true concurrent worker for certificate generation using the `piscina` thread pool library. This will solve the "module not found" execution issues with Node's native `worker_threads` when running TypeScript (via `tsx` and ESM) and offload the CPU-intensive PDF rendering from the main thread. The worker will continue to poll and respect the Postgres RPC `grab_pending_tasks`.

## Key Files & Context
- `apps/api-server/package.json`: Need to add the `piscina` dependency.
- `apps/api-server/src/utils/worker.ts`: Main orchestrator that polls `grab_pending_tasks` and feeds them to the thread pool.
- `apps/api-server/src/utils/pdf-worker.ts`: New file representing the isolated thread execution context.
- `apps/api-server/src/lib/pdfGenerator.ts`: Existing PDF rendering logic.

## Implementation Steps

1. **Install Dependency:** 
   Add `piscina` to `apps/api-server` dependencies.
2. **Create Worker File (`src/utils/pdf-worker.ts`):** 
   Create a dedicated file that exports a default async function. This function will receive task payloads and invoke `generateCertificatePDF`. This is required because Piscina workers need an entry point.
3. **Configure Piscina Pool (`src/utils/worker.ts`):** 
   Update the main worker to instantiate a `Piscina` pool. 
   - Point `filename` to the new `pdf-worker.ts`.
   - Pass `execArgv: ['--import', 'tsx']` to the Piscina constructor to ensure the worker thread knows how to load TypeScript files natively in an ESM (`"type": "module"`) environment, which solves the "module not found" error.
4. **Delegate Work:** 
   Instead of calling `processTask` synchronously, use `pool.run(task)` to offload the work. The polling mechanism will respect the `CONCURRENCY_LIMIT` by checking `pool.queueSize` or active tasks before pulling more via RPC.

## Verification & Testing
- Start the API server in dev mode using `pnpm dev` or `npm run dev`.
- Insert 10+ pending tasks into the `tasks` table.
- Verify the worker polls them and the logs indicate multiple threads rendering simultaneously.
- Verify the main event loop is not blocked (e.g., test a simple HTTP route like `/health` during generation).
- Verify the generated PDFs are correctly saved to `local_output` and the database statuses are updated correctly.

## Alternatives Considered
- **Direct `worker_threads`:** Rejected due to excessive boilerplate configuring ESM and `tsx` loaders for the threads.
- **Microservices/Separate Processes:** Rejected as overkill; a thread pool in the same process is perfectly suited for batch CPU work while keeping deployments simple.
- **Different Language (Go/Rust):** Unnecessary overhead; the Node ecosystem is fully capable with the right thread pool setup.