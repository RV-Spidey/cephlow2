import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  generateAuthUrl,
  handleCallback,
  hasGoogleToken,
  hasAnyGoogleToken,
  disconnectGoogleToken,
  type GoogleScopeType,
} from "../lib/googleAuth.js";
import { supabaseAdmin } from "@workspace/supabase";

const router = Router();

const VALID_SCOPES: GoogleScopeType[] = ["drive", "sheets", "slides", "all"];

function parseScopeType(raw: unknown): GoogleScopeType {
  if (typeof raw === "string" && VALID_SCOPES.includes(raw as GoogleScopeType)) {
    return raw as GoogleScopeType;
  }
  return "all";
}

// Protected: check which Google scopes are connected
router.get("/auth/google/status", requireAuth, async (req, res) => {
  try {
    const uid = req.user!.uid;
    const [drive, sheets, slides] = await Promise.all([
      hasGoogleToken(uid, "drive"),
      hasGoogleToken(uid, "sheets"),
      hasGoogleToken(uid, "slides"),
    ]);
    const legacy = await hasAnyGoogleToken(uid);
    res.json({ connected: legacy, drive, sheets, slides });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Protected: generate the Google OAuth consent URL for a specific scope
router.get("/auth/google/url", requireAuth, async (req, res) => {
  try {
    const origin = typeof req.query.origin === "string" ? req.query.origin : undefined;
    const scopeType = parseScopeType(req.query.scope);
    const url = await generateAuthUrl(req.user!.uid, scopeType, origin);
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Unprotected: callback redirect from Google
router.get("/auth/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = (process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

  if (error) {
    return res.redirect(`${frontendUrl}/settings?google_auth=error&reason=${encodeURIComponent(String(error))}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/settings?google_auth=error&reason=missing_params`);
  }

  try {
    const { originUrl } = await handleCallback(String(code), String(state));
    const redirectBase = originUrl || frontendUrl;
    res.redirect(`${redirectBase}/settings?google_auth=success`);
  } catch (err: any) {
    res.redirect(`${frontendUrl}/settings?google_auth=error&reason=${encodeURIComponent(err.message)}`);
  }
});

// Protected: disconnect a specific scope (or all if no scope param)
router.delete("/auth/google/disconnect", requireAuth, async (req, res) => {
  try {
    const scopeType = req.query.scope ? parseScopeType(req.query.scope) : undefined;
    await disconnectGoogleToken(req.user!.uid, scopeType);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
