import app from "./app";
import { startWorker } from "./utils/worker.js";

const port = Number(process.env["PORT"]) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port} (0.0.0.0)`);
  startWorker().catch(err => console.error("Worker failed to start:", err));
  console.log("[R2] Config check:", {
    R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: process.env.R2_BUCKET_NAME || "(not set)",
  });
});
