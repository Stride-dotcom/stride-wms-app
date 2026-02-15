

## Plan: Public Landing Page + SMS Opt-In/Out Page + Build Fixes

### Overview
Create two public pages (no login, no tenant ID required) and fix the existing TypeScript build errors.

---

### 1. Fix Build Errors

**Files:** `src/hooks/useDecisionLedger.ts` and `src/hooks/useFieldHelpContent.ts`

Move the `as any` cast from after `.from()` to the `supabase` client itself. This fully bypasses TypeScript's overload resolution.

- **useDecisionLedger.ts line 74:** `(supabase as any).from("decision_ledger_entries")`
- **useDecisionLedger.ts line 137:** `(supabase as any).from("decision_ledger_entries")`
- **useFieldHelpContent.ts lines 38, 79, 123, 157:** `(supabase as any).from('field_help_content')`

---

### 2. New File: `src/pages/LandingPage.tsx` (route: `/welcome`)

A public marketing page for StrideWMS. No tenant ID needed.

**Sections:**
- **Hero** -- "Modern Warehouse Management" headline, subtitle about streamlining operations, two buttons: "Get Started" (links to `/auth`) and "Learn More" (scrolls down)
- **Features Grid** -- 6 cards: Inventory Tracking, Shipment Management, Billing and Invoicing, Client Portal, Claims and Coverage, SMS Alerts
- **How It Works** -- 3 steps: Sign Up, Configure Your Warehouse, Start Managing
- **Final CTA** -- "Ready to get started?" with sign-up button
- **Footer** -- Copyright, link to SMS info page

Styled with existing Tailwind and lucide-react icons, matching the app's clean aesthetic.

---

### 3. New File: `src/pages/SmsInfoPage.tsx` (route: `/sms`)

A public page covering SMS notification program details and legal compliance. No tenant ID needed -- this is a general informational page that Twilio reviewers can visit.

**Content includes all legally required disclosures:**
- **Program description** -- What messages are sent (shipment updates, inventory alerts, account notifications)
- **Who sends them** -- StrideWMS on behalf of warehouse operators
- **Message frequency** -- "Message frequency varies"
- **Costs** -- "Message and data rates may apply"
- **Opt-in process** -- Explains the web form opt-in flow and that consent is not a condition of purchase
- **How to opt out** -- Reply STOP to any message to unsubscribe
- **How to get help** -- Reply HELP or contact support
- **Privacy and Terms** -- Links/placeholders for Privacy Policy and Terms of Conditions
- **Carrier disclaimer** -- Carriers are not liable for delayed or undelivered messages

This page serves as the publicly accessible URL you submit to Twilio for toll-free verification (Error 30509 compliance).

---

### 4. Route Registration in `src/App.tsx`

Add two new public routes (no ProtectedRoute wrapper) alongside the existing SMS opt-in routes:

```
/welcome  ->  LandingPage
/sms      ->  SmsInfoPage
```

Add the corresponding imports at the top of the file.

---

### Summary of Changes

| File | Action |
|------|--------|
| `src/hooks/useDecisionLedger.ts` | Fix 2 cast patterns |
| `src/hooks/useFieldHelpContent.ts` | Fix 4 cast patterns |
| `src/pages/LandingPage.tsx` | New file -- marketing landing page |
| `src/pages/SmsInfoPage.tsx` | New file -- SMS compliance/info page |
| `src/App.tsx` | Add 2 public routes + 2 imports |

No new dependencies required.

