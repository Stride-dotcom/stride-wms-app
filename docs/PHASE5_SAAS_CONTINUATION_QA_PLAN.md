# Phase 5 SaaS Continuation Plan (Q&A Driven)

Last updated: 2026-02-14  
Primary source of truth: `docs/LOCKED_DECISION_LEDGER.md` + `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md`

## Scope

Continue Phase 5 SaaS subscription automation using locked decisions and one-question-at-a-time clarification.
Current superseding direction: `DL-2026-02-14-051` (accepted) shifts from route-level gating to app-level restriction with payment-update redirect.
Redirect timing decision captured: `DL-2026-02-14-052` (accepted) starts redirect at `past_due` during grace.
Recovery UX decision captured: `DL-2026-02-14-053` (accepted) requires auto-check polling plus manual status refresh on blocked page.
Blocked destination route decision captured: `DL-2026-02-14-054` (accepted) sets path to `/subscription/update-payment`.
Ops visibility decision captured: `DL-2026-02-14-055` (accepted) adds a minimal `admin_dev` Stripe observability page with no credential editing.
Blocked-state allowlist captured: `DL-2026-02-14-056` (accepted) keeps auth/payment-update/logout/help-support reachable.
RPC identity decision captured: `DL-2026-02-14-057` (accepted) standardizes payment mutation on `stripe_subscription_id`.
Webhook lookup decision captured: `DL-2026-02-14-058` (accepted) uses `customer_id` fallback to `subscription_id` for `subscription.updated`.
Portal launch decision captured: `DL-2026-02-14-059` (accepted) auto-opens Stripe Customer Portal from `/subscription/update-payment`.
Shared destination decision captured: `DL-2026-02-14-060` (accepted) applies the same blocked route to `/client/*` and internal users.
Security boundary decision captured: `DL-2026-02-14-061` (accepted) keeps payment data entry Stripe-hosted, not in-app.
Support-channel decision captured: `DL-2026-02-14-062` (accepted) uses external mailto support from blocked flow.
Release-governance decision captured: `DL-2026-02-14-063` (accepted) keeps DL-051..DL-062 accepted until post-deploy Stripe CLI validation.
Authoritative outstanding item from the source record: **Phase 5.1 checkout session creator** that sets `metadata.tenant_id`.
Checkout-trigger decision captured: `DL-2026-02-14-064` (accepted) places trigger on Billing page with dynamic Start/Manage label.

## Current implementation snapshot

Confirmed present in repo:

- Migration: `supabase/migrations/20260213160000_saas_phase5_v3_stripe_subscription.sql`
- Webhook: `supabase/functions/stripe-webhook/index.ts`
- Checkout creator (Phase 5.1): `supabase/functions/create-stripe-checkout-session/index.ts`
- Portal creator: `supabase/functions/create-stripe-portal-session/index.ts`
- Gate hook: `src/hooks/useSubscriptionGate.ts`
- Gate components: `src/components/subscription/SubscriptionGate.tsx`, `SubscriptionBlockedBanner.tsx`
- Route wiring: `src/App.tsx`
- Billing trigger: `src/pages/Billing.tsx` (dynamic Start/Manage subscription button)

## Decision-to-code alignment check (initial)

| Area | Locked decision reference | Current status | Evidence |
|---|---|---|---|
| Route-level gating list (`/incoming` and create-only paths) | DL-2026-02-14-050 | superseded | Superseded by DL-051 full-app redirect model |
| Global banner above routes | DL-2026-02-14-046 | superseded | Superseded by blocked destination page flow |
| invoice events identity | DL-2026-02-14-044 + DL-2026-02-14-057 | aligned | Webhook invoice handlers mutate via `stripe_subscription_id` |
| subscription.updated resolution fallback customer->subscription | DL-2026-02-14-058 | aligned | `stripe-webhook` now resolves customer first, then subscription fallback |
| Payment mark RPC identity contract | DL-2026-02-14-057 | aligned | Migration + webhook use `p_stripe_subscription_id` |
| Fail-open gate behavior when row missing | DL-2026-02-14-017/037 | aligned | `rpc_get_my_subscription_gate` returns active state when row not found |
| RLS and service-role grant pattern | DL-2026-02-14-030..034 | aligned | Migration includes expected policy and grant pattern |

## Planned continuation sequence

1. **Deploy new edge functions** `create-stripe-checkout-session` and `create-stripe-portal-session` with env vars (`STRIPE_SECRET_KEY`, `APP_URL`).
2. **Deploy updated stripe-webhook** and verify event mapping behavior in environment.
3. **Run Stripe CLI integration tests** (checkout bootstrap + payment failed -> blocked redirect + payment fixed -> unlock recovery).
4. **Lock accepted decisions DL-051..DL-062** after deployment verification.
5. **Log final verification evidence** in `docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md`.

Execution checklist:
- `docs/PHASE5_STRIPE_CLI_VALIDATION_CHECKLIST.md`
- `docs/PHASE5_DEPLOYMENT_COMMAND_SCRIPT.md`
- `scripts/phase5_validate.sh`

## Q&A protocol (one question at a time)

For each unresolved item:

1. Ask one focused question.
2. Capture answer as either:
   - implementation decision (accepted/locked), or
   - superseding decision if it modifies existing locked decisions.
3. Update ledger and implementation log in same commit.

## Open questions queue (ask serially)

1. Should Phase 5.1 checkout use a single default active plan (current implementation), or should users choose among active plans in UI?

