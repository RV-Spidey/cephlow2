import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { generateAuthUrl, handleCallback, hasGoogleToken } from "../lib/googleAuth.js";

const router = Router();

// Protected: check if Google account is connected
router.get("/auth/google/status", requireAuth, async (req, res) => {
  try {
    const connected = await hasGoogleToken(req.user!.uid);
    res.json({ connected });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// Protected: generate the Google OAuth consent URL
router.get("/auth/google/url", requireAuth, async (req, res) => {
  try {
    const url = await generateAuthUrl(req.user!.uid);
    res.json({ url });
  } catch (err: unknown) {
    res.status(500).json({ error: (err instanceof Error ? err.message : String(err)) });
  }
});

// Unprotected: callback redirect from Google — must be registered in app.ts before requireAuth
router.get("/auth/google/callback", async (req, res) => {
  const { code, state, error } = req.query;
  const frontendUrl = (process.env.FRONTEND_URL || process.env.PUBLIC_BASE_URL || "http://localhost:5173").replace(/\/$/, "");

  if (error) {
    return res.redirect(`${frontendUrl}?google_auth=error&reason=${encodeURIComponent(String(error))}`);
  }

  if (!code || !state) {
    return res.redirect(`${frontendUrl}?google_auth=error&reason=missing_params`);
  }

  try {
    await handleCallback(String(code), String(state));
    res.redirect(`${frontendUrl}?google_auth=success`);
  } catch (err: unknown) {
    res.redirect(`${frontendUrl}?google_auth=error&reason=${encodeURIComponent((err instanceof Error ? err.message : String(err)))}`);
  }
});

export default router;
