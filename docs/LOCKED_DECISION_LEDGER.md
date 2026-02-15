# Locked Decision Ledger

Last updated: 2026-02-14
Owner: Builders / Developers
Scope: Development artifact only (not an app feature)

## Purpose

This file is the authoritative, human-readable decision ledger for build work.
It captures high-impact implementation decisions, their status, and supersession chain.

## Non-negotiable rules

1. **Editable until locked**: A decision can be edited while in `draft` or `accepted`.
2. **Locked means immutable**: Once state is `locked`, do not edit decision content in place.
3. **Changes after lock require supersession**: Create a new decision and reference `supersedes`.
4. **Append-only implementation tracking**: Progress is logged in `docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md`.
5. **Decision source required**: Each decision must reference source material (Q&A, plan doc, PDF, issue).
6. **Docs-only system**: Ledger lives in this GitHub repo under `docs/` for builders/developers.

## Decision lifecycle states

- `draft`: captured candidate, still being refined
- `accepted`: approved for implementation, still editable
- `locked`: final and immutable
- `superseded`: replaced by another decision
- `rejected`: intentionally not adopted

## Decision index

| Decision ID | Title | Domain | State | Source | Supersedes | Locked At |
|---|---|---|---|---|---|---|
| DL-2026-02-14-001 | Phase 5 v3 implementation record is authoritative for SaaS subscription automation | SaaS Subscription | locked | `uploads/Stride_SaaS_Authoritative_Implementation_Record_Phase5v3.pdf` | - | 2026-02-14 |
| DL-2026-02-14-002 | Ledger is a developer artifact in `docs/`, not an in-app feature | Governance | locked | Chat Q&A (2026-02-14) | - | 2026-02-14 |
| DL-2026-02-14-003 | Decisions are editable until locked; locked decisions are immutable | Governance | locked | Chat Q&A (2026-02-14) | - | 2026-02-14 |
| DL-2026-02-14-004 | Any post-lock change must use a new superseding decision | Governance | locked | Chat Q&A (2026-02-14) | - | 2026-02-14 |
| DL-2026-02-14-005 | Builder prompts must include phase and version labels | Governance | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-006 | Builder prompts must follow NVPC and include execution summary block | Governance | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-007 | Phase 5 is first SaaS/Stripe implementation in this codebase | SaaS Subscription | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-008 | Do not use super_admin in RLS; use current_user_is_admin_dev() | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-009 | Use user_tenant_id() as tenant resolver standard | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-010 | Keep routing in src/App.tsx; do not create src/routes/ | Frontend Architecture | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-011 | saas_plans is global and must not be tenant scoped | Database | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-012 | Stripe webhook is server-to-server: no CORS and no OPTIONS handler | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-013 | Bootstrap first tenant_subscriptions row at checkout completion metadata.tenant_id | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-014 | Checkout metadata.tenant_id is required; missing value logs and returns 200 | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-015 | All webhook writes must be idempotent using UPSERT/SET semantics | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-016 | Service-role-only RPCs must revoke public/authenticated and grant service_role | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-017 | Gate RPC fail-open when tenant_subscriptions row is missing | Subscription Gate | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-018 | Do not modify ProtectedRoute; gate only specified routes via SubscriptionGate | Frontend Gating | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-019 | Client portal shipment creation routes are gated like internal routes | Frontend Gating | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-020 | Deployment order is merge -> migration -> webhook/env -> Stripe CLI tests | Operations | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-021 | Billing parity lock: no billing module redesign in Phase 5 | Billing | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-022 | Pricing remains DB-driven and Stripe-controlled; no hardcoded pricing logic | Billing | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-023 | Stripe is source of truth for subscription state | Subscription Lifecycle | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-024 | Enforce active access, 7-day grace on failure, then route restrictions | Subscription Lifecycle | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-025 | Never trust client tenant_id; derive via auth.uid() -> user_tenant_id() | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-026 | tenant_subscriptions RLS allows tenant read isolation and no client writes | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-027 | Stripe signature verification is mandatory before processing | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-028 | Create saas_plans with specified fields, is_active index, updated_at trigger | Database | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-029 | Create tenant_subscriptions with specified fields/indexes/trigger | Database | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-030 | saas_plans RLS: authenticated SELECT active only | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-031 | saas_plans write allowed only when current_user_is_admin_dev() is true | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-032 | tenant_subscriptions RLS SELECT only own tenant row | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-033 | rpc_get_my_subscription_gate() execute grant to authenticated only | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-034 | Mutation RPCs execute grant to service_role only | Security | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-035 | Subscription status values are active, past_due, canceled, inactive | Subscription Lifecycle | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-036 | Grace calculation formula is exactly now() + interval '7 days' | Subscription Lifecycle | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-037 | rpc_get_my_subscription_gate() returns gate state with fail-open logic | Backend RPC | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-038 | rpc_initialize_tenant_subscription_from_checkout is service-role bootstrap UPSERT | Backend RPC | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-039 | rpc_upsert_tenant_subscription_from_stripe is service-role idempotent UPSERT | Backend RPC | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-040 | rpc_mark_payment_failed_and_start_grace records failure and starts grace | Backend RPC | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-041 | rpc_mark_payment_ok clears failure/grace and sets active | Backend RPC | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-042 | Webhook handles five Stripe event types and logs unknown types with 200 | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-043 | checkout.session.completed missing tenant mapping logs and returns 200 | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-044 | invoice.paid/payment_failed events toggle grace through service-role RPCs | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-045 | subscription.updated/deleted resolve tenant and upsert mapped status | Webhook | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-046 | Global SubscriptionBlockedBanner sits in authenticated shell above routes | Frontend Gating | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-047 | Banner messaging rules are fixed for restricted vs grace states | Frontend Gating | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-048 | SubscriptionGate blocks specified creation routes when restricted | Frontend Gating | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-049 | useSubscriptionGate uses query key, stale time, and window-focus refetch policy | Frontend Gating | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-050 | Gated route list is exact and includes internal and client creation routes | Frontend Gating | locked | `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md` | - | 2026-02-14 |
| DL-2026-02-14-051 | Subscription enforcement scope moves to full-app restriction with payment-update redirect | SaaS Enforcement | accepted | Chat Q&A (2026-02-14) | DL-2026-02-14-018, DL-2026-02-14-019, DL-2026-02-14-048, DL-2026-02-14-050 | - |
| DL-2026-02-14-052 | Full-app redirect starts immediately at past_due (during grace) | SaaS Enforcement | accepted | Chat Q&A (2026-02-14) | DL-2026-02-14-024 | - |
| DL-2026-02-14-053 | Blocked page must auto-check subscription recovery and allow manual status refresh | SaaS UX | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-054 | Blocked-user destination route is /subscription/update-payment | SaaS UX | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-055 | Provide minimal admin_dev Stripe Ops observability page without credential editing | SaaS Ops | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-056 | Blocked-state allowlist includes auth, payment-update, logout, and help/support access | SaaS Enforcement | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-057 | Payment-state mutation RPC identity standard is stripe_subscription_id | Webhook/RPC Contract | accepted | Chat Q&A (2026-02-14) | DL-2026-02-14-040, DL-2026-02-14-041 | - |
| DL-2026-02-14-058 | subscription.updated tenant resolution must use customer_id fallback to subscription_id | Webhook Contract | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-059 | /subscription/update-payment auto-opens Stripe Customer Portal on page load | SaaS UX | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-060 | Client portal users use the same blocked destination route as internal users | SaaS Enforcement | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-061 | Payment data entry remains Stripe-hosted; app never collects raw card details | Security/Compliance | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-062 | Blocked-flow support uses external mailto contact (tenant company email when available) | SaaS UX | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-063 | Keep DL-051 through DL-062 in accepted state until post-deploy Stripe CLI validation | Release Governance | accepted | Chat Q&A (2026-02-14) | - | - |
| DL-2026-02-14-064 | Substantive implementation Q&A must be logged append-only in docs | Governance | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-065 | SMS platform is centrally managed in Stride Twilio account with no tenant credential setup | SMS Platform Architecture | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-066 | SMS number provisioning and activation workflow must be fully automated | SMS Provisioning Automation | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-067 | Toll-free numbers are the default automated sender strategy | Messaging Compliance | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-068 | SMS remains disabled until toll-free verification is approved | Messaging Compliance | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-069 | SMS billing start trigger is verification approval timestamp | Billing Automation | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-070 | Global pricing includes app monthly plus SMS monthly and per-segment fees | Pricing | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-071 | Price-change notices send to company_email only with billing tooltip guidance | Billing UX/Notifications | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-072 | SMS usage billing includes inbound and outbound traffic | SMS Billing | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-073 | SMS usage metering uses Twilio-accurate segment counts | SMS Billing | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-074 | Subscription and SMS add-on charges are billed automatically through Stripe | Billing Automation | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-075 | Admin-dev pricing console manages live and scheduled app/SMS rates plus notice actions | Admin Ops | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-076 | Subscription invoices are surfaced in Tenant Account Settings > Billing | Billing UX | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-077 | Public SMS opt-in page is tenant-branded and resolved by subdomain | SMS Opt-In UX | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-078 | Tenant editing of SMS compliance content is locked for simplicity | SMS Governance | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-079 | Tenant-facing Twilio setup sections are removed from standard organization settings | SMS Governance | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-080 | Internal comped billing override supports multiple internal tenants | Billing Policy | accepted | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |
| DL-2026-02-14-081 | First-month SMS monthly fee proration policy remains open pending pricing research | Billing Policy | draft | `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` | - | - |

## Detailed imports

- Phase 5 v3 detailed locked extraction:
  - `docs/LOCKED_DECISION_LEDGER_PHASE5V3_IMPORT.md`
  - Source: `/home/ubuntu/.cursor/projects/workspace/uploads/Stride_SaaS_Authoritative_Implementation_Record_Phase5v3.pdf`
- SMS/Twilio/billing Q&A trace source:
  - `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`

## Post-import working decisions

### DL-2026-02-14-051: Subscription enforcement scope moves to full-app restriction with payment-update redirect
- Domain: SaaS Enforcement
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: DL-2026-02-14-018, DL-2026-02-14-019, DL-2026-02-14-048, DL-2026-02-14-050
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
When subscription enforcement triggers, users should be routed to a subscription payment update page and blocked from normal app access until payment information is updated and access is restored.

#### Why
Business intent is to make subscription remediation the immediate path instead of route-by-route operational gating.

#### Implementation impact
- Introduces app-level restriction flow instead of limited route wrappers.
- Requires a dedicated payment-update destination route/page and allowlist behavior.
- Requires supersession plan for Phase 5 route-level gate decisions.

### DL-2026-02-14-052: Full-app redirect starts immediately at past_due (during grace)
- Domain: SaaS Enforcement
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: DL-2026-02-14-024
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Users are redirected to the subscription payment-update path immediately when status becomes `past_due` (during grace), not only after grace expires.

#### Why
Business priority is hard enforcement of billing remediation flow as soon as payment failure occurs.

#### Implementation impact
- Redefines grace as a payment-recovery window rather than an access-allowed window.
- App-level gate condition must block normal app routes for `past_due`, `canceled`, and `inactive`.
- Requires supersession-aware updates to banner/copy so in-grace users are still blocked but informed of grace deadline.

### DL-2026-02-14-053: Blocked page must auto-check subscription recovery and allow manual status refresh
- Domain: SaaS UX
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
The blocked payment-update page should automatically re-check subscription status on an interval (target ~10 seconds) and also provide a manual "Check status" action.

#### Why
Stripe recovery events are asynchronous; users need a low-friction path to regain access quickly once payment is fixed.

#### Implementation impact
- Add polling/refetch behavior to blocked flow.
- Add manual status refresh control on blocked page.
- On recovered status, immediately release app-level restriction and continue normal app navigation.

### DL-2026-02-14-054: Blocked-user destination route is /subscription/update-payment
- Domain: SaaS UX
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
The enforced payment-recovery flow uses a dedicated app route: `/subscription/update-payment`.

#### Why
A dedicated route keeps blocked-state logic isolated from normal billing/settings pages and simplifies allowlisting.

#### Implementation impact
- Add route/page for subscription payment update flow.
- Route allowlist while blocked must include `/subscription/update-payment`.
- Portal return URL should target `/subscription/update-payment`.

### DL-2026-02-14-055: Provide minimal admin_dev Stripe Ops observability page without credential editing
- Domain: SaaS Ops
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Build a dev-only (`admin_dev`) Stripe Ops page focused on observability and diagnostics, while keeping Stripe account settings, credentials, and key management outside the app.

#### Why
This gives operational visibility for troubleshooting and status checks without introducing security risk from in-app credential editing.

#### Implementation impact
- Add a restricted `admin_dev` route/page for Stripe observability.
- Include read-mostly data (subscription state lookups, webhook processing health, links to Stripe objects).
- Exclude any in-app editing of Stripe API keys or account-level credential material.

### DL-2026-02-14-056: Blocked-state allowlist includes auth, payment-update, logout, and help/support access
- Domain: SaaS Enforcement
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
While the app is globally blocked for unpaid subscription status, allowlisted access remains available for authentication, payment update flow, logout/sign-out, and help/support routes.

#### Why
Users must be able to remediate billing, recover sessions safely, and reach support without bypassing enforcement.

#### Implementation impact
- Global block middleware/guard must exempt:
  - `/auth`
  - `/subscription/update-payment`
  - logout/sign-out action route (if present)
  - help/support route(s) where available
- All other authenticated app routes are redirected to `/subscription/update-payment` during blocked states.

### DL-2026-02-14-057: Payment-state mutation RPC identity standard is stripe_subscription_id
- Domain: Webhook/RPC Contract
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: DL-2026-02-14-040, DL-2026-02-14-041
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Payment-state mutation RPCs are standardized on `stripe_subscription_id` as the identity key for failure/paid transitions.

#### Why
Stripe invoice/payment events naturally provide subscription IDs, reducing extra lookup complexity and minimizing mismatch risk.

#### Implementation impact
- Keep/refine mutation RPC signatures to accept `stripe_subscription_id`.
- Webhook invoice handlers call payment mutation RPCs using subscription ID directly.
- Documentation and gate diagnostics should reference this identity model.

### DL-2026-02-14-058: subscription.updated tenant resolution must use customer_id fallback to subscription_id
- Domain: Webhook Contract
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
For `customer.subscription.updated`, tenant resolution must first attempt `stripe_customer_id`; if unresolved, fallback to `stripe_subscription_id`.

#### Why
Customer-based mapping improves resilience when subscription IDs rotate, change timing, or are missing from expected mapping windows.

#### Implementation impact
- Update webhook resolution logic for `customer.subscription.updated` (and preferably keep parity for deleted event handling).
- Add logs that indicate which lookup path resolved the tenant.
- Ensure idempotent upsert still applies after resolution path branching.

### DL-2026-02-14-059: /subscription/update-payment auto-opens Stripe Customer Portal on page load
- Domain: SaaS UX
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
When users land on `/subscription/update-payment`, the app should automatically open Stripe Customer Portal immediately on page load.

#### Why
This minimizes remediation friction and gets blocked users into payment recovery flow without extra clicks.

#### Implementation impact
- Payment-update page should trigger portal session creation and redirect/open flow automatically.
- Include robust fallback UI for blocked popup/navigation failures (for example, retry button and support contact).
- Keep status polling/manual refresh from DL-2026-02-14-053 for post-return unlock behavior.

### DL-2026-02-14-060: Client portal users use the same blocked destination route as internal users
- Domain: SaaS Enforcement
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Client portal users (`/client/*`) should follow the same blocked destination route (`/subscription/update-payment`) and remediation flow as internal users.

#### Why
Subscription enforcement is tenant-level and should remain consistent across user surfaces.

#### Implementation impact
- Global blocked-state routing logic applies uniformly to internal and client portal routes.
- Avoid creating a separate client-only blocked flow unless later superseded.

### DL-2026-02-14-061: Payment data entry remains Stripe-hosted; app never collects raw card details
- Domain: Security/Compliance
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Users update payment details only in Stripe-hosted surfaces (Customer Portal/Checkout). The app does not capture, process, or store raw card numbers, CVC, or full PAN data.

#### Why
This reduces PCI exposure and security risk while relying on Stripe for payment data handling.

#### Implementation impact
- `/subscription/update-payment` launches Stripe-hosted payment management only.
- App stores only non-sensitive billing metadata needed for subscription state and UX (for example status, grace deadlines, Stripe IDs).
- Maintain secure webhook verification and service-role controls because operational/security risk still exists outside raw card handling.

### DL-2026-02-14-062: Blocked-flow support uses external mailto contact (tenant company email when available)
- Domain: SaaS UX
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Help/support in blocked payment flow is external: use a mailto contact link (prefer tenant company email from settings when available).

#### Why
External support avoids adding another in-app route while access is restricted and ships quickly.

#### Implementation impact
- Payment update page renders support mailto link when company email is available.
- Fallback guidance remains visible if no support email exists.

### DL-2026-02-14-063: Keep DL-051 through DL-062 in accepted state until post-deploy Stripe CLI validation
- Domain: Release Governance
- State: accepted
- Source: Chat Q&A (2026-02-14)
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Decisions DL-2026-02-14-051 through DL-2026-02-14-062 remain `accepted` and will not be moved to `locked` until deployment and Stripe CLI validation are completed.

#### Why
Final lock should occur only after live integration behavior is verified end-to-end.

#### Implementation impact
- Keep these decisions editable in accepted state until validation evidence is captured.
- After verification, update state to locked and append corresponding verification events in the implementation log.

### DL-2026-02-14-064: Substantive implementation Q&A must be logged append-only in docs
- Domain: Governance
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
All substantive implementation Q&A from active build threads must be captured in an append-only docs log and linked to decision IDs.

#### Why
This prevents decision drift and ensures implementation can be traced back to explicit user-approved outcomes.

#### Implementation impact
- Maintain `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md` (and future dated files) as append-only records.
- Ensure new accepted/draft decisions reference Q&A source entries.
- Keep implementation log synchronized with newly accepted/locked decisions.

### DL-2026-02-14-065: SMS platform is centrally managed in Stride Twilio account with no tenant credential setup
- Domain: SMS Platform Architecture
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Stride centrally manages Twilio for SMS; tenant users do not configure Twilio credentials in their own settings.

#### Why
Tenant self-setup is high-friction and error-prone; central management simplifies onboarding and support.

#### Implementation impact
- Remove tenant-facing Twilio credential setup flows from standard settings UX.
- Add/retain centralized platform controls for Twilio configuration and operations.

### DL-2026-02-14-066: SMS number provisioning and activation workflow must be fully automated
- Domain: SMS Provisioning Automation
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
New tenant SMS sender provisioning and activation must be automated end-to-end; manual provisioning is not acceptable.

#### Why
Manual provisioning does not scale and creates operational bottlenecks and inconsistency.

#### Implementation impact
- Build automated provisioning jobs/workflows for new tenant SMS resources.
- Track activation lifecycle states in tenant SMS records.
- Integrate provisioning status with SMS enablement and billing activation logic.

### DL-2026-02-14-067: Toll-free numbers are the default automated sender strategy
- Domain: Messaging Compliance
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Automated sender provisioning defaults to toll-free numbers, not 10DLC.

#### Why
10DLC onboarding is slower and less predictable for this product stage.

#### Implementation impact
- Provisioning workflow should request/provision toll-free sender resources by default.
- Compliance and approval state handling should align to toll-free verification lifecycle.

### DL-2026-02-14-068: SMS remains disabled until toll-free verification is approved
- Domain: Messaging Compliance
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Tenant SMS sending must remain disabled while toll-free verification is pending or rejected.

#### Why
This lowers compliance risk and prevents premature messaging before approval.

#### Implementation impact
- Gate outbound SMS send eligibility by verification status.
- Expose clear tenant-facing status (pending/approved/rejected) in billing or communications UX.

### DL-2026-02-14-069: SMS billing start trigger is verification approval timestamp
- Domain: Billing Automation
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
SMS recurring/usage billing starts when verification transitions to approved (approval timestamp is billing start trigger).

#### Why
Charging before approved service availability is undesirable and increases support disputes.

#### Implementation impact
- Persist `sms_approved_at` (or equivalent) and use it as billing activation marker.
- Prevent SMS recurring/usage charges while pending or rejected.

### DL-2026-02-14-070: Global pricing includes app monthly plus SMS monthly and per-segment fees
- Domain: Pricing
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Pricing is globally managed (not per-tenant custom by default) and includes base app monthly fee, SMS monthly add-on fee, and SMS per-segment fee.

#### Why
A single pricing set reduces complexity while product pricing is still being finalized.

#### Implementation impact
- Add global pricing controls for app + SMS components in admin-dev tooling.
- Ensure billing engine resolves effective global rates by date.

### DL-2026-02-14-071: Price-change notices send to company_email only with billing tooltip guidance
- Domain: Billing UX/Notifications
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Pricing-change notices are sent to `company_email` only, and the UI must include an info tooltip clarifying that billing receipts/price notices go to that address.

#### Why
This keeps communication routing simple and explicit.

#### Implementation impact
- Add/verify tooltip copy near company email field.
- Notice dispatch jobs target company email recipients only.

### DL-2026-02-14-072: SMS usage billing includes inbound and outbound traffic
- Domain: SMS Billing
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Bill SMS usage for both inbound and outbound traffic.

#### Why
Carrier/Twilio costs apply in both directions and must be passed through consistently.

#### Implementation impact
- Meter both inbound and outbound records for billing usage.
- Ensure usage aggregation logic includes both directions.

### DL-2026-02-14-073: SMS usage metering uses Twilio-accurate segment counts
- Domain: SMS Billing
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Usage billing is based on Twilio-accurate segment counts, not naive per-message counts.

#### Why
Segment-based billing matches provider charges and prevents margin leakage.

#### Implementation impact
- Store segment counts per message event.
- Aggregate invoice usage from segment totals.
- Add reconciliation path to Twilio usage if needed.

### DL-2026-02-14-074: Subscription and SMS add-on charges are billed automatically through Stripe
- Domain: Billing Automation
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
App subscription and SMS add-on charges are billed automatically in Stripe, not manual in-app invoicing.

#### Why
Automated billing improves reliability and reduces operational overhead.

#### Implementation impact
- Integrate pricing/usage outputs into Stripe billing flows.
- Sync resulting subscription invoice artifacts back into tenant billing UI.

### DL-2026-02-14-075: Admin-dev pricing console manages live and scheduled app/SMS rates plus notice actions
- Domain: Admin Ops
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Build an admin-dev pricing console that can set live rates, schedule future rate changes, and trigger notice emails for upcoming/effective-today changes.

#### Why
Pricing is still being finalized and needs operational control without code deploys.

#### Implementation impact
- Add pricing schedule data model (effective-date versioning).
- Add admin-dev UI/actions for scheduling and notification sends.
- Tie effective rate resolution to billing period and event timestamps.

### DL-2026-02-14-076: Subscription invoices are surfaced in Tenant Account Settings > Billing
- Domain: Billing UX
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Subscription invoices are shown in the tenant billing settings page, separate from operational warehouse invoices.

#### Why
SaaS billing and operational service invoicing serve different user workflows.

#### Implementation impact
- Add subscription-invoice list in tenant billing settings surface.
- Keep operational invoice tabs/reports scoped to warehouse billing artifacts.

### DL-2026-02-14-077: Public SMS opt-in page is tenant-branded and resolved by subdomain
- Domain: SMS Opt-In UX
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Public SMS opt-in pages are tenant-branded and resolve tenant context from subdomain.

#### Why
Subdomain resolution avoids exposing tenant IDs in URLs and improves reviewer/user clarity.

#### Implementation impact
- Add subdomain-to-tenant resolution for public SMS pages.
- Render tenant brand/company metadata on public SMS pages.

### DL-2026-02-14-078: Tenant editing of SMS compliance content is locked for simplicity
- Domain: SMS Governance
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Tenant users do not edit SMS compliance/legal content in this phase; content is centrally managed.

#### Why
Centralized control reduces compliance inconsistency during rollout.

#### Implementation impact
- Restrict/remove tenant edit controls for SMS compliance fields.
- Provide internal/admin controls for managed updates.

### DL-2026-02-14-079: Tenant-facing Twilio setup sections are removed from standard organization settings
- Domain: SMS Governance
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Twilio setup/verification sections are removed from standard tenant-facing organization settings in platform-managed mode.

#### Why
Tenant self-configuration conflicts with centralized managed-SMS operating model.

#### Implementation impact
- Update settings UI visibility/permission model for Twilio sections.
- Route tenant users to billing/activation status pages instead of Twilio setup forms.

### DL-2026-02-14-080: Internal comped billing override supports multiple internal tenants
- Domain: Billing Policy
- State: accepted
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
Provide a comped billing override capability that supports multiple internal tenants so owner/internal accounts can use the platform without charges.

#### Why
Internal self-use/testing is required without circular billing.

#### Implementation impact
- Add comp/waiver flags and exclusion logic in billing pipeline.
- Track waiver scope and audit trail.
- Apply override eligibility at tenant level for multiple internal tenants.

### DL-2026-02-14-081: First-month SMS monthly fee proration policy remains open pending pricing research
- Domain: Billing Policy
- State: draft
- Source: `docs/LOCKED_DECISION_QA_LOG_2026-02-14.md`
- Supersedes: -
- Superseded by: -
- Date created: 2026-02-14
- Locked at: -

#### Decision
First-month recurring SMS fee policy (prorated vs full-cycle) remains open pending final pricing research.

#### Why
Final rates/provider economics are still under review.

#### Implementation impact
- Billing engine must support proration mode if selected.
- Keep policy flag/configuration pending final lock decision.

## Decision entry template (copy/paste)

```md
### <Decision ID>: <Short title>
- Domain: <Module or cross-cutting area>
- State: <draft|accepted|locked|superseded|rejected>
- Source: <links/paths to Q&A, docs, issue, PR>
- Supersedes: <Decision ID or ->
- Superseded by: <Decision ID or ->
- Date created: <YYYY-MM-DD>
- Locked at: <YYYY-MM-DD or ->

#### Decision
<single clear statement of what was decided>

#### Why
<rationale and constraints>

#### Implementation impact
<files/modules/routes/tables affected>

#### Notes
<optional>
```

## Supersession example

If `DL-2026-02-14-010` needs to change after it is locked:

1. Keep `DL-2026-02-14-010` unchanged.
2. Add `DL-2026-03-01-002` with `supersedes: DL-2026-02-14-010`.
3. Mark `DL-2026-02-14-010` state as `superseded` (metadata-only state transition).

