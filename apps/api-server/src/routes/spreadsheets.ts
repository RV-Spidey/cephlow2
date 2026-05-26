import { Router, type IRouter } from "express";
import { supabaseAdmin, toCamel } from "@workspace/supabase";
import { isAdminOrOwner } from "../middlewares/requireWorkspace.js";

const router: IRouter = Router();

// ── List all spreadsheets for the workspace ────────────────────────────────
router.get("/spreadsheets", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { data, error } = await supabaseAdmin
      .from("spreadsheets")
      .select("id, name, columns, created_at, updated_at, user_id")
      .eq("workspace_id", req.workspace!.id)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    const sheets = (data || []).map((row: any) => ({
      ...toCamel(row),
      columnCount: Array.isArray(row.columns) ? row.columns.length : 0,
    }));
    return res.json({ spreadsheets: sheets });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Get a single spreadsheet (with full row data) ──────────────────────────
router.get("/spreadsheets/:id", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { data, error } = await supabaseAdmin
      .from("spreadsheets")
      .select("*")
      .eq("id", req.params.id)
      .eq("workspace_id", req.workspace!.id)
      .single();
    if (error || !data) return res.status(404).json({ error: "Not found" });
    return res.json(toCamel(data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Create a spreadsheet ───────────────────────────────────────────────────
router.post("/spreadsheets", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const { name, columns, rows } = req.body || {};
  if (!name) return res.status(400).json({ error: "name is required" });
  try {
    const { data, error } = await supabaseAdmin
      .from("spreadsheets")
      .insert({
        workspace_id: req.workspace!.id,
        user_id: userId,
        name: name.trim(),
        columns: Array.isArray(columns) ? columns : [],
        rows: Array.isArray(rows) ? rows : [],
      })
      .select()
      .single();
    if (error) throw error;
    return res.status(201).json(toCamel(data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Update a spreadsheet ───────────────────────────────────────────────────
router.put("/spreadsheets/:id", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    // Only the creator or an admin/owner can update
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("spreadsheets")
      .select("user_id")
      .eq("id", req.params.id)
      .eq("workspace_id", req.workspace!.id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: "Not found" });
    if (existing.user_id !== userId && !isAdminOrOwner(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const patch: Record<string, any> = { updated_at: new Date().toISOString() };
    if (req.body.name !== undefined) patch.name = req.body.name.trim();
    if (req.body.columns !== undefined) patch.columns = req.body.columns;
    if (req.body.rows !== undefined) patch.rows = req.body.rows;

    const { data, error } = await supabaseAdmin
      .from("spreadsheets")
      .update(patch)
      .eq("id", req.params.id)
      .select()
      .single();
    if (error) throw error;
    return res.json(toCamel(data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Delete a spreadsheet ───────────────────────────────────────────────────
router.delete("/spreadsheets/:id", async (req, res) => {
  const userId = req.user?.uid;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("spreadsheets")
      .select("user_id")
      .eq("id", req.params.id)
      .eq("workspace_id", req.workspace!.id)
      .single();
    if (fetchErr || !existing) return res.status(404).json({ error: "Not found" });
    if (existing.user_id !== userId && !isAdminOrOwner(req)) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { error } = await supabaseAdmin
      .from("spreadsheets")
      .delete()
      .eq("id", req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
