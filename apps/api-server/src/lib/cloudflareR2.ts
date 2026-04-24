import { S3Client, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, CopyObjectCommand } from "@aws-sdk/client-s3";

// ─── Lazy-initialized singleton ──────────────────────────────────────────────
// S3Client is designed to be reused — creating one per call wastes TCP connections.

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

let _config: R2Config | null = null;
let _client: S3Client | null = null;

function getConfig(): R2Config | null {
  if (_config) return _config;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) return null;
  _config = { accountId, accessKeyId, secretAccessKey, bucketName };
  return _config;
}

function getClient(): S3Client {
  if (_client) return _client;
  const config = getConfig();
  if (!config) throw new Error("Cloudflare R2 credentials are not fully configured");
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  return _client;
}

export function isR2Configured(): boolean {
  const configured = getConfig() !== null;
  if (!configured) {
    console.warn("[R2] Not configured — missing env vars:", {
      R2_ACCOUNT_ID: !!process.env.R2_ACCOUNT_ID,
      R2_ACCESS_KEY_ID: !!process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: !!process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: !!process.env.R2_BUCKET_NAME,
    });
  }
  return configured;
}

/**
 * Build a public URL for an R2 object key using the R2_PUBLIC_URL env var.
 * Returns null if R2_PUBLIC_URL is not configured.
 */
export function getR2PublicUrl(key: string): string | null {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!base) return null;
  return `${base}/${key}`;
}

/**
 * Upload a PDF buffer to Cloudflare R2.
 * Stored at: {folderName}/{fileName}.pdf
 * Returns the R2 object key.
 */
export async function uploadPdfToR2(
  folderName: string,
  fileName: string,
  pdfBuffer: Buffer
): Promise<string> {
  const config = getConfig();
  if (!config) throw new Error("Cloudflare R2 credentials are not fully configured");

  const client = getClient();
  const safeFolderName = folderName.replace(/[^a-zA-Z0-9+\-_./]/g, "_");
  const safeFileName = fileName.replace(/[^a-zA-Z0-9+\-_.]/g, "_");
  const key = `${safeFolderName}/${safeFileName.endsWith(".pdf") ? safeFileName : `${safeFileName}.pdf`}`;

  console.log(`[R2] Uploading to bucket="${config.bucketName}" key="${key}" size=${pdfBuffer.length}`);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucketName,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    })
  );

  console.log(`[R2] Upload successful: ${key}`);
  return key;
}

/**
 * Copy an existing R2 object to a new key.
 */
export async function copyR2Object(sourceKey: string, destKey: string): Promise<void> {
  const config = getConfig();
  if (!config) throw new Error("Cloudflare R2 credentials are not fully configured");
  const client = getClient();
  await client.send(
    new CopyObjectCommand({
      Bucket: config.bucketName,
      CopySource: encodeURIComponent(`${config.bucketName}/${sourceKey}`),
      Key: destKey,
    })
  );
  console.log(`[R2] Copied object from ${sourceKey} to ${destKey}`);
}

/**
 * Delete a single object from R2 by its key.
 */
export async function deleteR2Object(key: string): Promise<void> {
  const config = getConfig();
  if (!config) throw new Error("Cloudflare R2 credentials are not fully configured");
  const client = getClient();
  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.bucketName, Key: key }));
    console.log(`[R2] Deleted object: ${key}`);
  } catch (err: unknown) {
    console.warn(`[R2] Failed to delete object ${key}:`, (err instanceof Error ? err.message : String(err)));
  }
}

/**
 * Delete multiple objects from R2 by their keys (up to 1000 at a time).
 */
export async function deleteR2Objects(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  const config = getConfig();
  if (!config) throw new Error("Cloudflare R2 credentials are not fully configured");
  const client = getClient();
  // R2 supports up to 1000 keys per batch delete
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await client.send(
      new DeleteObjectsCommand({
        Bucket: config.bucketName,
        Delete: { Objects: chunk.map((k) => ({ Key: k })) },
      })
    );
    console.log(`[R2] Deleted ${chunk.length} objects`);
  }
}
