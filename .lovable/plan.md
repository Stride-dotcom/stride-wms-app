

# Fix Item Flags Display on Item Detail Page

## Scope
Single file: `src/components/items/ItemFlagsSection.tsx`

---

## Change 1: Remove Visible Pricing

Remove the price text (`$XX.XX`) from flag rows. The `canViewPrices` variable and `usePermissions` import become unused and will be removed.

**Lines 14, 37, 39-40**: Remove `usePermissions` import and `canViewPrices` variable.

**Lines 500-518**: Replace the trailing icons block. Currently it shows either an INDICATOR badge (with text) or a price badge, plus an alert icon. The new version shows up to three small icon-only badges based on the flag's settings:
- **Billing** (`attach_money`): shown when `!isIndicator` (i.e., the flag creates a billing charge)
- **Indicator** (`warning`): shown when `isIndicator` (i.e., the flag is an indicator)
- **Alert** (`notifications`): shown when `hasAlert` is true

No price text anywhere.

---

## Change 2: Move Icons After Text, Add Flag Icon Before Text

**Lines 490-498**: Replace the current leading icon (which switches between `flag` and `info` based on type) with a single `flag` icon for ALL flags. This tells users visually "these are flags."

**Lines 499-518**: Restructure the label content so it reads:
```
[flag icon] [Service Name]  ... [$] [warning] [bell]
```
The behavior icons come after the text (they already do via `ml-auto`, this stays the same).

---

## Change 3: Standardize Behavior Icons

| Icon | MaterialIcon name | Condition | Style |
|---|---|---|---|
| Billing ($) | `attach_money` | `!service.flag_is_indicator` | Small outline badge |
| Indicator | `warning` | `service.flag_is_indicator` | Small amber outline badge |
| Alert | `notifications` | `service.alert_rule !== 'none'` | Small outline badge (unchanged) |

All three use the same small `Badge variant="outline"` with just the icon, no text.

---

## Change 4: Mobile-Friendly Grid

**Line 404** (loading skeleton): Change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`

**Line 463** (flag grid): Change `grid-cols-2` to `grid-cols-1 sm:grid-cols-2`

---

## Change 5: Update Legend -- Remove "Flag", Keep Other 3

**Lines 525-538**: Update the legend to show only 3 items (remove the flag entry that was in the first plan). Keep:

1. `[$]` Billing
2. `[warning]` Indicator
3. `[bell]` Alert

Add `flex-wrap` so the legend wraps nicely on mobile.

---

## Summary of All Changes

| Area | Current | New |
|---|---|---|
| Leading icon | `flag` or `info` depending on type | Always `flag` for all flags |
| Pricing text | `$XX.XX` shown to admins | Removed entirely |
| Trailing icons | INDICATOR text badge OR price badge, plus alert | Three small icon-only badges: $, warning, bell |
| Icon conditions | Based on indicator status + price > 0 | Based on flag settings (indicator, billing, alert) |
| Grid | `grid-cols-2` always | `grid-cols-1 sm:grid-cols-2` |
| Legend | 3 items (billing, indicator, alert) | Same 3 items with shorter labels, no "Flag" entry |
| Unused code | `canViewPrices`, `usePermissions` | Removed |

