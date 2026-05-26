import { Router, type IRouter } from "express";
import { supabaseAdmin } from "@workspace/supabase";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

// Public endpoint — no auth required
router.get("/p/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const { data: profile, error } = await supabaseAdmin
      .from("student_profiles")
      .select("slug, name, email")
      .eq("slug", username)
      .single();

    if (error || !profile) return res.status(404).json({ error: "Profile not found" });

    const { data: certsData, error: certsError } = await supabaseAdmin
      .from("student_profile_certs")
      .select("cert_id, batch_id, batch_name, recipient_name, r2_pdf_url, pdf_url, slide_url, issued_at, status")
      .eq("profile_slug", username)
      .order("issued_at", { ascending: false });

    if (certsError) {
      console.error("[profiles] student_profile_certs query error:", certsError);
      return res.status(500).json({ error: certsError.message });
    }

    // Fetch banner URLs for the batches referenced by these certs
    const batchIds = [...new Set((certsData || []).map((r) => r.batch_id).filter(Boolean))];
    type BatchMeta = { banner_url: string | null; banner_overlay_opacity: number; banner_text_color: string; banner_crop_zoom: number; banner_crop_x: number; banner_crop_y: number; frame_tier: string };
    const bannerByBatchId: Record<string, BatchMeta> = {};
    if (batchIds.length > 0) {
      const { data: batchRows } = await supabaseAdmin
        .from("batches")
        .select("id, banner_url, banner_overlay_opacity, banner_text_color, banner_crop_zoom, banner_crop_x, banner_crop_y, frame_tier")
        .in("id", batchIds);
      for (const b of batchRows || []) {
        bannerByBatchId[b.id] = b;
      }
    }

    // Fetch configs for any custom frames referenced by these batches
    const customFrameIds = [...new Set(
      Object.values(bannerByBatchId)
        .map(b => b.frame_tier)
        .filter(t => t?.startsWith("custom:"))
        .map(t => t.slice(7))
    )];
    const customFrameConfigById: Record<string, any> = {};
    if (customFrameIds.length > 0) {
      const { data: cfRows } = await supabaseAdmin
        .from("custom_frames")
        .select("id, config")
        .in("id", customFrameIds);
      for (const cf of cfRows || []) {
        customFrameConfigById[cf.id] = cf.config;
      }
    }

    // Fetch configs for marketplace frames (via frame_listings → custom_frames)
    const marketplaceListingIds = [...new Set(
      Object.values(bannerByBatchId)
        .map(b => b.frame_tier)
        .filter(t => t?.startsWith("marketplace:"))
        .map(t => t.slice(12))
    )];
    const marketplaceFrameConfigById: Record<string, any> = {};
    if (marketplaceListingIds.length > 0) {
      const { data: mlRows } = await supabaseAdmin
        .from("frame_listings")
        .select("id, custom_frames!inner(config)")
        .in("id", marketplaceListingIds);
      for (const row of mlRows || []) {
        marketplaceFrameConfigById[row.id] = (row as any).custom_frames?.config ?? null;
      }
    }

    const certificates = (certsData || []).map((row) => {
      const batchMeta = bannerByBatchId[row.batch_id];
      const frameTier = batchMeta?.frame_tier ?? 'none';
      let customFrameConfig = null;
      if (frameTier.startsWith("custom:")) {
        customFrameConfig = customFrameConfigById[frameTier.slice(7)] ?? null;
      } else if (frameTier.startsWith("marketplace:")) {
        customFrameConfig = marketplaceFrameConfigById[frameTier.slice(12)] ?? null;
      }
      return {
        certId: row.cert_id,
        batchId: row.batch_id,
        batchName: row.batch_name,
        recipientName: row.recipient_name,
        r2PdfUrl: row.r2_pdf_url ?? null,
        pdfUrl: row.pdf_url ?? null,
        slideUrl: row.slide_url ?? null,
        issuedAt: row.issued_at,
        status: row.status,
        bannerUrl: batchMeta?.banner_url ?? null,
        bannerOverlayOpacity: batchMeta?.banner_overlay_opacity ?? 0.70,
        bannerTextColor: batchMeta?.banner_text_color ?? "default",
        bannerCropZoom: batchMeta?.banner_crop_zoom ?? 1.0,
        bannerCropX: batchMeta?.banner_crop_x ?? 50,
        bannerCropY: batchMeta?.banner_crop_y ?? 50,
        frameTier,
        customFrameConfig,
      };
    });

    return res.json({ slug: profile.slug, name: profile.name, certificates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Authenticated — issuer can edit a profile name if they issued at least one cert to this student
router.patch("/p/:username", requireAuth, async (req, res) => {
  try {
    const userId = req.user?.uid;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { username } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("student_profiles")
      .select("slug")
      .eq("slug", username)
      .single();
    if (profileErr || !profile) return res.status(404).json({ error: "Profile not found" });

    // Verify the requesting user issued at least one cert to this student
    const { data: authCheck } = await supabaseAdmin
      .from("student_profile_certs")
      .select("batches!inner(user_id)")
      .eq("profile_slug", username)
      .eq("batches.user_id", userId)
      .limit(1)
      .maybeSingle();

    if (!authCheck) {
      return res.status(403).json({ error: "You have not issued any certificates to this student" });
    }

    await supabaseAdmin
      .from("student_profiles")
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq("slug", username);

    return res.json({ success: true, name: name.trim() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
