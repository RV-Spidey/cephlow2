import fs from "fs";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { supabaseAdmin } from "@workspace/supabase";
import { getTemplateConfig, TemplateConfig, PlaceholderConfig } from "./pdfExtractor.js";

const LOCAL_OUTPUT_DIR = path.resolve("local_output");
const FONTS_DIR = path.resolve("assets/fonts");

// In-Memory Caches
const templateCache = new Map<string, Buffer>();
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

export async function generateCertificatePDF(
  batchId: string,
  certificateId: string,
  recipientName: string,
  replacements: Record<string, string>,
  qrCodeUrl?: string,
  slideIndex: number = 0
): Promise<string> {
  // 1. Get template config
  const { data: batch } = await supabaseAdmin
    .from("batches")
    .select("template_id")
    .eq("id", batchId)
    .single();
  
  const templateId = batch?.template_id;
  if (!templateId) throw new Error("Template ID not found for batch");

  const config = await getTemplateConfig(templateId);
  if (!config) throw new Error(`Config not found for template ${templateId}`);

  const slideConfig = config.slides[slideIndex];
  if (!slideConfig) throw new Error(`Config not found for slide index ${slideIndex} in template ${templateId}`);

  // 2. Load blank PDF
  let templatePdfBytes = templateCache.get(config.blankPdfPath);
  if (!templatePdfBytes) {
    templatePdfBytes = fs.readFileSync(path.resolve(config.blankPdfPath));
    templateCache.set(config.blankPdfPath, templatePdfBytes);
  }
  const templateDoc = await PDFDocument.load(templatePdfBytes);
  
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const [copiedPage] = await pdfDoc.copyPages(templateDoc, [slideIndex]);
  const page = pdfDoc.addPage(copiedPage);

  // 3. Draw Placeholders
  for (const placeholder of slideConfig.placeholders) {
    const rawPlaceholder = placeholder.name.trim();
    const isName = rawPlaceholder.toLowerCase() === "name";
    
    let text = replacements[placeholder.name];
    if (text === undefined) text = replacements[rawPlaceholder];
    if (text === undefined) text = replacements[rawPlaceholder.toLowerCase()];
    if (text === undefined) text = replacements[`<<${rawPlaceholder}>>`];
    if (text === undefined) text = replacements[`{{${rawPlaceholder}}}`];
    if (text === undefined) text = isName ? recipientName : `{{${placeholder.name}}}`;
    
    // Ensure we don't pass undefined/null to drawText
    text = text || "";
    if (text === "") continue; // Skip drawing if empty
    
    let font;
    const stdFont = getStandardFont(placeholder.fontFamily);
    if (stdFont) {
      font = await pdfDoc.embedFont(stdFont);
    } else {
      const fontPath = path.join(FONTS_DIR, `${placeholder.fontFamily}.ttf`);
      if (fs.existsSync(fontPath)) {
        let fontBytes = fontCache.get(fontPath);
        if (!fontBytes) {
          fontBytes = fs.readFileSync(fontPath);
          fontCache.set(fontPath, fontBytes);
        }
        font = await pdfDoc.embedFont(fontBytes);
      } else {
        console.warn(`[PDF] Font ${placeholder.fontFamily} not found, falling back to Helvetica-Bold`);
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

    // Alignment adjustment
    let x = placeholder.x;
    if (placeholder.alignment === "CENTER") {
      x = placeholder.x + (placeholder.width - textWidth) / 2;
    } else if (placeholder.alignment === "END") {
      x = placeholder.x + (placeholder.width - textWidth);
    }

    // Map Slide box top to PDF baseline
    // Google Slides uses a default top padding of 0.1 inches (~7.2 points)
    // We approximate the ascender as 80% of the font size to prevent fonts with 
    // large bounding boxes (like script fonts) from pushing the text down inconsistently.
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

  // 5. Save locally
  const finalPdfBytes = await pdfDoc.save();
  const outputPath = path.join(LOCAL_OUTPUT_DIR, `${certificateId}.pdf`);
  fs.writeFileSync(outputPath, finalPdfBytes);

  return outputPath;
}
