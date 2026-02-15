# Ledger Pending Packet

- Packet ID: `LDP-2026-02-15-HEAT_MAP_VISUALIZATION_PHASE1-bc-1cce`
- Date: `2026-02-15`
- Topic slug: `HEAT_MAP_VISUALIZATION_PHASE1`
- Chat ID: `bc-1cce`
- Source artifact:
  - `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md`

## Decision Index Rows

| Decision ID | Action | Title | State | Notes |
|---|---|---|---|---|
| DL-2026-02-15-017 | add | Heat map phase implementation must map to existing schema names when possible | accepted | Prefer compatibility mapping over schema churn. |
| DL-2026-02-15-018 | add | Access matrix for HMV-P1 is builder admin+manager and viewer admin+manager+warehouse | accepted | Role keys align to app role model. |
| DL-2026-02-15-019 | add | Rename this initiative to Heat Map & Visualization Phase 1 (HMV-P1) | accepted | Supersedes prior "Phase 5.1" naming in planning context. |
| DL-2026-02-15-020 | add | HMV-P1 includes Map Builder as prerequisite capability | accepted | Heat map depends on map setup. |
| DL-2026-02-15-021 | add | Heat viewer remains read-only but supports zone tap drill-down to location-level capacity list | accepted | Interactivity is inspection-only, not editing. |
| DL-2026-02-15-022 | add | Final handoff process auto-resolves PR conflicts and verifies mergeability | accepted | Delivery policy requested by user. |
| DL-2026-02-15-023 | add | If scope overruns, visualizer sequencing may be deferred behind builder delivery | draft | Trigger criteria not yet finalized. |

## Detailed Decision Entries

### DL-2026-02-15-017
- Domain: Heat Map / Data Integration
- State: accepted
- Source: `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md#qa-hmv-2026-02-15-001`
- Supersedes: -
- Superseded by: -

#### Decision
Implement HMV-P1 using current Stride schema/field conventions wherever possible, and add compatibility layers only where contract semantics require it.

#### Why
User explicitly chose compatibility-first implementation to reduce migration drift and avoid unnecessary schema disruption.

#### Implementation impact
- Prefer existing columns/functions/table conventions in migrations/hooks/UI wiring.
- Document any unavoidable naming bridge explicitly.

### DL-2026-02-15-018
- Domain: Heat Map / Access Control
- State: accepted
- Source: `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md#qa-hmv-2026-02-15-002`
- Supersedes: -
- Superseded by: -

#### Decision
Set HMV-P1 access as:
- Map Builder: admin + manager
- Heat Viewer: admin + manager + warehouse

#### Why
User provided explicit role access expectations for both build and view workflows.

#### Implementation impact
- Route guards and in-app entry points must enforce this matrix.
- Viewer remains broadly operational; builder remains elevated.

### DL-2026-02-15-019
- Domain: Program Governance
- State: accepted
- Source: `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md#qa-hmv-2026-02-15-004`
- Supersedes: -
- Superseded by: -

#### Decision
Use "Heat Map & Visualization Phase 1 (HMV-P1)" as the planning and implementation phase label for this workstream.

#### Why
User explicitly changed phase naming because this is being treated as a new feature initiative.

#### Implementation impact
- Update planning references and execution summaries to HMV-P1 nomenclature.

### DL-2026-02-15-020
- Domain: Heat Map / Scope
- State: accepted
- Source: `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md#qa-hmv-2026-02-15-005`
- Supersedes: -
- Superseded by: -

#### Decision
Map Builder is in-scope for HMV-P1 because heat visualization is not usable before map creation/setup exists.

#### Why
User explicitly stated builder must be phase one due to dependency ordering.

#### Implementation impact
- Phase plan must sequence builder foundation before/with viewer enablement.
- Do not ship viewer-only if it leaves tenants without map authoring path.

### DL-2026-02-15-021
- Domain: Heat Map / UX Behavior
- State: accepted
- Source: `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md#qa-hmv-2026-02-15-003`
- Supersedes: -
- Superseded by: -

#### Decision
Heat Viewer remains read-only but includes zone tap/click drill-down showing location-level capacity/utilization details in a list/panel.

#### Why
User identified operational blind spot in zone-only aggregation and requested direct visibility into per-location availability.

#### Implementation impact
- Keep viewer non-editing.
- Add interaction model for zone detail inspection without per-zone API fanout.

### DL-2026-02-15-022
- Domain: Delivery Process
- State: accepted
- Source: `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md#qa-hmv-2026-02-15-006`
- Supersedes: -
- Superseded by: -

#### Decision
Before final handoff, the agent must auto-resolve PR conflicts and ensure the PR is mergeable without waiting for user conflict reports.

#### Why
User explicitly set this as a standing operating rule for future handoffs.

#### Implementation impact
- Add mergeability verification/conflict resolution as mandatory pre-handoff checklist.

### DL-2026-02-15-023
- Domain: Heat Map / Scope Contingency
- State: draft
- Source: `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md#qa-hmv-2026-02-15-005`
- Supersedes: -
- Superseded by: -

#### Decision
If HMV-P1 scope overruns, visualizer sequencing may be deferred behind builder completion.

#### Why
User offered contingency language but did not define specific criteria/thresholds.

#### Implementation impact
- Requires explicit acceptance criteria for scope trigger before activation.

## Implementation Log Rows

| Event ID | Date | Decision ID | Event Type | Evidence | Actor | Notes |
|---|---|---|---|---|---|---|
| DLE-2026-02-15-023 | 2026-02-15 | DL-2026-02-15-017 | planned | `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md` | gpt-5.3-codex-high | Captured compatibility-first schema mapping directive. |
| DLE-2026-02-15-024 | 2026-02-15 | DL-2026-02-15-018 | planned | `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md` | gpt-5.3-codex-high | Captured builder/viewer role access matrix. |
| DLE-2026-02-15-025 | 2026-02-15 | DL-2026-02-15-019 | planned | `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md` | gpt-5.3-codex-high | Captured HMV-P1 phase naming directive. |
| DLE-2026-02-15-026 | 2026-02-15 | DL-2026-02-15-020 | planned | `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md` | gpt-5.3-codex-high | Captured phase-one map builder prerequisite requirement. |
| DLE-2026-02-15-027 | 2026-02-15 | DL-2026-02-15-021 | planned | `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md` | gpt-5.3-codex-high | Captured read-only heat viewer with zone drill-down detail behavior. |
| DLE-2026-02-15-028 | 2026-02-15 | DL-2026-02-15-022 | planned | `docs/ledger/sources/LOCKED_DECISION_SOURCE_HEAT_MAP_VISUALIZATION_PHASE1_2026-02-15_chat-bc-1cce.md` | gpt-5.3-codex-high | Captured mandatory pre-handoff mergeability/conflict-resolution rule. |
