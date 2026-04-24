import fs from "fs";
import path from "path";
import { google, slides_v1 } from "googleapis";
import { getAuthClientForUser } from "./googleAuth.js";
import { getDriveClient, exportSlidesToPdf } from "./googleDrive.js";
import axios from "axios";

const TEMPLATES_JSON = path.resolve("assets/templates.json");
const TEMPLATES_DIR = path.resolve("assets/templates");
const FONTS_DIR = path.resolve("assets/fonts");

const EMU_PER_PDF_POINT = 12700; 

export interface PlaceholderConfig {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
  alignment: string;
  color: { r: number; g: number; b: number };
}

export interface TemplateConfig {
  templateId: string;
  pageSize: { width: number; height: number };
  slides: Record<number, {
    placeholders: PlaceholderConfig[];
    qrCode?: { x: number; y: number; size: number };
  }>;
  blankPdfPath: string;
}

export async function getTemplateConfig(templateId: string): Promise<TemplateConfig | null> {
  if (!fs.existsSync(TEMPLATES_JSON)) return null;
  const data = JSON.parse(fs.readFileSync(TEMPLATES_JSON, "utf-8"));
  return data[templateId] || null;
}

export async function saveTemplateConfig(templateId: string, config: TemplateConfig) {
  let data: Record<string, TemplateConfig> = {};
  if (fs.existsSync(TEMPLATES_JSON)) {
    data = JSON.parse(fs.readFileSync(TEMPLATES_JSON, "utf-8"));
  }
  data[templateId] = config;
  fs.writeFileSync(TEMPLATES_JSON, JSON.stringify(data, null, 2));
}

async function downloadFont(fontFamily: string, isBold: boolean = false) {
  const fileName = `${fontFamily}${isBold ? '-Bold' : ''}.ttf`;
  const fontPath = path.join(FONTS_DIR, fileName);
  if (fs.existsSync(fontPath)) return fileName;

  console.log(`[FONT] Attempting to download font: ${fontFamily} (Bold: ${isBold})`);
  try {
    let query = isBold ? `${fontFamily}:wght@700` : fontFamily;
    let searchUrl = `https://fonts.googleapis.com/css2?family=${query.replace(/\s+/g, '+')}`;
    let cssRes;
    
    try {
      cssRes = await axios.get(searchUrl);
    } catch (e: unknown) {
      if (isBold && (e as { response?: { status?: number } }).response?.status === 400) {
        console.warn(`[FONT] Bold variant for ${fontFamily} failed (400). Falling back to regular.`);
        query = fontFamily;
        searchUrl = `https://fonts.googleapis.com/css2?family=${query.replace(/\s+/g, '+')}`;
        cssRes = await axios.get(searchUrl);
      } else {
        throw e;
      }
    }

    const fontUrlMatch = cssRes.data.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (fontUrlMatch && fontUrlMatch[1]) {
      const fontRes = await axios.get(fontUrlMatch[1], { responseType: 'arraybuffer' });
      fs.writeFileSync(fontPath, Buffer.from(fontRes.data));
      console.log(`[FONT] Successfully downloaded ${fileName}`);
      return fileName;
    }
  } catch (err: unknown) {
    console.warn(`[FONT] Failed to download ${fontFamily}: ${(err instanceof Error ? err.message : String(err))}`);
  }
  return null;
}

export async function extractTemplate(uid: string, templateId: string): Promise<TemplateConfig> {
  console.log(`[EXTRACT] Starting extraction for template: ${templateId}`);
  const auth = await getAuthClientForUser(uid);
  const slides = google.slides({ version: "v1", auth });
  const drive = await getDriveClient(uid);

  const pres = await slides.presentations.get({ presentationId: templateId });
  const pageSize = {
    width: (pres.data.pageSize?.width?.magnitude || 9144000) / EMU_PER_PDF_POINT,
    height: (pres.data.pageSize?.height?.magnitude || 5143500) / EMU_PER_PDF_POINT,
  };

  const slidesConfig: TemplateConfig["slides"] = {};
  const fontsToDownload = new Set<string>();

  const presSlides = pres.data.slides || [];
  for (let i = 0; i < presSlides.length; i++) {
    const slide = presSlides[i];
    const placeholders: PlaceholderConfig[] = [];
    let qrCode: { x: number; y: number; size: number } | undefined;

    for (const element of slide.pageElements || []) {
      const transform = element.transform || {};
      const size = element.size || {};
      const scaleX = transform.scaleX || 1;
      const scaleY = transform.scaleY || 1;

      const x = (transform.translateX || 0) / EMU_PER_PDF_POINT;
      const y = (transform.translateY || 0) / EMU_PER_PDF_POINT;
      const width = ((size.width?.magnitude || 0) * scaleX) / EMU_PER_PDF_POINT;
      const height = ((size.height?.magnitude || 0) * scaleY) / EMU_PER_PDF_POINT;

      if (element.title === "<<qr_code>>" || element.title === "{{qr_code}}") {
        qrCode = { x, y, size: Math.min(width, height) };
        continue;
      }

      const textElements = element.shape?.text?.textElements || [];
      const content = textElements.map((te: slides_v1.Schema$TextElement) => te.textRun?.content || "").join("");
      const placeholderMatch = content.match(/<<([^>]+)>>|{{([^}]+)}}/);

      if (placeholderMatch) {
        const name = placeholderMatch[1] || placeholderMatch[2];
        
        // Find first text run with style
        const run = textElements.find((te: slides_v1.Schema$TextElement) => te.textRun?.style);
        const style = run?.textRun?.style || {};
        
        // Find alignment by checking all paragraph markers
        let alignment = "START";
        let explicitAlignmentFound = false;
        for (const te of textElements) {
          if (te.paragraphMarker?.style?.alignment) {
            alignment = te.paragraphMarker.style.alignment;
            explicitAlignmentFound = true;
          }
        }

        // Heuristic: If no explicit alignment is set, but the shape is a known centered placeholder, default to CENTER
        if (!explicitAlignmentFound && element.shape?.placeholder) {
          const pType = element.shape.placeholder.type;
          if (pType === "SUBTITLE" || pType === "CENTER_TITLE" || pType === "TITLE") {
            alignment = "CENTER";
          }
        }

        const fontSize = style.fontSize?.magnitude || 14;
        const fontFamily = style.fontFamily || "Arial";
        const isBold = style.bold || false;
        const isItalic = style.italic || false;
        const rgb = style.foregroundColor?.opaqueColor?.rgbColor || { red: 0, green: 0, blue: 0 };

        const fontKey = `${fontFamily}${isBold ? ':bold' : ''}${isItalic ? ':italic' : ''}`;
        fontsToDownload.add(fontKey);

        let fontFileName = fontFamily;
        if (isBold && isItalic) fontFileName += "-BoldItalic";
        else if (isBold) fontFileName += "-Bold";
        else if (isItalic) fontFileName += "-Italic";

        placeholders.push({
          name, x, y, width, height, fontSize, 
          fontFamily: fontFileName,
          alignment,
          color: { r: rgb.red || 0, g: rgb.green || 0, b: rgb.blue || 0 }
        });
      }
    }
    slidesConfig[i] = { placeholders, qrCode };
  }

  for (const fontKey of fontsToDownload) {
    const [family, bold] = fontKey.split(':');
    await downloadFont(family, !!bold);
  }

  // Create blank PDF
  const copy = await drive.files.copy({
    fileId: templateId,
    requestBody: { name: `TEMP_BLANK_${templateId}` },
  });
  const copyId = copy.data.id!;

  try {
    const copyPres = await slides.presentations.get({ presentationId: copyId });
    const deleteRequests: slides_v1.Schema$Request[] = [];
    for (const slide of copyPres.data.slides || []) {
      for (const el of slide.pageElements || []) {
        const content = (el.shape as slides_v1.Schema$Shape)?.text?.textElements?.map((te: slides_v1.Schema$TextElement) => te.textRun?.content || "").join("") || "";
        if (content.match(/<<([^>]+)>>|{{([^}]+)}}/) || el.title === "<<qr_code>>" || el.title === "{{qr_code}}") {
          deleteRequests.push({ deleteObject: { objectId: el.objectId } });
        }
      }
    }
    if (deleteRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId: copyId,
        requestBody: { requests: deleteRequests }
      });
    }

    const pdfBuffer = await exportSlidesToPdf(uid, copyId);
    const blankPdfPath = path.join(TEMPLATES_DIR, `${templateId}_blank.pdf`);
    fs.writeFileSync(blankPdfPath, pdfBuffer);

    const config: TemplateConfig = {
      templateId, pageSize, slides: slidesConfig,
      blankPdfPath: `assets/templates/${templateId}_blank.pdf`
    };

    await saveTemplateConfig(templateId, config);
    return config;
  } finally {
    await drive.files.delete({ fileId: copyId }).catch(() => {});
  }
}
