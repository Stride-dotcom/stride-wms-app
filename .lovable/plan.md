

# Quote PDF and Excel: Complete Services, Dynamic Branding, Clean Rate Column

## Summary of Changes

Three files will be modified:
1. **`src/lib/quotes/export.ts`** -- PDF/Excel generation with dynamic branding and rate column fix
2. **`src/pages/QuoteBuilder.tsx`** -- Feed complete service data (including class-based) and tenant branding into exports
3. No other files touched

---

## What Changes

### 1. Dynamic Branding from Tenant Settings (not hardcoded)

Currently the quote PDF hardcodes blue `[59, 130, 246]`. The invoice PDF hardcodes orange `[220, 88, 42]`. Neither pulls from the tenant's actual settings.

**Fix:** QuoteBuilder.tsx will fetch:
- **Logo URL** from `tenant_company_settings.logo_url` (already available via `useTenantSettings`)
- **Brand accent color** from `communication_brand_settings.brand_primary_color` (available via `useCommunications`)

These will be passed into the PDF/Excel data so every tenant gets their own branding. The `QuotePdfData` interface will add `companyLogo`, `companyWebsite`, and a new `brandColor` field (hex string). The PDF generator will parse the hex color into RGB and use it as `primaryColor` instead of a hardcoded value. Fallback: `#FD5A2A` (the system default orange).

### 2. Show ALL Services (Class-Based + Non-Class)

**Current bug:** `handleExportPdf` only maps `quote.selected_services` (non-class "Other Services"). Class-based service selections (Receiving per Large, Disposal per Medium, etc.) are calculated in `calculation.service_totals` but never passed to the export.

**Fix:** Build `serviceLines` from `calculation.service_totals` which already contains every service -- both class-based and non-class -- with correct names, rates, quantities, and totals. For class-based services that have per-class detail, we will also iterate `class_service_selections` to produce one row per class (e.g., "Receiving | Large | $15.00 | 10 | $150.00").

### 3. Remove Billing Unit from Rate Column

**Current:** Rate shows `$15.00 / piece`
**Fix:** Rate shows just `$15.00`

Remove the `getBillingUnitLabel()` call from the PDF services table rate column. The billing unit info is unnecessary clutter on a customer-facing document.

### 4. Single-Sheet Excel Matching PDF Layout

Replace the current 3-tab Excel (Summary, Item Quantities, Services) with a single sheet that mirrors the PDF layout: header info at top, class quantities, full services table, totals, and notes -- all on one page.

---

## Column Layout Clarification

The screenshot you shared is just the ASCII text mockup wrapping on your phone screen. The actual PDF uses jsPDF with fixed pixel coordinates, so the columns (Service, Class, Rate, Qty, Total) will render in a clean, aligned table regardless of device. No column layout issue exists in the real PDF output.

---

## Updated PDF Mockup (Markdown Table)

| | |
|---|---|
| **[YOUR LOGO]** | |
| **Your Company Name** | **QUOTE** |
| 123 Warehouse Blvd, Houston TX 77001 | #QT-2025-0042 |
| (555) 123-4567 \| info@company.com | |

---

| PREPARED FOR | QUOTE DETAILS |
|---|---|
| **Acme Corporation** | Quote Date: Feb 11, 2025 |
| Account: ACME-001 | Valid Until: Mar 13, 2025 |
| Contact: John Smith | Storage Days: 30 |
| john@acme.com | Status: Draft |

**Item Quantities by Size Class**

| Size Class | Description | Quantity |
|---|---|---|
| Large | Over 50 cu ft | 10 |
| Medium | 20-50 cu ft | 25 |
| Small | Under 20 cu ft | 15 |
| **Total Items** | | **50** |

**Services**

| Service | Class | Rate | Qty | Total |
|---|---|---|---|---|
| Receiving | Large | $15.00 | 10 | $150.00 |
| Receiving | Medium | $10.00 | 25 | $250.00 |
| Receiving | Small | $5.00 | 15 | $75.00 |
| Disposal | Large | $25.00 | 10 | $250.00 |
| Disposal | Medium | $18.00 | 25 | $450.00 |
| Disposal | Small | $12.00 | 15 | $180.00 |
| Storage | Large | $2.00 | 10 | $600.00 |
| Storage | Medium | $1.50 | 25 | $1,125.00 |
| Storage | Small | $1.00 | 15 | $450.00 |
| Kitting | - | $200.00 | 1 | $200.00 |

| | |
|---|---|
| Subtotal: | $3,730.00 |
| Discount (10%): | -$373.00 |
| Tax (8.25%): | $277.00 |
| **Grand Total:** | **$3,634.00** |

*Notes: Climate controlled storage required for Large items.*

*This quote is valid for 30 days unless otherwise specified.*
*Thank you for your business!*

---

Note: The accent color on divider lines, "QUOTE" header, and "Grand Total" label will use your tenant's brand color (pulled from Settings > Alerts > Template Editor). The logo will render in the top-left corner (pulled from Settings > Organization). Rate column shows dollar amount only -- no "/ piece" or "/ day" suffix.

---

## Technical Details

### File 1: `src/lib/quotes/export.ts`

- Add `brandColor?: string` and `companyLogo?: string` to `QuotePdfData` interface
- In `generateQuotePdf`: parse `data.brandColor` hex to RGB for `primaryColor`, fallback to `[220, 88, 42]`
- Remove `getBillingUnitLabel()` usage from services table rate column -- just show `formatCurrency(line.rate)`
- If `data.companyLogo` is provided, add logo image to top-left of PDF header
- Restructure `exportQuoteToExcel` to produce a single sheet with header, classes, services, totals, and notes sections

### File 2: `src/pages/QuoteBuilder.tsx`

- Import `useTenantSettings` and `useCommunications` hooks
- In `handleExportPdf` and `handleExportExcel`:
  - Build per-class service lines from `calculation` data and `class_service_selections` + `rates` to produce one row per service-class combination
  - Pass `brandColor` from `brandSettings.brand_primary_color`
  - Pass `companyLogo` from `tenantSettings.logo_url`
  - Pass `companyWebsite` from `tenantSettings.company_website`

