import fs from "fs";
import path from "path";
import { google, slides_v1 } from "googleapis";
import { getAuthClientForUser } from "./googleAuth.js";
import { getDriveClient, exportSlidesToPdf } from "./googleDrive.js";
import axios from "axios";

const FONTS_DIR = path.resolve("assets/fonts");
const CACHE_DIR = path.resolve("assets/templates/.cache");

const EMU_PER_PDF_POINT = 12700;

// ── TTL Cache ─────────────────────────────────────────────────────────────────
class TtlCache<T> {
  private cache = new Map<string, { value: T; lastAccessed: number }>();
  private readonly ttlMs: number;
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(ttlMs: number, cleanupIntervalMs = 60_000) {
    this.ttlMs = ttlMs;
    this.cleanupInterval = setInterval(() => this.evictExpired(), cleanupIntervalMs);
    this.cleanupInterval.unref();
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.lastAccessed > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, { value, lastAccessed: Date.now() });
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > this.ttlMs) {
        this.cache.delete(key);
        // Optional: Also delete from disk if we want to be super clean, 
        // but keeping it on disk for the duration of the server process is usually fine.
      }
    }
  }
}

const CACHE_TTL_MS = parseInt(process.env.TEMPLATE_CACHE_TTL_MINUTES || "30", 10) * 60_000;

// In-memory stores (local to each thread)
const templateConfigCache = new TtlCache<TemplateConfig>(CACHE_TTL_MS);
const blankPdfCache = new TtlCache<Uint8Array>(CACHE_TTL_MS);

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
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getTemplateConfig(templateId: string): TemplateConfig | null {
  return templateConfigCache.get(templateId) ?? null;
}

export function getBlankPdfBytes(templateId: string): Uint8Array | null {
  return blankPdfCache.get(templateId) ?? null;
}

// ── Extraction & Caching Logic ────────────────────────────────────────────────

const extractionInFlight = new Map<string, Promise<TemplateConfig>>();

/**
 * Ensures the template is in the LOCAL thread memory.
 * Uses disk as a bridge to avoid multiple threads calling Google APIs.
 */
export async function ensureTemplateInCache(uid: string, templateId: string): Promise<TemplateConfig> {
  // 1. Check local memory
  const cached = templateConfigCache.get(templateId);
  if (cached) return cached;

  // 2. Check for in-flight extraction (to avoid parallel extractions in the SAME thread)
  const inFlight = extractionInFlight.get(templateId);
  if (inFlight) return inFlight;

  const promise = (async () => {
    try {
      // 3. Check Disk Bridge (to avoid parallel extractions in DIFFERENT threads)
      if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
      const configPath = path.join(CACHE_DIR, `${templateId}.json`);
      const pdfPath = path.join(CACHE_DIR, `${templateId}.pdf`);

      if (fs.existsSync(configPath) && fs.existsSync(pdfPath)) {
        console.log(`[CACHE] 📂 Loading template ${templateId} from disk bridge`);
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const pdfBytes = fs.readFileSync(pdfPath);
        templateConfigCache.set(templateId, config);
        blankPdfCache.set(templateId, new Uint8Array(pdfBytes));
        return config;
      }

      // 4. Extract from Google (First thread to get here wins)
      return await extractTemplate(uid, templateId);
    } finally {
      extractionInFlight.delete(templateId);
    }
  })();

  extractionInFlight.set(templateId, promise);
  return promise;
}

async function ensureFontOnDisk(fontFamily: string, isBold: boolean = false): Promise<string | null> {
  const fileName = `${fontFamily}${isBold ? "-Bold" : ""}.ttf`;
  const fontPath = path.join(FONTS_DIR, fileName);
  if (fs.existsSync(fontPath)) return fileName;

  console.log(`[FONT] Downloading: ${fontFamily} (Bold: ${isBold})`);
  try {
    let query = isBold ? `${fontFamily}:wght@700` : fontFamily;
    let searchUrl = `https://fonts.googleapis.com/css2?family=${query.replace(/\s+/g, "+")}`;
    let cssRes = await axios.get(searchUrl);

    const fontUrlMatch = cssRes.data.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (fontUrlMatch && fontUrlMatch[1]) {
      if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });
      const fontRes = await axios.get(fontUrlMatch[1], { responseType: "arraybuffer" });
      fs.writeFileSync(fontPath, Buffer.from(fontRes.data));
      return fileName;
    }
  } catch (err) {
    console.warn(`[FONT] Failed to download ${fontFamily}`);
  }
  return null;
}

export async function extractTemplate(uid: string, templateId: string): Promise<TemplateConfig> {
  console.log(`[EXTRACT] ☁️ Fetching template ${templateId} from Google Drive`);
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
      const x = (element.transform?.translateX || 0) / EMU_PER_PDF_POINT;
      const y = (element.transform?.translateY || 0) / EMU_PER_PDF_POINT;
      const width = ((element.size?.width?.magnitude || 0) * (element.transform?.scaleX || 1)) / EMU_PER_PDF_POINT;
      const height = ((element.size?.height?.magnitude || 0) * (element.transform?.scaleY || 1)) / EMU_PER_PDF_POINT;

      if (element.title === "<<qr_code>>" || element.title === "{{qr_code}}") {
        qrCode = { x, y, size: Math.min(width, height) };
        continue;
      }

      const textElements = element.shape?.text?.textElements || [];
      const content = textElements.map((te) => te.textRun?.content || "").join("");
      const match = content.match(/<<([^>]+)>>|{{([^}]+)}}/);

      if (match) {
        const name = match[1] || match[2];
        const style = textElements.find((te) => te.textRun?.style)?.textRun?.style || {};
        
        let alignment = "START";
        for (const te of textElements) {
          if (te.paragraphMarker?.style?.alignment) {
            alignment = te.paragraphMarker.style.alignment;
          }
        }
        if (alignment === "START" && element.shape?.placeholder?.type?.includes("TITLE")) alignment = "CENTER";

        const fontSize = style.fontSize?.magnitude || 14;
        const fontFamily = style.fontFamily || "Arial";
        const isBold = !!style.bold;
        const isItalic = !!style.italic;
        const rgb = style.foregroundColor?.opaqueColor?.rgbColor || { red: 0, green: 0, blue: 0 };

        fontsToDownload.add(`${fontFamily}:${isBold ? "bold" : ""}`);

        placeholders.push({
          name, x, y, width, height, fontSize,
          fontFamily: `${fontFamily}${isBold ? "-Bold" : ""}${isItalic ? "-Italic" : ""}`,
          alignment,
          color: { r: rgb.red || 0, g: rgb.green || 0, b: rgb.blue || 0 }
        });
      }
    }
    slidesConfig[i] = { placeholders, qrCode };
  }

  for (const fontKey of fontsToDownload) {
    const [family, bold] = fontKey.split(":");
    await ensureFontOnDisk(family, !!bold);
  }

  const copy = await drive.files.copy({ fileId: templateId, requestBody: { name: `TEMP_${templateId}` } });
  const copyId = copy.data.id!;

  try {
    const copyPres = await slides.presentations.get({ presentationId: copyId });
    const requests: slides_v1.Schema$Request[] = [];
    for (const slide of copyPres.data.slides || []) {
      for (const el of slide.pageElements || []) {
        const content = (el.shape as any)?.text?.textElements?.map((te: any) => te.textRun?.content || "").join("") || "";
        if (content.match(/<<([^>]+)>>|{{([^}]+)}}/) || el.title?.includes("qr_code")) {
          requests.push({ deleteObject: { objectId: el.objectId } });
        }
      }
    }
    if (requests.length > 0) {
      await slides.presentations.batchUpdate({ presentationId: copyId, requestBody: { requests } });
    }

    const pdfBuffer = await exportSlidesToPdf(uid, copyId);
    const config: TemplateConfig = { templateId, pageSize, slides: slidesConfig };

    // ── Save to Disk Bridge ───────────────────────────────────────────────────
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(path.join(CACHE_DIR, `${templateId}.json`), JSON.stringify(config));
    fs.writeFileSync(path.join(CACHE_DIR, `${templateId}.pdf`), pdfBuffer);

    // ── Save to Memory ───────────────────────────────────────────────────────
    templateConfigCache.set(templateId, config);
    blankPdfCache.set(templateId, new Uint8Array(pdfBuffer));

    console.log(`[EXTRACT] ✅ Template ${templateId} extracted and bridged to disk.`);
    return config;
  } finally {
    await drive.files.delete({ fileId: copyId }).catch(() => {});
  }
}
