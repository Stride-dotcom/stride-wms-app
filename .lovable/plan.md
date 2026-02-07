

# Implementation Plan: Class-Based Rates Table + "No Charge" Pricing Method

## Scope

Two feature changes and one form reorganization, all in a single file:
- **`src/components/settings/pricing/AddServiceForm.tsx`**

---

## Change 1: Class-Based Rates -- Card Grid to Table

### Current State (lines 938-1012)
A 2x3 card grid showing a class badge + rate input per class. Service time is a single shared field at the bottom (not per-class).

### New Layout
A proper table using the existing `Table` components from `@/components/ui/table`:

```text
RATES BY ITEM CLASS
+--------+--------------+----------------+--------------------+
| Class  | Name         | Rate ($)       | Service Time (min) |
+--------+--------------+----------------+--------------------+
| XS     | Extra Small  | [$ 10.00 ]     | [  5  ]            |
| S      | Small        | [$ 25.00 ]     | [  5  ]            |
| M      | Medium       | [$ 50.00 ]     | [  9  ]            |
| L      | Large        | [$ 100.00]     | [  10 ]            |
| XL     | Extra Large  | [$ 185.00]     | [  14 ]            |
+--------+--------------+----------------+--------------------+
Unit: [each v]   Min. Charge ($): [____]
```

### Technical Details
- Import `Table, TableHeader, TableBody, TableHead, TableRow, TableCell` from `@/components/ui/table`
- Replace the `grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4` div (lines 942-967) with a `Table` element
- Column order: **Class** (Badge), **Name** (text), **Rate ($)** (input), **Service Time (min)** (input)
- Each row maps to a `classRate` entry and calls `updateClassRate` for both `rate` and `serviceTimeMinutes`
- Remove the shared "Service Time (min)" field from the bottom section (line 997-1008) since each class row now has its own
- Keep Unit and Min. Charge at the bottom (reduce from 3-col to 2-col grid)

### Edit Mode Race Condition Fix (lines 215-226)
When editing a service, if `classes` loads after the form initializes, `classRates` starts empty and the `useEffect` repopulates with blank values, losing existing rates. The fix:
- Check if `editingChargeType` exists and has `pricing_rules`
- When populating blank `classRates` from newly-loaded `classes`, match each class against `editingChargeType.pricing_rules` to restore saved rate and service time values

### Save Logic Fix (line 320)
Change `form.classRates.filter(r => r.rate)` to `form.classRates.filter(r => r.rate !== '')` so that a rate of `"0"` is saved rather than silently discarded.

---

## Change 2: "No Charge" Pricing Method

### Purpose
For services that need tracking (name, code, flags, alerts, scan hub, service time) but have no billing. Example: a "Fragile" flag that alerts the office but costs nothing.

### New Pricing Method Card
Add a 5th card to `PRICING_METHOD_CARDS`:
```
{ value: 'no_charge', label: 'No Charge', icon: 'money_off' }
```
The grid changes from `grid-cols-2` to accommodate 5 cards (wrap layout with `flex-wrap`).

### Behavior When Selected
- Rate configuration is **hidden entirely** (no rate, unit, or minimum charge)
- A **Service Time** input is still shown (for scheduling/capacity planning)
- An info note appears: "This service will not generate billing charges"
- The **Billing Trigger** section (see Change 3) is hidden entirely
- Trigger defaults to `'manual'`
- Validation skips rate and trigger requirements

### Type Changes
- `FormState.pricingMethod`: change from `'class_based' | 'flat'` to `'class_based' | 'flat' | 'no_charge'`
- `handlePricingMethodSelect`: add `'no_charge'` case -- sets `pricingMethod: 'no_charge'`, `unit: 'each'`, `trigger: 'manual'`
- `getActivePricingCard`: return `'no_charge'` when `form.pricingMethod === 'no_charge'`

### Save Behavior
On save, creates a flat pricing rule with `rate: 0` for database consistency:
```
pricing_method: 'flat', rate: 0, unit: 'each',
service_time_minutes: (from form if set)
```

### Edit Mode Detection
When loading an existing service, detect "no charge" by checking if the only pricing rule has `rate === 0` AND `pricing_method === 'flat'` AND `default_trigger === 'manual'` AND not class-based.

### Validation Changes (lines 250-268)
- When `pricingMethod === 'no_charge'`: skip rate validation AND trigger validation
- Other pricing methods: rate validation stays as-is

### New Component: `NoChargeConfig`
A simple component showing only a Service Time (min) input and an info message. No rate, unit, or min charge fields.

---

## Change 3: Separate Category and Billing Trigger

### Current State (lines 579-692)
Section 2 is titled "Category & Auto Billing Trigger" and contains both the category chips and the trigger/flag/scan chips in one card.

### New Layout (5 sections instead of 4)

```text
Section 1: Basic Information (unchanged)

Section 2: Category
  - Service category chips only
  - Numbered circle: 2

Section 3: Pricing (unchanged, but now numbered 3)
  - 5 method cards including No Charge
  - Rate config / table / NoChargeConfig

Section 4: Billing Trigger            <-- NEW STANDALONE SECTION
  - Auto billing trigger chips
  - Flag / Scan chips
  - Help text
  - Entire section is HIDDEN when No Charge is selected

Section 5: Options (unchanged content, renumbered from 4 to 5)
```

### What Moves
- The auto billing trigger chips, flag/scan chips, and help text (lines 632-689) move from Section 2 into a new Section 4 card
- Section 2 becomes "Category" only
- When `form.pricingMethod === 'no_charge'`, the entire Section 4 card is not rendered
- Section numbering updates: the Options card changes from circle "4" to circle "5"

---

## No Database Changes Needed

- "No Charge" services store as `pricing_method: 'flat'` with `rate: 0` in `pricing_rules` -- existing schema supports this
- Flag/alert functionality is independent of pricing (driven by `add_flag`, `flag_is_indicator`, `alert_rule` on `charge_types`)
- Per-class `service_time_minutes` is already a column on `pricing_rules`

