# Remaining Items

## Lower Priority - To Complete Later

### 1. SMS/Twilio Integration
- Templates editor mentions SMS but Twilio is not configured
- Need to add Twilio API keys and implement SMS sending in edge functions
- Location: `src/components/settings/communications/TemplatesTab.tsx`

### 2. Tax Configuration
- Tax calculations currently hardcoded to 0
- Need to make tax rate configurable per tenant/account
- Location: `src/hooks/useBilling.ts` (line ~113)

### 3. Billing Rate Field Proxies
- `is_unstackable` and `is_crated` flags use proxy rate fields (`extra_fee`, `oversize_rate`)
- May need dedicated rate columns in `rate_cards` table
- Location: `src/hooks/useBillingEvents.ts` (lines 26-31)

---
*Last updated: January 2026*
