# Ledger Packet Workflow (Conflict-Safe)

This directory is the conflict-safe replacement workflow for decision updates.

## Canonical files

- `docs/ledger/MASTER_LEDGER.md` — canonical merged ledger (read-only during chat execution)
- `docs/ledger/sources/*` — normalized source artifacts for each chat/import
- `docs/ledger/packets/pending/*` — append-only pending ledger packets
- `docs/ledger/packets/applied/*` — packets after application

## Hard rule

For this workflow, do **not** directly edit:

- `docs/LOCKED_DECISION_LEDGER.md`
- `docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md`

Use source artifacts + pending packets only.

## Per-chat update process

1. Create/append source artifact:
   - `docs/ledger/sources/LOCKED_DECISION_SOURCE_<TOPIC_SLUG>_<YYYY-MM-DD>_chat-<CHAT_ID>.md`
2. Create pending packet:
   - `docs/ledger/packets/pending/LDP-<YYYY-MM-DD>-<TOPIC_SLUG>-<CHAT_ID>.md`
3. Packet must include sections:
   - `## Decision Index Rows`
   - `## Detailed Decision Entries`
   - `## Implementation Log Rows`
4. Validate parsing:
   - `npm run ledger:apply-packets:dry-run`

## Dry-run validator behavior

The dry-run command validates pending packet structure and reports extracted:

- decision IDs (`DL-...`)
- event IDs (`DLE-...`)

It does not mutate the master ledger.
