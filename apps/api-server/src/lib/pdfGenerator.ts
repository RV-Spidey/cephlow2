import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { supabaseAdmin } from "@workspace/supabase";
import { getTemplateConfig, getBlankPdfBytes, TemplateConfig, PlaceholderConfig } from "./pdfExtractor.js";

const FONTS_DIR = path.resolve("assets/fonts");

// ── In-memory font cache (loaded from disk once, reused for the process lifetime)
const fontCache = new Map<string, Buffer>();

function getStandardFont(fontFamily: string): StandardFonts | null {
  const family = fontFamily.toLowerCase();
  if (family.includes("courier")) {
    if (family.includes("bold")) return StandardFonts.CourierBold;
    return StandardFonts.Courier;
  }
  if (family.includes("helvetica") || family.includes("arial")) {
    if (family.includes("bold")) return StandardFonts.HelveticaBold;
    return StandardFonts.Helvetica;
  }
  if (family.includes("times")) {
    if (family.includes("bold")) return StandardFonts.TimesRomanBold;
    return StandardFonts.TimesRoman;
  }
  return null;
}

/**
 * Loads a font into the in-memory cache.
 * Reads from local disk (which was populated during extractTemplate).
 */
function loadFontToMemory(fontFamily: string): Buffer | null {
  const fontPath = path.join(FONTS_DIR, `${fontFamily}.ttf`);
  const cached = fontCache.get(fontPath);
  if (cached) return cached;

  if (fs.existsSync(fontPath)) {
    const bytes = fs.readFileSync(fontPath);
    fontCache.set(fontPath, bytes);
    return bytes;
  }
  return null;
}

export async function generateCertificatePDF(
  batchId: string,
  certificateId: string,
  recipientName: string,
  replacements: Record<string, string>,
  qrCodeUrl?: string,
  slideIndex: number = 0
): Promise<Uint8Array> {
  // 1. Get template config (from in-memory cache)
  const { data: batch } = await supabaseAdmin
    .from("batches")
    .select("template_id")
    .eq("id", batchId)
    .single();

  const templateId = batch?.template_id;
  if (!templateId) throw new Error("Template ID not found for batch");

  const config = getTemplateConfig(templateId);
  if (!config) throw new Error(`Template config not found in memory for ${templateId}. Re-trigger generation.`);

  const slideConfig = config.slides[slideIndex];
  if (!slideConfig) throw new Error(`Config not found for slide index ${slideIndex} in template ${templateId}`);

  // 2. Load blank PDF (from in-memory cache)
  const templatePdfBytes = getBlankPdfBytes(templateId);
  if (!templatePdfBytes) throw new Error(`Blank PDF not found in memory for template ${templateId}. Re-trigger generation.`);

  const templateDoc = await PDFDocument.load(templatePdfBytes);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [copiedPage] = await pdfDoc.copyPages(templateDoc, [slideIndex]);
  const page = pdfDoc.addPage(copiedPage);

  // 3. Draw placeholders
  for (const placeholder of slideConfig.placeholders) {
    const rawPlaceholder = placeholder.name.trim();
    const isName = rawPlaceholder.toLowerCase() === "name";

    let text = replacements[placeholder.name];
    if (text === undefined) text = replacements[rawPlaceholder];
    if (text === undefined) text = replacements[rawPlaceholder.toLowerCase()];
    if (text === undefined) text = replacements[`<<${rawPlaceholder}>>`];
    if (text === undefined) text = replacements[`{{${rawPlaceholder}}}`];
    if (text === undefined) text = isName ? recipientName : `{{${placeholder.name}}}`;

    text = text || "";
    if (text === "") continue;

    let font;
    const stdFont = getStandardFont(placeholder.fontFamily);
    if (stdFont) {
      font = await pdfDoc.embedFont(stdFont);
    } else {
      // Try to load from in-memory font cache (backed by local disk)
      const fontBytes = loadFontToMemory(placeholder.fontFamily);
      if (fontBytes) {
        font = await pdfDoc.embedFont(fontBytes);
      } else {
        console.warn(`[PDF] Font ${placeholder.fontFamily} not found on disk, falling back to Helvetica-Bold`);
        font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
    }

    let fontSize = placeholder.fontSize;
    let textWidth = font.widthOfTextAtSize(text, fontSize);

    // Dynamic scaling
    while (textWidth > placeholder.width && fontSize > 8) {
      fontSize -= 1;
      textWidth = font.widthOfTextAtSize(text, fontSize);
    }

    // Alignment
    let x = placeholder.x;
    if (placeholder.alignment === "CENTER") {
      x = placeholder.x + (placeholder.width - textWidth) / 2;
    } else if (placeholder.alignment === "END") {
      x = placeholder.x + (placeholder.width - textWidth);
    }

    // Map Slide box top to PDF baseline
    const topPadding = 7.2;
    const approxAscender = fontSize * 0.8;
    const pdfY = config.pageSize.height - (placeholder.y + topPadding + approxAscender);

    page.drawText(text, {
      x,
      y: pdfY,
      size: fontSize,
      font,
      color: rgb(placeholder.color.r, placeholder.color.g, placeholder.color.b),
    });
  }

  // 4. Draw QR Code
  if (slideConfig.qrCode && qrCodeUrl) {
    const qrBuffer = await QRCode.toBuffer(qrCodeUrl, { margin: 0, width: 200 });
    const qrImage = await pdfDoc.embedPng(qrBuffer);

    const qrPdfY = config.pageSize.height - slideConfig.qrCode.y - slideConfig.qrCode.size;
    page.drawImage(qrImage, {
      x: slideConfig.qrCode.x,
      y: qrPdfY,
      width: slideConfig.qrCode.size,
      height: slideConfig.qrCode.size,
    });
  }

  // 5. Return bytes
  return await pdfDoc.save();
}
