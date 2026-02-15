# Locked Decision Source — Locations & Containers Chat Q&A (2026-02-15)

## Source metadata

- Source type: Chat transcript (this session)
- Subject: Locations page repair, location types/capacity/import-export, and container workflow/scanning
- Compiled by: builder
- Compiled on: 2026-02-15
- Purpose: Normalize explicit Q&A decisions for ledger import

## Extraction rules used

1. Only explicit user decisions/approvals are included.
2. Duplicate statements are grouped under one Q&A record.
3. Ambiguous or unresolved points are marked as unresolved (not accepted).
4. No inferred decisions are added.

## Q&A records (explicit only)

### QA-2026-02-15-001
- Question/context: Locations page repair scope.
- Explicit answer/decision:
  - Remove the "Quick Add Bay" section from the locations UI.
  - Rename list terminology from "Bays" to "Storage Locations."
  - Show/retain usable location type data in the list and import/export flow.
  - Provide a way to input dimensions so square/cubic totals can be shown.
  - Fix/remove duplicate storage icons on location detail header.
  - Container workflows must support assigning/moving container location and cascading item location updates.

### QA-2026-02-15-002
- Question/context: Allowed location types for new use.
- Explicit answer/decision:
  - "Yes but only list aisle, bay, shelf, bin, dock, area."
  - "We will be creating a separate column later called zone used for grouping locations together."

### QA-2026-02-15-003
- Question/context: Export behavior.
- Explicit answer/decision:
  - "Make the Export button download Excel (.xlsx) with the same synced column system."

### QA-2026-02-15-004
- Question/context: Import regressions after export/type changes.
- Explicit answer/decision:
  - Legacy area/zone-style codes must not default to bin during type inference.
  - Archived exports must re-import as archived/inactive (not active).

### QA-2026-02-15-005
- Question/context: Working method before additional Q&A.
- Explicit answer/decision:
  - "First review these documents and then let’s continue the Q&A."

### QA-2026-02-15-006
- Question/context: Container use case clarification (receiving and warehouse movement).
- Explicit answer/decision:
  - Containers are used to group multiple item-coded units.
  - Moving a container should update each contained item's location automatically.
  - Container-level movement is required to avoid manual per-item moves.

### QA-2026-02-15-007
- Question/context: Scan flow for putting existing items into containers.
- Explicit answer/decision:
  - Operational scan sequence should be item scan followed by container scan to move item into container.

### QA-2026-02-15-008
- Question/context: Location representation for items in containers.
- Explicit answer/decision:
  - Candidate display format proposed: `ParentLocation (ContainerCode)` (example `A1.2E (CNT-123)`).
  - Alternate two-column approach was also discussed.
- Status: unresolved (no final selection explicitly approved).

### QA-2026-02-15-009
- Question/context: Conversation reset.
- Explicit answer/decision:
  - "Let’s back up and start over at question 1 regarding containers. Ask me questions one at a time."

### QA-2026-02-15-010
- Question/context: Container model details (proposal for confirmation).
- Explicit answer/decision:
  - Proposed model states container is a movable storage sub-location with:
    - Auto-assigned editable code (example `CNT-123`),
    - Required starting warehouse location,
    - Item scan then container scan to assign containment,
    - Container move scan updates container location and cascades item location updates.
  - Proposal included "location type = container" as scanner-recognized type.
- Status: unresolved/needs final confirmation.

### QA-2026-02-15-011
- Question/context: Parent location hierarchy in locations form.
- Explicit answer/decision:
  - Remove parent location from UI for location add/edit.

### QA-2026-02-15-012
- Question/context: Existing parent location data handling.
- Explicit answer/decision:
  - "Delete and clear. It’s never been used so no data will be lost."

### QA-2026-02-15-013
- Question/context: Selector UX for default inbound/outbound locations.
- Explicit answer/decision:
  - Selector behavior should be: click to open full list, type to filter, choose matching location.
  - Search keys should include both code and name.

### QA-2026-02-15-014
- Question/context: Where container creation/management belongs in UI.
- Explicit answer/decision:
  - Container creation should not be nested under item detail.
  - Containers should be treated as location-adjacent sub-location management.

### QA-2026-02-15-015
- Question/context: Container scanning behavior in stocktake/outbound.
- Explicit answer/decision:
  - Container scanning in stocktake and outbound should be available as a controlled bulk shortcut.
  - This behavior should be controlled by organization preference toggles.

### QA-2026-02-15-016
- Question/context: Location record management behavior.
- Explicit answer/decision:
  - Existing locations need to be editable.

## Notes

- This source is not marked authoritative/final; imported decisions should default to `accepted` when explicit and unambiguous, or `draft` when unresolved/conflicting.
