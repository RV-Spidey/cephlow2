import { Router } from "express";
import { supabaseAdmin } from "@workspace/supabase";
import { Cashfree, CFEnvironment } from "cashfree-pg";

const router = Router();

const env = process.env.VITE_CASHFREE_ENV === "PRODUCTION" ? CFEnvironment.PRODUCTION : CFEnvironment.SANDBOX;
const cashfree = new Cashfree(
  env,
  process.env.CASHFREE_APP_ID || "",
  process.env.CASHFREE_SECRET_KEY || "",
);

console.log(`[Webhooks Route] Initialized Cashfree SDK in ${process.env.VITE_CASHFREE_ENV === "PRODUCTION" ? "PRODUCTION" : "SANDBOX"} mode with App ID: ${process.env.CASHFREE_APP_ID?.substring(0, 10)}...`);

// GET /api/webhooks/whatsapp — Meta webhook verification challenge
router.get("/webhooks/whatsapp", (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[WhatsApp Webhook] Verification successful");
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: "Verification failed" });
});

// POST /api/webhooks/whatsapp — Meta delivers status updates here
router.post("/webhooks/whatsapp", async (req, res) => {
  // Send 200 OK immediately as required by Meta
  res.sendStatus(200);

  try {
    const body = req.body;
    
    // Log the entire body for debugging
    console.log("[WhatsApp Webhook] Received payload:", JSON.stringify(body));

    if (body?.object !== "whatsapp_business_account") {
      console.log("[WhatsApp Webhook] Object type mismatch:", body?.object);
      return;
    }

    for (const entry of body?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        if (change?.field !== "messages") {
          console.log("[WhatsApp Webhook] Field mismatch:", change?.field);
          continue;
        }

        // Status updates (sent, delivered, read, failed)
        for (const status of change?.value?.statuses ?? []) {
          const wamid: string = status?.id;
          const rawStatus: string = status?.status;

          if (!wamid || !rawStatus) continue;

          console.log(`[WhatsApp Webhook] Processing status: wamid=${wamid} rawStatus=${rawStatus}`);

          const waStatus = rawStatus === "read" ? "read"
            : rawStatus === "delivered" ? "delivered"
            : rawStatus === "failed" ? "wa_failed"
            : null;

          if (!waStatus) {
            console.log(`[WhatsApp Webhook] Skipping status update for rawStatus: ${rawStatus}`);
            continue;
          }

          const { data: msgRow } = await supabaseAdmin
            .from("wa_messages")
            .select("batch_id, cert_id")
            .eq("wamid", wamid)
            .maybeSingle();

          if (!msgRow) {
            console.warn(`[WhatsApp Webhook] wamid not found in DB: ${wamid}`);
            continue;
          }

          const { error: updateErr } = await supabaseAdmin
            .from("certificates")
            .update({ whatsapp_status: waStatus })
            .eq("id", msgRow.cert_id);

          if (updateErr) {
            console.error(`[WhatsApp Webhook] DB update failed:`, updateErr);
          } else {
            console.log(`[WhatsApp Webhook] Updated cert ${msgRow.cert_id} to ${waStatus}`);
          }
        }

        // Incoming messages (could be used for reporting issues)
        if (change?.value?.messages) {
          console.log("[WhatsApp Webhook] Received incoming message(s):", change.value.messages.length);
        }
      }
    }
  } catch (err: unknown) {
    console.error("[WhatsApp Webhook] Error processing payload:", err);
  }
});

// POST /api/webhooks/cashfree — Cashfree payment status webhook
router.post("/webhooks/cashfree", async (req, res) => {
  console.log("[Cashfree Webhook] Received request");
  try {
    const signature = req.headers["x-webhook-signature"] as string;
    const timestamp = req.headers["x-webhook-timestamp"] as string;
    const rawBody = req.rawBody as string;

    if (!signature || !timestamp || !rawBody) {
      return res.status(400).json({ error: "Missing webhook headers/body" });
    }

    try {
      (cashfree as unknown as { PGVerifyWebhookSignature: (sig: string, body: string, ts: string) => void }).PGVerifyWebhookSignature(signature, rawBody, timestamp);
    } catch (err: unknown) {
      console.error("[Cashfree Webhook] Invalid signature:", err instanceof Error ? (err instanceof Error ? err.message : String(err)) : String(err));
      return res.status(401).json({ error: "Invalid signature" });
    }

    const payload = req.body;
    console.log("[Cashfree Webhook] Payload type:", payload.type);

    if (payload.type === "PAYMENT_SUCCESS_WEBHOOK") {
      const { order, payment, customer_details } = payload.data || {};

      if (!order?.order_id || !payment?.payment_status || !customer_details?.customer_id) {
        console.warn("[Cashfree Webhook] Missing fields in payload");
        return res.status(200).send("OK");
      }

      const orderId = order.order_id;
      const amount = payment.payment_amount;
      const customerId = customer_details.customer_id;

      console.log(`[Cashfree Webhook] Processing: Order=${orderId}, Amount=${amount}, User=${customerId}`);

      const { data: rpcResult, error: rpcErr } = await supabaseAdmin.rpc("process_payment", {
        p_user_id: customerId,
        p_order_id: orderId,
        p_amount: amount,
        p_payment_id: payment.cf_payment_id || null,
        p_payment_method: payment.payment_group || null,
      });

      if (rpcErr) {
        console.error("[Cashfree Webhook] RPC error:", rpcErr);
        return res.status(500).json({ error: "Failed to process payment" });
      }

      if ((rpcResult as { status?: string })?.status === "already_processed") {
        console.log(`[Cashfree Webhook] Order ${orderId} already processed.`);
      } else {
        console.log(`[Cashfree Webhook] Credited ₹${amount} to ${customerId} (Order: ${orderId})`);
      }
    }

    return res.status(200).send("OK");
  } catch (err: unknown) {
    console.error("[Cashfree Webhook] Error processing:", err);
    return res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
