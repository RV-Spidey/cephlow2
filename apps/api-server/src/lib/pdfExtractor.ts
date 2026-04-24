import fs from "fs";
import path from "path";
import { google, slides_v1 } from "googleapis";
import { getAuthClientForUser } from "./googleAuth.js";
import { getDriveClient, exportSlidesToPdf } from "./googleDrive.js";
import axios from "axios";

const FONTS_DIR = path.resolve("assets/fonts");

const EMU_PER_PDF_POINT = 12700;

// ── TTL Cache ─────────────────────────────────────────────────────────────────
// A simple cache that evicts entries after `ttlMs` milliseconds of *inactivity*.
// Access (get) refreshes the timer — so an active generation keeps its template
// hot while an abandoned one gets cleaned up automatically.

class TtlCache<T> {
  private cache = new Map<string, { value: T; lastAccessed: number }>();
  private readonly ttlMs: number;
  private readonly cleanupInterval: ReturnType<typeof setInterval>;

  constructor(ttlMs: number, cleanupIntervalMs = 60_000) {
    this.ttlMs = ttlMs;
    this.cleanupInterval = setInterval(() => this.evictExpired(), cleanupIntervalMs);
    // Don't keep the Node.js process alive just for cleanup
    this.cleanupInterval.unref();
  }

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.lastAccessed > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    entry.lastAccessed = Date.now(); // refresh TTL on access
    return entry.value;
  }

  set(key: string, value: T): void {
    this.cache.set(key, { value, lastAccessed: Date.now() });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  get size(): number {
    return this.cache.size;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > this.ttlMs) {
        this.cache.delete(key);
        console.log(`[CACHE] Evicted stale template: ${key} (idle > ${this.ttlMs / 60_000}min)`);
      }
    }
  }
}

// TTL = TEMPLATE_CACHE_TTL_MINUTES env var, default 30 minutes
const CACHE_TTL_MS = parseInt(process.env.TEMPLATE_CACHE_TTL_MINUTES || "30", 10) * 60_000;

// ── In-memory stores ──────────────────────────────────────────────────────────
// Keyed by templateId. Auto-evicted after CACHE_TTL_MS of inactivity.
const templateConfigCache = new TtlCache<TemplateConfig>(CACHE_TTL_MS);
const blankPdfCache = new TtlCache<Buffer>(CACHE_TTL_MS);

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

/** Returns the in-memory template config, or null if not yet extracted. */
export function getTemplateConfig(templateId: string): TemplateConfig | null {
  return templateConfigCache.get(templateId) ?? null;
}

/** Returns the in-memory blank PDF buffer, or null if not yet extracted. */
export function getBlankPdfBytes(templateId: string): Buffer | null {
  return blankPdfCache.get(templateId) ?? null;
}

// ── Extraction deduplication ──────────────────────────────────────────────────
// If two users trigger generation for the same templateId at the same time,
// only ONE extraction runs. All concurrent callers await the same Promise.
const extractionInFlight = new Map<string, Promise<TemplateConfig>>();

/**
 * Ensures the template is in the in-memory cache, extracting it exactly once
 * even when called concurrently. Replaces the old pattern of:
 *   if (!getTemplateConfig(id)) await extractTemplate(uid, id);
 */
export function ensureTemplateInCache(uid: string, templateId: string): Promise<TemplateConfig> {
  // 1. Already cached — return immediately
  const cached = templateConfigCache.get(templateId);
  if (cached) return Promise.resolve(cached);

  // 2. Extraction already running — join it
  const inFlight = extractionInFlight.get(templateId);
  if (inFlight) {
    console.log(`[EXTRACT] Joining in-flight extraction for ${templateId}`);
    return inFlight;
  }

  // 3. Start a new extraction and register it so concurrent callers can join
  console.log(`[EXTRACT] Starting extraction for ${templateId}`);
  const promise = extractTemplate(uid, templateId).finally(() => {
    extractionInFlight.delete(templateId);
  });

  extractionInFlight.set(templateId, promise);
  return promise;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Ensures the font is on disk (shared across all templates).
 * Returns the filename if successful, null otherwise.
 */
async function ensureFontOnDisk(fontFamily: string, isBold: boolean = false): Promise<string | null> {
  const fileName = `${fontFamily}${isBold ? "-Bold" : ""}.ttf`;
  const fontPath = path.join(FONTS_DIR, fileName);
  if (fs.existsSync(fontPath)) {
    console.log(`[FONT] ✅ Already on disk: ${fileName}`);
    return fileName;
  }

  console.log(`[FONT] Downloading: ${fontFamily} (Bold: ${isBold})`);
  try {
    let query = isBold ? `${fontFamily}:wght@700` : fontFamily;
    let searchUrl = `https://fonts.googleapis.com/css2?family=${query.replace(/\s+/g, "+")}`;
    let cssRes;

    try {
      cssRes = await axios.get(searchUrl);
    } catch (e: unknown) {
      if (isBold && (e as { response?: { status?: number } }).response?.status === 400) {
        console.warn(`[FONT] Bold variant for ${fontFamily} failed (400). Falling back to regular.`);
        query = fontFamily;
        searchUrl = `https://fonts.googleapis.com/css2?family=${query.replace(/\s+/g, "+")}`;
        cssRes = await axios.get(searchUrl);
      } else {
        throw e;
      }
    }

    const fontUrlMatch = cssRes.data.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
    if (fontUrlMatch && fontUrlMatch[1]) {
      if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });
      const fontRes = await axios.get(fontUrlMatch[1], { responseType: "arraybuffer" });
      fs.writeFileSync(fontPath, Buffer.from(fontRes.data));
      console.log(`[FONT] ✅ Downloaded and saved: ${fileName}`);
      return fileName;
    }
  } catch (err: unknown) {
    console.warn(`[FONT] ❌ Failed to download ${fontFamily}: ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

// ── Main extraction ────────────────────────────────────────────────────────────

/**
 * Extracts a Google Slides template:
 * - Downloads missing fonts to disk (persistent, shared across templates)
 * - Stores TemplateConfig and blank PDF bytes in memory only
 */
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

        const run = textElements.find((te: slides_v1.Schema$TextElement) => te.textRun?.style);
        const style = run?.textRun?.style || {};

        let alignment = "START";
        let explicitAlignmentFound = false;
        for (const te of textElements) {
          if (te.paragraphMarker?.style?.alignment) {
            alignment = te.paragraphMarker.style.alignment;
            explicitAlignmentFound = true;
          }
        }

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

        const fontKey = `${fontFamily}${isBold ? ":bold" : ""}${isItalic ? ":italic" : ""}`;
        fontsToDownload.add(fontKey);

        let fontFileName = fontFamily;
        if (isBold && isItalic) fontFileName += "-BoldItalic";
        else if (isBold) fontFileName += "-Bold";
        else if (isItalic) fontFileName += "-Italic";

        placeholders.push({
          name, x, y, width, height, fontSize,
          fontFamily: fontFileName,
          alignment,
          color: { r: rgb.red || 0, g: rgb.green || 0, b: rgb.blue || 0 },
        });
      }
    }
    slidesConfig[i] = { placeholders, qrCode };
  }

  // ── Ensure all fonts are on disk (download if needed) ──────────────────────
  for (const fontKey of fontsToDownload) {
    const [family, ...modifiers] = fontKey.split(":");
    const isBold = modifiers.includes("bold");
    await ensureFontOnDisk(family, isBold);
  }

  // ── Build blank PDF in memory (no disk write) ──────────────────────────────
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
        const content =
          (el.shape as slides_v1.Schema$Shape)?.text?.textElements
            ?.map((te: slides_v1.Schema$TextElement) => te.textRun?.content || "")
            .join("") || "";
        if (
          content.match(/<<([^>]+)>>|{{([^}]+)}}/) ||
          el.title === "<<qr_code>>" ||
          el.title === "{{qr_code}}"
        ) {
          deleteRequests.push({ deleteObject: { objectId: el.objectId } });
        }
      }
    }
    if (deleteRequests.length > 0) {
      await slides.presentations.batchUpdate({
        presentationId: copyId,
        requestBody: { requests: deleteRequests },
      });
    }

    const pdfBuffer = await exportSlidesToPdf(uid, copyId);

    const config: TemplateConfig = { templateId, pageSize, slides: slidesConfig };

    // ── Store in memory ────────────────────────────────────────────────────────
    templateConfigCache.set(templateId, config);
    blankPdfCache.set(templateId, pdfBuffer);
    console.log(`[EXTRACT] ✅ Template ${templateId} cached in memory (config + blank PDF).`);

    return config;
  } finally {
    await drive.files.delete({ fileId: copyId }).catch(() => {});
  }
}
