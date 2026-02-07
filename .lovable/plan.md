

# Fix Price List Options Section

## Scope
All changes in a single file: `src/components/settings/pricing/AddServiceForm.tsx`

---

## Change 1: Mobile-Friendly Class-Based Rate Table

**Problem**: Rate ($) column has fixed `w-[140px]` and Service Time has `w-[130px]`, making inputs too narrow on mobile.

**Fix (lines 1013-1016)**:
- Remove fixed widths from Rate and Service Time `TableHead` columns
- Add responsive classes: Rate gets `min-w-[100px]`, Service Time gets `min-w-[100px]`
- Add `w-full` to the rate and service time `Input` components so they fill their cells

---

## Change 2: Rename Options Display Labels

**Problem**: Currently shows "Show in Scan Hub" and "Create as Flag". Should be "Scan Hub" and "Flag".

**Fix (lines 839-855)**:
- "Show in Scan Hub" label becomes **"Scan Hub"**
- "Create as Flag" label becomes **"Flag"**
- No changes to billing trigger chips -- those stay as-is

---

## Change 3: Move All Visible Help Text Behind (?) Icons

**Problem**: "Show in Scan Hub", "Create as Flag", and all three flag behavior options show their descriptions as visible `<p>` text. These should be behind `LabelWithTooltip` (?) icons only.

The `LabelWithTooltip` component already uses a `Popover` (not a hover-only tooltip), so it works on tap/click for mobile and tablet out of the box.

**Scan Hub (lines 839-845)**:
- Replace `<Label>Show in Scan Hub</Label>` + `<p>Makes this service available...</p>` with:
  `<LabelWithTooltip tooltip="Makes this service available in the Scan Hub service dropdown">Scan Hub</LabelWithTooltip>`
- Remove the `<p>` description paragraph

**Flag (lines 848-855)**:
- Replace `<Label>Create as Flag</Label>` + `<p>Shows as a toggleable flag...</p>` with:
  `<LabelWithTooltip tooltip="Shows as a toggleable flag on Item Details page">Flag</LabelWithTooltip>`
- Remove the `<p>` description paragraph

**Flag Behavior sub-options (lines 860-902)**:
- All three options get their inline descriptions moved behind (?) icons (details in Change 4 below)

---

## Change 4: Flag Behaviors -- Independent Toggles Instead of Radio Buttons

**Problem**: "Creates Billing Charge" and "Indicator Only" are mutually exclusive radio buttons. They should be independent since a flag can do both.

### FormState Update (line 73)
Replace:
```
flagBehavior: 'charge' | 'indicator';
```
With two booleans:
```
flagBilling: boolean;
flagIndicator: boolean;
```

### Default Values (line 226)
Replace:
```
flagBehavior: 'charge',
```
With:
```
flagBilling: false,
flagIndicator: false,
```

### Edit Mode Loading (line 198)
Replace:
```
flagBehavior: (editingChargeType as any).flag_is_indicator ? 'indicator' : 'charge',
```
With:
```
flagBilling: editingChargeType.pricing_rules?.some(r => Number(r.rate) > 0) ?? false,
flagIndicator: (editingChargeType as any).flag_is_indicator ?? false,
```

### Save Logic (lines 448-449, 478-479)
Replace:
```
flag_is_indicator: form.addFlag && form.flagBehavior === 'indicator',
```
With:
```
flag_is_indicator: form.addFlag && form.flagIndicator,
```

### Validation (line 296)
Replace:
```
const isIndicatorFlag = form.addFlag && form.flagBehavior === 'indicator';
```
With:
```
const isIndicatorFlag = form.addFlag && !form.flagBilling;
```
This skips rate validation only when flag is on but billing is not checked.

### New Flag Behavior UI (replaces lines 858-903)
Three `Switch` toggle rows with `LabelWithTooltip` (?) icons. No visible description text -- all help text is behind the (?) icon:

```text
Flag Behavior
  Billing    (?)  [switch]
  Indicator  (?)  [switch]
  Alert      (?)  [switch]
```

Each row:
1. **Billing** -- `LabelWithTooltip tooltip="When flagged on an item, creates a billing event at the configured rate"` + `Switch checked={form.flagBilling}`
2. **Indicator** -- `LabelWithTooltip tooltip="Shows a bold visual marker like FRAGILE on the item details page"` + `Switch checked={form.flagIndicator}`
3. **Alert** -- `LabelWithTooltip tooltip="Sends an email notification to the office when this flag is applied to an item"` + `Switch checked={form.flagAlertOffice}`

All three are independent -- any combination can be active simultaneously.

---

## Summary

| Area | Current | New |
|---|---|---|
| Class rate table columns | Fixed `w-[140px]`/`w-[130px]` | Responsive `min-w-[100px]` + `w-full` inputs |
| Scan Hub label | "Show in Scan Hub" + visible description | "Scan Hub" + (?) tooltip |
| Flag label | "Create as Flag" + visible description | "Flag" + (?) tooltip |
| Flag behavior | Radio: "Creates Billing Charge" OR "Indicator Only" | 3 independent switches: Billing, Indicator, Alert |
| Flag behavior help text | Visible `<p>` descriptions | Behind (?) tooltip icons |
| Billing trigger chips | Unchanged | Unchanged |

### No database changes needed
`flag_is_indicator` boolean already supports the indicator toggle. Billing behavior is driven by the rate value. Alert is already driven by `alert_rule`.
