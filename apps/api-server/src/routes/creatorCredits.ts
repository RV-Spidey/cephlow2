import { Router, type IRouter } from "express";
import { supabaseAdmin } from "@workspace/supabase";
import { requireAuth } from "../middlewares/auth.js";
import { sendEmail } from "../lib/gmail.js";

const router: IRouter = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "cephlow@gmail.com";
const YEARLY_CREDIT_LIMIT = 20_000;

// ─── Admin guard ─────────────────────────────────────────────────────────────

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: "Forbidden" });
  }
  return next();
}

// ─── GET /api/creator/credits ─────────────────────────────────────────────────

router.get("/creator/credits", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { data, error } = await supabaseAdmin
      .from("user_profiles")
      .select("creator_credits, creator_name")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return res.json({ creatorCredits: data?.creator_credits ?? 0, creatorName: data?.creator_name ?? "" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/creator/name ──────────────────────────────────────────────────

router.patch("/creator/name", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { name } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (name.trim().length > 40) {
      return res.status(400).json({ error: "name must be 40 characters or fewer" });
    }
    await supabaseAdmin
      .from("user_profiles")
      .update({ creator_name: name.trim() })
      .eq("id", userId);
    return res.json({ creatorName: name.trim() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creator/credits/transfer ───────────────────────────────────────

router.post("/creator/credits/transfer", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { amount, targetWorkspaceId } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (amount !== Math.floor(amount)) {
      return res.status(400).json({ error: "amount must be a whole number" });
    }
    if (!targetWorkspaceId || typeof targetWorkspaceId !== "string") {
      return res.status(400).json({ error: "targetWorkspaceId is required" });
    }

    const { data: result, error } = await supabaseAdmin.rpc(
      "transfer_creator_credits",
      { p_user_id: userId, p_workspace_id: targetWorkspaceId, p_amount: amount }
    );
    if (error) throw error;
    if (!result.success) {
      return res.status(400).json({ error: result.error, available: result.available });
    }

    await supabaseAdmin.from("ledgers").insert({
      workspace_id: targetWorkspaceId,
      user_id: userId,
      type: "topup",
      amount,
      balance_after: result.new_workspace_balance,
      description: "Creator credits transferred to workspace",
      metadata: { source: "creator_credit_transfer" },
    });

    return res.json({
      success: true,
      newCreatorCredits: result.new_credits,
      newWorkspaceBalance: result.new_workspace_balance,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/creator/credits/redeem ────────────────────────────────────────
// Submit a gift voucher redemption request. Credits deducted atomically.

router.post("/creator/credits/redeem", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { amount, brand } = req.body ?? {};

    if (!amount || typeof amount !== "number" || amount < 100) {
      return res.status(400).json({ error: "amount must be at least ₹100" });
    }
    if (!Number.isInteger(amount)) {
      return res.status(400).json({ error: "amount must be a whole number" });
    }
    if (!["amazon", "flipkart"].includes(brand)) {
      return res.status(400).json({ error: "brand must be 'amazon' or 'flipkart'" });
    }

    // Block if user already has a pending request
    const { data: existingPending } = await supabaseAdmin
      .from("redemption_requests")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .maybeSingle();
    if (existingPending) {
      return res.status(429).json({
        error: "You already have a pending redemption request. Wait for it to be processed before submitting another.",
      });
    }

    // Fetch user email and creator name
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    const userEmail = authUser?.user?.email ?? "";
    if (!userEmail) return res.status(400).json({ error: "User email not found" });

    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("creator_name")
      .eq("id", userId)
      .maybeSingle();
    const creatorName = profile?.creator_name ?? "";

    // Atomically deduct credits + enforce ₹20,000/year cap
    const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc(
      "redeem_creator_credits",
      { p_user_id: userId, p_amount: amount }
    );
    if (rpcErr) throw rpcErr;
    if (!rpcResult.success) {
      return res.status(400).json({
        error: rpcResult.error,
        available: rpcResult.available,
        yearlyUsed: rpcResult.yearly_used,
        yearlyLimit: rpcResult.yearly_limit,
      });
    }

    // Insert request row — compensate if insert fails
    const { data: request, error: insertErr } = await supabaseAdmin
      .from("redemption_requests")
      .insert({
        user_id: userId,
        amount,
        brand,
        status: "pending",
        user_email: userEmail,
        creator_name: creatorName,
      })
      .select("id")
      .single();

    if (insertErr) {
      await supabaseAdmin.rpc("refund_creator_credits", { p_user_id: userId, p_amount: amount });
      throw insertErr;
    }

    const brandLabel = brand === "amazon" ? "Amazon India" : "Flipkart";
    sendEmail("", {
      to: ADMIN_EMAIL,
      subject: `[Action needed] New ₹${amount} ${brandLabel} voucher request`,
      body: [
        `A creator has submitted a gift voucher redemption request.`,
        ``,
        `Creator: ${creatorName || userEmail}`,
        `Email:   ${userEmail}`,
        `Brand:   ${brandLabel}`,
        `Amount:  ₹${amount}`,
        `Request ID: ${request.id}`,
        ``,
        `Review and fulfill at: https://cephlow.in/admin/redemptions`,
      ].join("\n"),
    }).catch(() => null);

    return res.status(201).json({
      success: true,
      requestId: request.id,
      newCreatorCredits: rpcResult.new_credits,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/creator/credits/redemptions ────────────────────────────────────
// Creator's own redemption history.

router.get("/creator/credits/redemptions", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from("redemption_requests")
      .select("id, amount, brand, status, voucher_code, admin_note, created_at, updated_at", { count: "exact" })
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Annual totals for display
    const { data: yearly } = await supabaseAdmin
      .from("redemption_requests")
      .select("amount")
      .eq("user_id", userId)
      .in("status", ["pending", "fulfilled"])
      .gte("created_at", new Date(new Date().getFullYear(), 0, 1).toISOString());

    const yearlyUsed = (yearly || []).reduce((s: number, r: any) => s + (r.amount ?? 0), 0);

    return res.json({
      requests: (data || []).map((r: any) => ({
        id: r.id,
        amount: r.amount,
        brand: r.brand,
        status: r.status,
        voucherCode: r.voucher_code ?? null,
        adminNote: r.admin_note ?? null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
      total: count ?? 0,
      yearlyUsed,
      yearlyLimit: YEARLY_CREDIT_LIMIT,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/redemptions ───────────────────────────────────────────────

router.get("/admin/redemptions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = (req.query.status as string) || "pending";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("redemption_requests")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: true })
      .range(offset, offset + limit - 1);

    if (status !== "all") query = query.eq("status", status);

    const { data, error, count } = await query;
    if (error) throw error;

    return res.json({ requests: data ?? [], total: count ?? 0 });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/redemptions/:id/fulfill ─────────────────────────────────

router.patch("/admin/redemptions/:id/fulfill", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { voucherCode, adminNote } = req.body ?? {};

    if (!voucherCode || typeof voucherCode !== "string" || !voucherCode.trim()) {
      return res.status(400).json({ error: "voucherCode is required" });
    }

    const { data: request, error: fetchErr } = await supabaseAdmin
      .from("redemption_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending") return res.status(409).json({ error: "Request already processed" });

    await supabaseAdmin
      .from("redemption_requests")
      .update({ status: "fulfilled", voucher_code: voucherCode.trim(), admin_note: adminNote ?? null })
      .eq("id", id);

    const brandName = request.brand === "amazon" ? "Amazon India" : "Flipkart";
    const redeemUrl = request.brand === "amazon"
      ? "https://www.amazon.in/gc/redeem"
      : "https://www.flipkart.com/offers-store/giftcard/redeem";

    await sendEmail(request.user_id, {
      to: request.user_email,
      subject: `Your Cephlow ₹${request.amount} ${brandName} voucher is ready`,
      body: [
        `Hi ${request.creator_name || "there"},`,
        ``,
        `Your creator credit redemption has been processed!`,
        ``,
        `Brand:  ${brandName}`,
        `Amount: ₹${request.amount}`,
        `Code:   ${voucherCode.trim()}`,
        ``,
        `Redeem at: ${redeemUrl}`,
        ``,
        `This voucher was issued as a goodwill reward from your Cephlow creator credits.`,
        `Recipients are responsible for any applicable taxes on received benefits.`,
        ``,
        `If you have any issues, reply to this email.`,
        ``,
        `— Cephlow Team`,
      ].join("\n"),
    }).catch(() => null); // non-fatal — admin can resend manually

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/admin/redemptions/:id/reject ─────────────────────────────────

router.patch("/admin/redemptions/:id/reject", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNote } = req.body ?? {};

    const { data: request, error: fetchErr } = await supabaseAdmin
      .from("redemption_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchErr || !request) return res.status(404).json({ error: "Request not found" });
    if (request.status !== "pending") return res.status(409).json({ error: "Request already processed" });

    // Mark as rejected first — prevents double-refund if this endpoint is called twice
    const { error: updateErr } = await supabaseAdmin
      .from("redemption_requests")
      .update({ status: "rejected", admin_note: adminNote ?? null })
      .eq("id", id);
    if (updateErr) throw updateErr;

    // Refund credits after status is locked; log but don't fail if RPC errors
    const { error: refundErr } = await supabaseAdmin.rpc("refund_creator_credits", {
      p_user_id: request.user_id,
      p_amount: request.amount,
    });
    if (refundErr) {
      console.error(`Refund failed for rejected request ${id}:`, refundErr.message);
    }

    const brandName = request.brand === "amazon" ? "Amazon India" : "Flipkart";

    await sendEmail(request.user_id, {
      to: request.user_email,
      subject: `Your Cephlow voucher request — update`,
      body: [
        `Hi ${request.creator_name || "there"},`,
        ``,
        `We weren't able to process your ₹${request.amount} ${brandName} voucher request at this time.`,
        adminNote ? `Reason: ${adminNote}` : ``,
        ``,
        `Your ₹${request.amount} in creator credits has been refunded to your account.`,
        `You can submit a new request anytime from the Frame Inventory → Credits tab.`,
        ``,
        `— Cephlow Team`,
      ].filter(Boolean).join("\n"),
    }).catch(() => null);

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
