import { Router, type IRouter } from "express";
import { supabaseAdmin } from "@workspace/supabase";

const router: IRouter = Router();

const MAX_CSS_CHARS = 20_000;

function validateConfig(config: any): string | null {
  if (!config || !["gradient", "hud", "css"].includes(config.type)) {
    return "config.type must be gradient, hud, or css";
  }
  if (config.type === "css") {
    if (typeof config.css !== "string") return "config.css must be a string";
    if (config.css.length > MAX_CSS_CHARS) return `CSS exceeds ${MAX_CSS_CHARS.toLocaleString()} character limit`;
  }
  return null;
}

// List custom frame templates for the active workspace
router.get("/frame-templates", async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const { data, error } = await supabaseAdmin
      .from("custom_frames")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return res.json({ frames: data || [] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Create a new custom frame template
router.post("/frame-templates", async (req, res) => {
  try {
    const userId = req.user!.uid;
    const workspaceId = req.workspace!.id;
    const { name, config } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    const configErr = validateConfig(config);
    if (configErr) return res.status(400).json({ error: configErr });

    const { data, error } = await supabaseAdmin
      .from("custom_frames")
      .insert({ workspace_id: workspaceId, created_by: userId, name: name.trim(), config })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update a custom frame template
router.patch("/frame-templates/:id", async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const { id } = req.params;
    const { name, config } = req.body;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("custom_frames")
      .select("workspace_id")
      .eq("id", id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: "Frame not found" });
    if (existing.workspace_id !== workspaceId) return res.status(403).json({ error: "Access denied" });

    if (config !== undefined) {
      const configErr = validateConfig(config);
      if (configErr) return res.status(400).json({ error: configErr });
    }

    const update: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) update.name = name.trim();
    if (config !== undefined) update.config = config;

    const { data, error } = await supabaseAdmin
      .from("custom_frames")
      .update(update)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete a custom frame template (blocked if any batch still uses it)
router.delete("/frame-templates/:id", async (req, res) => {
  try {
    const workspaceId = req.workspace!.id;
    const { id } = req.params;

    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("custom_frames")
      .select("workspace_id")
      .eq("id", id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: "Frame not found" });
    if (existing.workspace_id !== workspaceId) return res.status(403).json({ error: "Access denied" });

    const { data: inUse } = await supabaseAdmin
      .from("batches")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("frame_tier", `custom:${id}`)
      .limit(1)
      .maybeSingle();
    if (inUse) {
      return res.status(409).json({
        error: "This frame is in use by a batch. Remove it from all batches before deleting.",
      });
    }

    const { data: hasListing } = await supabaseAdmin
      .from("frame_listings")
      .select("id")
      .eq("frame_id", id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (hasListing) {
      return res.status(409).json({
        error: "This frame has an active marketplace listing. Unpublish it before deleting.",
      });
    }

    await supabaseAdmin.from("custom_frames").delete().eq("id", id);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
