# Objective
Migrate the certificate generation system from a Google Slides-based rendering engine to a high-performance, automated, in-memory PDF rendering architecture using `pdf-lib`. The system will automatically extract templates and configuration from Google Slides on the first run, and then perform blazing-fast generation locally for all subsequent certificates in a batch.

# Key Files & Context
- `apps/api-server/src/routes/certificates.ts` (API routes for generation trigger)
- `apps/api-server/src/lib/googleDrive.ts` / `googleapis` (Used for API calls to Google Slides/Drive)
- `apps/api-server/package.json` (Needs `pdf-lib`, `@pdf-lib/fontkit` added)
- `apps/api-server/assets/templates/` (Target directory for extracted blank PDFs)
- `apps/api-server/assets/templates.json` (Target JSON file for storing X/Y coordinates and formatting)
- `apps/api-server/assets/fonts/` (Target directory for dynamically downloaded fonts)
- `apps/api-server/local_output/` (Target directory for manually reviewing generated PDFs)

# Implementation Steps

## Phase 1: Automated Smart Setup (Extraction)
1.  **Google Slides Parsing:** When generation is requested for a batch, check if `assets/templates.json` contains configuration for this template ID. If not:
2.  **Scan for Placeholders:** Read the Google Slide using the Slides API. Identify text placeholders (e.g., `{{name}}`, `{{date}}`) and the QR code placeholder shape.
3.  **Extract Coordinates & Formatting:** For each identified element, calculate and extract:
    - `x` and `y` coordinates (converting EMU/Points to PDF points).
    - Bounding box `width` and `height` (for text scaling).
    - `fontFamily` and `fontSize` (base size).
    - `alignment` (left, center, right).
4.  **Font Acquisition:** Inspect the extracted fonts. If the corresponding `.ttf` or `.otf` file is not in `assets/fonts/`, fetch it via the Google Fonts API and save it locally.
5.  **Blank Template Export:**
    - Duplicate the presentation temporarily.
    - Delete the placeholder elements (text boxes, QR code shape) from the duplicate.
    - Export the blank slides as high-quality PDF files to `assets/templates/`.
    - Delete the temporary duplicate presentation.
6.  **Save Mapping:** Save the extracted coordinate, size, and font mapping to `assets/templates.json` indexed by template/batch ID.

## Phase 2: In-Memory Rendering Engine
1.  **Install Dependencies:** Run `npm install pdf-lib @pdf-lib/fontkit` in `apps/api-server`.
2.  **Engine Initialization:** Create `apps/api-server/src/lib/pdfGenerator.ts`.
3.  **Load Assets:** The engine reads the `templates.json` configuration, loads the corresponding blank PDF into memory using `PDFDocument.load()`, and registers `@pdf-lib/fontkit`. It loads the required `.ttf`/`.otf` files from disk into memory.
4.  **Intelligent Text Scaling:** 
    - For each text placeholder, calculate `font.widthOfTextAtSize(text, fontSize)`.
    - While the width exceeds the mapped bounding box width, iteratively reduce the `fontSize`.
    - Draw the text using `page.drawText()` at the mapped coordinates and final scaled size.
5.  **QR Code Embedding:** 
    - Generate a QR code buffer dynamically using the `qrcode` library.
    - Embed the image into the document via `pdfDoc.embedPng()`.
    - Draw the image at the mapped `x`, `y` coordinates and `size`.

## Phase 3: API Integration & Local Output
1.  **Update Endpoint:** Modify the certificate generation logic to invoke the new `pdfGenerator.ts` module instead of the old slide-duplication method.
2.  **Local Storage (Testing):** Instead of uploading to Cloudflare R2, call `pdfDoc.save()` and write the resulting `Uint8Array` to `apps/api-server/local_output/<certificate_id>.pdf`.
3.  **Return Local Path:** The API returns the local file paths to verify generation success.

# Verification & Testing
- The system must correctly identify placeholders and export a clean, blank background PDF from Google Slides.
- The correct `.ttf` fonts must be downloaded into `assets/fonts/`.
- Text must be mathematically scaled down if it exceeds the bounding box, preventing overflow.
- The output PDFs in `local_output/` must be manually reviewed to confirm pixel-perfect accuracy against the original Google Slide design.
- The generation speed for a batch should be measured (it should be orders of magnitude faster than the previous API-based approach).

# Migration & Rollback
- The old certificate generation logic should be kept intact (perhaps behind a feature flag or as a fallback function) until the new pipeline is fully validated.
- We will test on a dummy batch before running on production data. Cloudflare R2 upload logic will be implemented in a subsequent phase after local testing passes.
