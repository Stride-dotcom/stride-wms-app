
# Fix: Services Disappearing & Assembly Rates Showing $0.00

## Summary of Issues Found

After investigation, I found **two separate issues**:

1. **"No classes found" message** - This was a **temporary build/deployment state**. The browser session confirms classes are now loading correctly (Extra Small, Small, Medium, Large, Extra Large all display properly).

2. **Assembly services showing $0.00** - This is the **real underlying issue** caused by:
   - The UI stores assembly quantities in a client-side `qty_input` field
   - The database `quote_selected_services` table only has `hours_input` column (no `qty_input`)
   - When quotes are saved, only `hours_input` is persisted
   - When quotes are loaded, `qty_input` is always `null`, resulting in `0 * $250 = $0.00`

---

## Root Cause Analysis

```text
Database Schema (quote_selected_services):
┌────────────────────────────┐
│ id                         │
│ quote_id                   │
│ service_id                 │
│ is_selected                │
│ hours_input        ← exists│
│ computed_billable_qty      │
│ applied_rate_amount        │
│ line_total                 │
│ created_at                 │
│ updated_at                 │
│                            │
│ qty_input          ← MISSING│
└────────────────────────────┘
```

**The Problem Flow:**
1. User enters "1" for Assembly 120m in the Qty field
2. UI stores this in `formData.selected_services[x].qty_input = 1`
3. Save operation runs: `hours_input: ss.hours_input` (line 508)
4. `qty_input` is **never saved** to database
5. Quote reloads: `qty_input` comes back as `null`
6. Calculator: `qtyInput ?? hoursInput ?? 0` = `null ?? null ?? 0` = `0`
7. Result: `0 * $250 = $0.00`

---

## Solution

Use the existing `hours_input` column to store the quantity value for all service types. This avoids a database schema migration while solving the problem.

### Changes Required

**File: `src/hooks/useQuotes.ts`**

1. **Update CREATE quote logic** (around line 505-509):
   - When inserting selected services, use `qty_input` value if available, fall back to `hours_input`
   
2. **Update UPDATE quote logic** (around line 650-660):
   - Same pattern: persist `qty_input` into the `hours_input` database column

3. **Update LOAD quote logic** (around line 212-217):
   - When loading a quote, map `hours_input` from DB to `qty_input` for assembly/per_hour services

**File: `src/pages/QuoteBuilder.tsx`**

4. **Update form data loading** (around line 212-217):
   - Ensure when loading an existing quote, the `qty_input` is populated from the stored `hours_input` value

### Technical Implementation

**In useQuotes.ts - Insert logic (line ~505):**
```typescript
// Before (current):
hours_input: ss.hours_input,

// After (fixed):
hours_input: ss.qty_input ?? ss.hours_input,
```

**In QuoteBuilder.tsx - Load logic (line ~212-217):**
```typescript
// Before (current):
selected_services: data.selected_services.map((ss) => ({
  service_id: ss.service_id,
  is_selected: ss.is_selected,
  hours_input: ss.hours_input,
  qty_input: null,  // ← Always null!
})),

// After (fixed):
selected_services: data.selected_services.map((ss) => ({
  service_id: ss.service_id,
  is_selected: ss.is_selected,
  hours_input: ss.hours_input,
  qty_input: ss.hours_input,  // ← Use hours_input for both
})),
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useQuotes.ts` | Save `qty_input` into `hours_input` column when creating/updating quotes |
| `src/pages/QuoteBuilder.tsx` | Load `hours_input` into `qty_input` when fetching existing quotes |

---

## Expected Result After Fix

When opening an existing quote with assembly services:
- Assembly 120m with Qty=1 will calculate: 1 × $250.00 = $250.00
- Assembly 60m with Qty=2 will calculate: 2 × $140.00 = $280.00
- Values persist correctly across save/reload cycles

---

## Technical Note

The `hours_input` column is repurposed as a generic "quantity input" field. This is semantically imprecise (hours vs quantity) but avoids requiring a database migration. The calculator logic already handles this correctly since it prioritizes `qty_input` over `hours_input` - we just need to ensure the value is persisted and loaded properly.
