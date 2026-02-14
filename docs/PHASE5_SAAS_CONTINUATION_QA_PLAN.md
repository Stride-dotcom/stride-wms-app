# Phase 5 SaaS Continuation Plan (Q&A Driven)

Last updated: 2026-02-14  
Primary source of truth: `docs/LOCKED_DECISION_LEDGER.md` + `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md`

## Scope

Continue Phase 5 SaaS subscription automation using locked decisions and one-question-at-a-time clarification.

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

1. **Resolve contract mismatches first** (webhook + RPC identity resolution model).
2. **Finalize route gating behavior** (`/incoming` path semantics).
3. **Implement global banner placement in app shell** without touching `ProtectedRoute`.
4. **Add verification checklist/tests** (Stripe event replay, fail-open gate, route restriction behavior).
5. **Log completion evidence** in `docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md`.

## Q&A protocol (one question at a time)

For each unresolved item:

1. Ask one focused question.
2. Capture answer as either:
   - implementation decision (accepted/locked), or
   - superseding decision if it modifies existing locked decisions.
3. Update ledger and implementation log in same commit.

## Open questions queue (ask serially)

1. Should `/incoming` remain an alias redirect to `/shipments`, or should it be restored as a gated operational page to satisfy DL-050 literally?
2. For payment-state RPCs, should we supersede DL-040/DL-041 to standardize on `stripe_subscription_id` (matching current implementation), or refactor code to tenant-id-based mutation?
3. For `customer.subscription.updated`, should tenant resolution strictly follow customer-id then subscription-id fallback (as locked), or remain subscription-id only?
4. Should we implement the global banner exactly in app shell now, even if route-level banner already exists?

