
# Fix Display Name in PDFs + Build Errors + Add Help Icon

## Problem
1. Quote PDF shows "Your Company" instead of the Display Name from Settings > Organization > Company Info
2. Three build errors in `ReceivingStageRouter.tsx` (wrong column names) and `useOrgPreferences.ts` (upsert format)
3. Display Name field needs a help icon explaining it appears on quotes, invoices, and alert templates

## Changes (5 files)

### File 1: `src/lib/quotes/export.ts`

**Line 629-634**: Add `companyName?: string` to the overrides parameter of `transformQuoteToPdfData`

**Line 643**: Change the companyName assignment to use the override first:
```typescript
companyName: overrides?.companyName || quote.tenant?.name || 'Your Company',
```

### File 2: `src/pages/QuoteBuilder.tsx`

**Line 668-670**: Add `companyName` to the overrides object in `buildExportData()`:
```typescript
brandColor: brandSettings?.brand_primary_color,
companyLogo: tenantSettings?.logo_url || undefined,
companyWebsite: tenantSettings?.company_website || undefined,
companyName: tenantSettings?.company_name || undefined,
```

This pulls the Display Name from `tenant_company_settings.company_name` (the field shown in Settings > Organization > Company Info).

### File 3: `src/components/receiving/ReceivingStageRouter.tsx` (build error fixes)

**Line 75**: Change `.select('name')` to `.select('account_name')`
**Line 78**: Change `account?.name` to `account?.account_name`
**Line 99**: Change `.select('company_name, address, phone, email, logo_url')` to `.select('company_name, company_address, company_phone, company_email, logo_url')`
**Lines 135-137**: Change `company?.address` to `company?.company_address`, `company?.phone` to `company?.company_phone`, `company?.email` to `company?.company_email`

### File 4: `src/hooks/useOrgPreferences.ts` (build error fix)

**Lines 67-74**: Wrap the upsert object in an array:
```typescript
.upsert(
  [{
    tenant_id: profile.tenant_id,
    setting_key: key,
    setting_value: value,
    updated_by: profile.id,
    updated_at: new Date().toISOString(),
  }],
  { onConflict: 'tenant_id,setting_key' }
)
```

### File 5: `src/components/settings/OrganizationSettingsTab.tsx`

**Line ~1**: Add import for `HelpTip`:
```typescript
import { HelpTip } from '@/components/ui/help-tip';
```

**Line 292**: Wrap the Display Name label with a HelpTip:
```typescript
<FormLabel>
  <HelpTip tooltip="This name will be displayed on quotes, invoices, and alert templates sent to your customers.">
    Display Name
  </HelpTip>
</FormLabel>
```

## Summary
- Quote PDF will now show "Stride Logistics" (or whatever is in the Display Name field) instead of "Your Company"
- Invoice PDF already receives company name from tenant settings, so it will also show correctly
- All 6 build errors resolved
- Help icon added to the Display Name field in settings
