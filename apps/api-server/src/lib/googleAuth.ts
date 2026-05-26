import { google } from "googleapis";
import { supabaseAdmin } from "@workspace/supabase";
import crypto from "crypto";

export type GoogleScopeType = "drive" | "sheets" | "slides" | "all";

const SCOPE_SETS: Record<GoogleScopeType, string[]> = {
  drive: [
    "https://www.googleapis.com/auth/drive.file",
  ],
  sheets: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ],
  slides: [
    "https://www.googleapis.com/auth/presentations",
    "https://www.googleapis.com/auth/drive.file",
  ],
  all: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/presentations",
  ],
};

function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export async function generateAuthUrl(uid: string, scopeType: GoogleScopeType = "all", originUrl?: string): Promise<string> {
  const nonce = crypto.randomBytes(16).toString("hex");
  await supabaseAdmin.from("pending_google_auth").upsert({
    nonce,
    uid,
    scope_type: scopeType,
    expires_at: Date.now() + 10 * 60 * 1000,
    ...(originUrl && { origin_url: originUrl }),
  });

  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPE_SETS[scopeType],
    state: nonce,
  });
}

export async function handleCallback(code: string, state: string): Promise<{ originUrl?: string }> {
  const { data: row } = await supabaseAdmin
    .from("pending_google_auth")
    .select("uid, expires_at, origin_url, scope_type")
    .eq("nonce", state)
    .maybeSingle();

  if (!row) throw new Error("Invalid or expired state parameter");

  await supabaseAdmin.from("pending_google_auth").delete().eq("nonce", state);

  if (Date.now() > row.expires_at) throw new Error("Auth session expired. Please try again.");

  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned. Revoke app access at myaccount.google.com/permissions and try again."
    );
  }

  const scopeType: GoogleScopeType = (row.scope_type as GoogleScopeType) || "all";

  await supabaseAdmin.from("user_google_tokens").upsert({
    user_id: row.uid,
    scope_type: scopeType,
    refresh_token: tokens.refresh_token,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,scope_type" });

  return { originUrl: row.origin_url ?? undefined };
}

export async function hasGoogleToken(uid: string, scopeType?: GoogleScopeType): Promise<boolean> {
  let query = supabaseAdmin
    .from("user_google_tokens")
    .select("user_id")
    .eq("user_id", uid);

  if (scopeType) {
    query = query.eq("scope_type", scopeType);
  }

  const { data } = await query.maybeSingle();
  return !!data;
}

export async function hasAnyGoogleToken(uid: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("user_google_tokens")
    .select("user_id")
    .eq("user_id", uid)
    .limit(1)
    .maybeSingle();
  return !!data;
}

// Returns token for specific scope, falling back to 'all' for backwards compat.
export async function getAuthClientForUser(uid: string, scopeType: GoogleScopeType = "all") {
  const { data: rows } = await supabaseAdmin
    .from("user_google_tokens")
    .select("refresh_token, scope_type")
    .eq("user_id", uid);

  if (!rows || rows.length === 0) {
    const err: any = new Error("Google account not connected. Please reconnect via the app.");
    err.code = "GOOGLE_NOT_CONNECTED";
    throw err;
  }

  // Prefer exact scope match, then fall back to 'all'
  const exact = rows.find((r: any) => r.scope_type === scopeType);
  const fallback = rows.find((r: any) => r.scope_type === "all");
  const token = exact || fallback || rows[0];

  if (!token) {
    const err: any = new Error(`Google account not connected for ${scopeType}. Please connect via Settings.`);
    err.code = "GOOGLE_NOT_CONNECTED";
    throw err;
  }

  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ refresh_token: token.refresh_token });
  return client;
}

function isInvalidGrant(err: any): boolean {
  return (
    err?.message === "invalid_grant" ||
    err?.response?.data?.error === "invalid_grant" ||
    err?.code === "invalid_grant"
  );
}

export async function disconnectGoogleToken(uid: string, scopeType?: GoogleScopeType): Promise<void> {
  let query = supabaseAdmin.from("user_google_tokens").select("refresh_token, scope_type").eq("user_id", uid);
  if (scopeType) query = query.eq("scope_type", scopeType);

  const { data: rows } = await query;

  if (rows && rows.length > 0) {
    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
    );
    for (const row of rows) {
      try { await client.revokeToken(row.refresh_token); } catch { /* best-effort */ }
    }
  }

  let deleteQuery = supabaseAdmin.from("user_google_tokens").delete().eq("user_id", uid);
  if (scopeType) deleteQuery = deleteQuery.eq("scope_type", scopeType);
  await deleteQuery;
}

export async function handleGoogleError(uid: string, err: any): Promise<never> {
  if (isInvalidGrant(err)) {
    await supabaseAdmin.from("user_google_tokens").delete().eq("user_id", uid);
    const newErr: any = new Error(
      "Your Google account connection has expired. Please reconnect your Google account and try again."
    );
    newErr.code = "GOOGLE_TOKEN_EXPIRED";
    newErr.status = 401;
    throw newErr;
  }
  throw err;
}
