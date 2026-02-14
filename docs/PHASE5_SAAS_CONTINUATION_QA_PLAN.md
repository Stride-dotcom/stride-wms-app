# Phase 5 SaaS Continuation Plan (Q&A Driven)

Last updated: 2026-02-14  
Primary source of truth: `docs/LOCKED_DECISION_LEDGER.md` + `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md`

## Scope

Continue Phase 5 SaaS subscription automation using locked decisions and one-question-at-a-time clarification.
Current superseding direction: `DL-2026-02-14-051` (accepted) shifts from route-level gating to app-level restriction with payment-update redirect.

## Current implementation snapshot

Confirmed present in repo:

- Migration: `supabase/migrations/20260213160000_saas_phase5_v3_stripe_subscription.sql`
- Webhook: `supabase/functions/stripe-webhook/index.ts`
- Gate hook: `src/hooks/useSubscriptionGate.ts`
- Gate components: `src/components/subscription/SubscriptionGate.tsx`, `SubscriptionBlockedBanner.tsx`
- Route wiring: `src/App.tsx`

## Decision-to-code alignment check (initial)

| Area | Locked decision reference | Current status | Evidence |
|---|---|---|---|
| Route gating list includes `/incoming` | DL-2026-02-14-050 | drift/ambiguous | `src/App.tsx` route for `/incoming` currently redirects to `/shipments` (line 108) |
| Global banner rendered in authenticated shell above routes | DL-2026-02-14-046 | drift | Banner currently rendered inside `SubscriptionGatedRoute`, not globally in app shell |
| invoice events resolve tenant via customer mapping | DL-2026-02-14-044/045 | drift | Webhook invoice handlers call RPCs by `subscription_id` directly |
| subscription.updated resolution fallback customer->subscription | DL-2026-02-14-045 | drift | Handler lookup uses `stripe_subscription_id` only |
| Payment mark RPC identity contract | DL-2026-02-14-040/041 | drift/contract mismatch | Migration RPC signatures take `p_stripe_subscription_id` (not tenant id) |
| Fail-open gate behavior when row missing | DL-2026-02-14-017/037 | aligned | `rpc_get_my_subscription_gate` returns active state when row not found |
| RLS and service-role grant pattern | DL-2026-02-14-030..034 | aligned | Migration includes expected policy and grant pattern |

## Planned continuation sequence

1. **Finalize global restriction trigger timing** (when redirect takes effect).
2. **Define payment-update destination** (route/page ownership, allowlist behavior).
3. **Resolve webhook/RPC contract mismatches** (customer/subscription mapping and RPC identity).
4. **Implement global restriction flow** without modifying locked history in place (supersession-aware).
5. **Add verification checklist/tests** (Stripe replay, grace transitions, lock/unlock redirect behavior).
6. **Log completion evidence** in `docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md`.

## Q&A protocol (one question at a time)

For each unresolved item:

1. Ask one focused question.
2. Capture answer as either:
   - implementation decision (accepted/locked), or
   - superseding decision if it modifies existing locked decisions.
3. Update ledger and implementation log in same commit.

## Open questions queue (ask serially)

1. Should full-app redirect happen only when `is_restricted=true` (after grace), or immediately on `past_due` (during grace too)?
2. What exact route should host payment update (`/billing/subscription`, `/settings/billing`, or new `/subscription/update-payment`)?
3. Which routes should remain allowlisted while blocked (for example auth/logout/help/support)?
4. For payment-state RPCs, should we supersede DL-040/DL-041 to standardize on `stripe_subscription_id` (matching current implementation), or refactor code to tenant-id-based mutation?
5. For `customer.subscription.updated`, should tenant resolution strictly follow customer-id then subscription-id fallback (as locked), or remain subscription-id only?

