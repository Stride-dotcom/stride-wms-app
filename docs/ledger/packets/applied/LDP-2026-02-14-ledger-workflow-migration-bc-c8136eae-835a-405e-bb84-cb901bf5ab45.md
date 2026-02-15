# LDP-2026-02-14-ledger-workflow-migration-bc-c8136eae-835a-405e-bb84-cb901bf5ab45

## Decision Index Rows

| decision_id | date | topic_slug | summary | source_artifact |
|---|---|---|---|---|
| DEC-2026-02-14-LDG-001 | 2026-02-14 | ledger-workflow-migration | This chat must use packet workflow artifacts for decision updates. | docs/ledger/sources/LOCKED_DECISION_SOURCE_LEDGER_WORKFLOW_MIGRATION_2026-02-14_chat-bc-c8136eae-835a-405e-bb84-cb901bf5ab45.md |
| DEC-2026-02-14-LDG-002 | 2026-02-14 | ledger-workflow-migration | Legacy locked master files are read-only for this chat; no direct edits allowed. | docs/ledger/sources/LOCKED_DECISION_SOURCE_LEDGER_WORKFLOW_MIGRATION_2026-02-14_chat-bc-c8136eae-835a-405e-bb84-cb901bf5ab45.md |
| DEC-2026-02-14-LDG-003 | 2026-02-14 | ledger-workflow-migration | Packet dry-run validation is required before apply. | docs/ledger/sources/LOCKED_DECISION_SOURCE_LEDGER_WORKFLOW_MIGRATION_2026-02-14_chat-bc-c8136eae-835a-405e-bb84-cb901bf5ab45.md |

## Detailed Decision Entries

### DEC-2026-02-14-LDG-001
- Date: 2026-02-14
- Status: locked
- Context: user migration notice for this chat.
- Decision: capture decision deltas in `docs/ledger/sources/*` and `docs/ledger/packets/pending/*`.
- Rationale: avoid conflicts on shared master decision/log files.
- Source: docs/ledger/sources/LOCKED_DECISION_SOURCE_LEDGER_WORKFLOW_MIGRATION_2026-02-14_chat-bc-c8136eae-835a-405e-bb84-cb901bf5ab45.md

### DEC-2026-02-14-LDG-002
- Date: 2026-02-14
- Status: locked
- Context: explicit guardrail for this chat.
- Decision: do not directly edit `docs/LOCKED_DECISION_LEDGER.md` or `docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md`.
- Rationale: maintain immutable master files during active migration and packet-only updates.
- Source: docs/ledger/sources/LOCKED_DECISION_SOURCE_LEDGER_WORKFLOW_MIGRATION_2026-02-14_chat-bc-c8136eae-835a-405e-bb84-cb901bf5ab45.md

### DEC-2026-02-14-LDG-003
- Date: 2026-02-14
- Status: locked
- Context: migration validation instruction.
- Decision: run `npm run ledger:apply-packets:dry-run` before packet apply.
- Rationale: parse/shape validation gate for packet content.
- Source: docs/ledger/sources/LOCKED_DECISION_SOURCE_LEDGER_WORKFLOW_MIGRATION_2026-02-14_chat-bc-c8136eae-835a-405e-bb84-cb901bf5ab45.md

## Implementation Log Rows

| event_id | date | decision_id | type | summary |
|---|---|---|---|---|
| EVT-2026-02-14-LDG-001 | 2026-02-14 | DEC-2026-02-14-LDG-001 | migration | Synced branch with `origin/main` via fetch+rebase and verified up-to-date with pull. |
| EVT-2026-02-14-LDG-002 | 2026-02-14 | DEC-2026-02-14-LDG-001 | docs | Created this chat source artifact and pending packet under packet workflow paths. |
| EVT-2026-02-14-LDG-003 | 2026-02-14 | DEC-2026-02-14-LDG-003 | validation | Executed `npm run ledger:apply-packets:dry-run`; command not available on this branch after sync. |
