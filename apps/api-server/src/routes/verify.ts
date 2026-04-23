import { Router, type IRouter } from "express";
import { supabaseAdmin } from "@workspace/supabase";
import QRCode from "qrcode";
import { getR2PublicUrl } from "../lib/cloudflareR2.js";

const router: IRouter = Router();

// Public endpoint — no auth required
router.get("/verify/:batchId/:certId", async (req, res) => {
  const { batchId, certId } = req.params;
  console.log(`[VERIFY] Request for batchId=${batchId}, certId=${certId}`);

  try {
    const { data, error } = await supabaseAdmin
      .from("certificates")
      .select("*, batches(name)")
      .eq("id", certId)
      .maybeSingle();

    if (error) {
      console.error(`[VERIFY] DB Error:`, error.message);
      return res.status(500).json({ error: "Internal server error during verification" });
    }

    if (!data) {
      console.warn(`[VERIFY] Certificate not found: ${certId}`);
      return res.status(404).json({ error: "Certificate record not found." });
    }

    // Verify that the batch ID matches if provided (Security check)
    if (batchId && data.batch_id !== batchId) {
        console.warn(`[VERIFY] Batch ID mismatch! URL has ${batchId}, DB has ${data.batch_id}`);
        return res.status(400).json({ error: "Invalid verification link (Batch mismatch)." });
    }

    const { batches, ...cert } = data as any;
    console.log(`[VERIFY] Success: Found cert for ${cert.recipient_name}, status=${cert.status}`);

    let r2PdfUrl = cert.r2_pdf_url || null;
    if (!r2PdfUrl && cert.recipient_name) {
      const fileName = `${cert.recipient_name.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_")}_${certId.substring(0, 8)}.pdf`;
      const key = `certificates/${batchId}/${fileName}`;
      r2PdfUrl = getR2PublicUrl(key);
    }

    res.json({
      id: certId,
      recipientName: cert.recipient_name,
      status: cert.status,
      batchName: batches?.name,
      issuedAt: cert.sent_at || cert.created_at,
      r2PdfUrl,
      pdfUrl: cert.pdf_url || null,
      slideUrl: cert.slide_url || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// QR code image for a certificate verification URL
router.get("/verify/:batchId/:certId/qr", async (req, res) => {
  try {
    const { batchId, certId } = req.params;
    const baseUrl = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
    const verifyUrl = `${baseUrl}/verify/${batchId}/${certId}`;

    const qrBuffer = await QRCode.toBuffer(verifyUrl, { type: "png", width: 300, margin: 2 });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(qrBuffer);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
