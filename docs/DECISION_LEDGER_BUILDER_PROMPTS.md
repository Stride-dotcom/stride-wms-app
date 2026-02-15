# Decision Ledger Builder Prompts (Packet Workflow)

Use these prompts with any coding agent to maintain decision records without merge conflicts.

## Canonical paths

- Master ledger: `docs/ledger/MASTER_LEDGER.md`
- Workflow guide: `docs/ledger/README.md`
- Source artifacts: `docs/ledger/sources/*`
- Pending packets: `docs/ledger/packets/pending/*`

> Do not directly edit `docs/LOCKED_DECISION_LEDGER.md` or
> `docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md` in this workflow.

---

## Prompt A: Capture this chat into source + pending packet

```md
Migrate decision updates from this chat into the packet workflow.

CHAT_TOPIC: <short title>
TOPIC_SLUG: <topic-slug>
CHAT_ID: <chat id>
TODAY: <YYYY-MM-DD>
ACTOR: <builder/agent>

Create:
1) Source artifact
   docs/ledger/sources/LOCKED_DECISION_SOURCE_<TOPIC_SLUG>_<TODAY>_chat-<CHAT_ID>.md
2) Pending packet
   docs/ledger/packets/pending/LDP-<TODAY>-<TOPIC_SLUG>-<CHAT_ID>.md

Packet must include sections:
- Decision Index Rows
- Detailed Decision Entries
- Implementation Log Rows

Validation:
- Run npm run ledger:apply-packets:dry-run
- Ensure packet parses and IDs are discoverable

Output:
- source artifact path
- pending packet path
- decision IDs captured
- event IDs captured
- unresolved draft decisions

Commit/push:
"docs: migrate this chat to packet-based ledger workflow"
```

---

## Prompt B: Add implementation progress in packet form

```md
Capture implementation progress as a new pending packet.

TOPIC_SLUG: <topic-slug>
CHAT_ID: <chat id>
TODAY: <YYYY-MM-DD>
TARGET_DECISIONS: <DL IDs>
EVENT_ROWS: <DLE rows with evidence>

Create:
docs/ledger/packets/pending/LDP-<TODAY>-<TOPIC_SLUG>-<CHAT_ID>.md

Include:
- Decision Index Rows (if needed)
- Detailed Decision Entries (if needed)
- Implementation Log Rows (required)

Run:
npm run ledger:apply-packets:dry-run
```

---

## Prompt C: Packet validation only

```md
Validate pending ledger packets without mutating master files.

Run:
npm run ledger:apply-packets:dry-run

Return:
- packet files parsed
- decisions found
- events found
- parse errors (if any)
```

