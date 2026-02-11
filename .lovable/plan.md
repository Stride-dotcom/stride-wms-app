

# Unified PDF Template Formatting: Quote PDF + Invoice PDF

## Scope Confirmation

This plan applies ALL formatting changes to BOTH templates:

1. **Quote PDF** (`src/lib/quotes/export.ts`) -- already has smart logo sizing, but still needs:
   - Side-by-side logo + company name layout (currently stacked)
   - "WMS" badge in bold brand color
   - Reduced font sizes (24pt to 16pt company name, 28pt to 20pt title)
   - Tightened header spacing (pre-divider 10pt to 4pt, post-divider 10pt to 6pt)
   - Fallback "Warehouse Services" changed to "Your Company"

2. **Invoice PDF** (`src/lib/invoicePdf.ts`) -- needs everything:
   - Async function for smart logo sizing (aspect-ratio-aware, 20x16pt bounding box)
   - Side-by-side logo + company name layout
   - "WMS" badge in bold brand color
   - Brand color support (new `brandColor` field + `parseHexColor` helper)
   - Reduced font sizes (24pt to 16pt company name, 28pt to 20pt title)
   - Tightened header spacing
   - Lower page break threshold (60pt to 25pt)
   - Re-render table headers on new pages
   - Compact footer (font 8 to 7, tighter positioning)
   - Async `downloadInvoicePdf` and `printInvoicePdf`

3. **5 caller files** -- pass `brandColor` and add `await`:
   - `src/pages/Invoices.tsx`
   - `src/components/reports/RevenueLedgerTab.tsx`
   - `src/components/invoices/SavedInvoicesTab.tsx`
   - `src/components/invoices/InvoiceDetailDialog.tsx`
   - `src/components/accounts/AccountInvoicesTab.tsx`

4. **Quote fallback** (`src/lib/quotes/export.ts` line 640) -- change "Warehouse Services" to "Your Company"

---

## Header Layout (applies to BOTH templates identically)

The new header for both Quote and Invoice PDFs will look like this:

```text
+------------------------------------------------------------------+
|                                                                    |
|  [LOGO] Acme Logistics  WMS                        QUOTE          |
|  123 Warehouse Blvd, Houston TX                   #QTE-00006      |
|  (555) 123-4567 | info@acme.com                                   |
|  ________________________[brand color line]_____________________   |
|                                                                    |
```

For the Invoice template, the right side says "INVOICE" and "#INV-00123" instead.

- Logo on the left margin, aspect-ratio-aware (max 20x16pt bounding box)
- Company name (16pt bold, dark gray) immediately to the right of the logo
- "WMS" (16pt bold, brand color) right after the company name on the same baseline
- Address and contact info below (9pt, gray)
- Title ("QUOTE" or "INVOICE") right-aligned at 20pt in brand color
- Document number right-aligned below title at 9pt
- Divider line in brand color, 4pt gap above, 6pt gap below

---

## Detailed File Changes

### File 1: `src/lib/quotes/export.ts` (Quote PDF)

**Header rewrite (lines 126-195):**
- After the existing smart logo measurement (keep as-is), change the rendering:
  - Place logo at `(margin, y - 2)` with measured dimensions (already done)
  - Set `companyNameX = margin + logoDims.w + 4` if logo rendered, else `margin`
  - Company name: change from 24pt to 16pt bold at `(companyNameX, y + 4)`
  - Add "WMS": 16pt bold in `primaryColor`, positioned using `doc.getTextWidth(data.companyName)` to calculate horizontal offset
  - Remove the 22pt vertical gap (`companyNameY = logoRendered ? y + 22 : y` becomes same-line positioning)
  - Address/contact info starts at `y + 10` (below company name line), not `y + 22 + 8`
  - "QUOTE" title: reduce from 28pt to 20pt, position at `margin + 3` instead of `margin + 5`
  - Quote number: 9pt at `margin + 10` instead of 10pt at `margin + 14`
  - Pre-divider gap: `y += 4` (already 10, change to 4)
  - Post-divider gap: `y += 6` (already 10, change to 6)

**Fallback (line 640):**
- Change `'Warehouse Services'` to `'Your Company'`

### File 2: `src/lib/invoicePdf.ts` (Invoice PDF)

**A. Interface update:**
- Add `brandColor?: string` to `InvoicePdfData`

**B. Add `parseHexColor` helper:**
- Copy the same function from quotes/export.ts (supports #RGB, #RRGGBB, falls back to orange)

**C. Make `generateInvoicePdf` async:**
- Change signature to `async function generateInvoicePdf(data: InvoicePdfData): Promise<jsPDF>`
- Use `parseHexColor(data.brandColor)` instead of hardcoded `[220, 88, 42]`
- Add `pageHeight` variable

**D. New header (lines 93-133) -- matching quote layout exactly:**
- Smart logo sizing: load into `Image()`, measure aspect ratio, scale within 20x16pt box
- Side-by-side: logo left, company name (16pt bold) to its right, "WMS" (16pt bold, brand color) after that
- Address/contact info below (9pt gray)
- "INVOICE" right-aligned at 20pt in brand color
- Invoice number right-aligned at 9pt
- Pre-divider gap: 4pt
- Post-divider gap: 6pt

**E. Page break improvements (line 250):**
- Change threshold from `pageHeight - 60` to `pageHeight - 25`
- After page break, re-render table column headers (Service, Description, Qty, Rate, Total)

**F. Compact footer (lines 367-374):**
- Font size 8 to 7
- Position at `pageHeight - 12` instead of `pageHeight - 15`
- Second line at `footerY + 4` instead of `footerY + 5`

**G. Async helpers (lines 412-424):**
- `downloadInvoicePdf` becomes async, awaits `generateInvoicePdf`
- `printInvoicePdf` becomes async, awaits `generateInvoicePdf`

### File 3: `src/pages/Invoices.tsx`

- Import `useCommunications` hook (or wherever `brandSettings` is accessed)
- In `buildPdfData` (line 693): add `brandColor: brandSettings?.brand_primary_color`
- `handleDownloadPdf` and `handlePrintPdf`: add `await` to the now-async calls

### File 4: `src/components/reports/RevenueLedgerTab.tsx`

- Import `useCommunications` for brand settings
- Pass `brandColor` in PDF data construction
- Add `await` to download/print calls

### File 5: `src/components/invoices/SavedInvoicesTab.tsx`

- Import `useCommunications` for brand settings
- Pass `brandColor` in PDF data
- Add `await` to download call

### File 6: `src/components/invoices/InvoiceDetailDialog.tsx`

- Import `useCommunications` for brand settings
- Pass `brandColor` in `generatePdfData`
- Add `await` to download/print calls

### File 7: `src/components/accounts/AccountInvoicesTab.tsx`

- Import `useCommunications` for brand settings
- Pass `brandColor` in PDF data
- Add `await` to download call

---

## Summary: What Both Templates Will Share

| Feature | Quote PDF | Invoice PDF |
|---|---|---|
| Smart logo sizing (aspect-ratio) | Already done, keep | Adding new |
| Side-by-side logo + name | Adding new | Adding new |
| "WMS" bold badge in brand color | Adding new | Adding new |
| Company name 16pt (was 24pt) | Adding new | Adding new |
| Title 20pt (was 28pt) | Adding new | Adding new |
| Brand color from tenant settings | Already done | Adding new |
| Pre-divider gap 4pt (was 10pt) | Adding new | Adding new |
| Post-divider gap 6pt (was 10pt) | Adding new | Adding new |
| Page break threshold 25pt | Already done | Adding new |
| Re-render headers on new page | Already done | Adding new |
| Compact footer (7pt, tighter) | Already done | Adding new |
| Async function | Already done | Adding new |

Total: 7 files modified. Both PDF templates will have identical header formatting.

