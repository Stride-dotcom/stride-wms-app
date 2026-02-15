# Decision Ledger Builder Prompts

Use these prompts with any coding builder (Cursor agent, Claude, ChatGPT code agent) to keep the ledger current.

---

## Prompt A: Import current chat/document into the ledger (with topic-named source + backup copy)

```md
Update the locked decision ledger from this chat or source document:

CHAT_TOPIC: <short topic title, e.g., "Locations & Containers">
TOPIC_SLUG: <UPPER_SNAKE_OR_SLUG, e.g., LOCATIONS_CONTAINERS>
SOURCE_MODE: <current_chat|file_path>
SOURCE_PATH: <path to PDF/markdown/transcript if SOURCE_MODE=file_path>
LEDGER_PATH: docs/LOCKED_DECISION_LEDGER.md
LOG_PATH: docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md
TODAY: <YYYY-MM-DD>
ACTOR: <builder/agent name>

Requirements:
0) Create a dated backup copy of the ledger before making changes:
   - docs/LOCKED_DECISION_LEDGER_COPY_<TOPIC_SLUG>_<TODAY>.md
1) Create a topic-named source artifact for this import:
   - docs/LOCKED_DECISION_SOURCE_<TOPIC_SLUG>_<TODAY>.md
   - If SOURCE_MODE=current_chat: extract Q&A from the current chat into this file.
   - If SOURCE_MODE=file_path: read SOURCE_PATH fully and normalize key Q&A/decision excerpts into this file.
2) Read the source artifact fully and extract explicit decisions only (no guesses).
3) Group duplicates and map each extracted Q&A item to:
   - existing decision ID (if already covered), or
   - new decision ID to add.
4) Add only net-new decisions to LEDGER_PATH using IDs DL-<date>-<nnn> (continue sequence safely).
5) Set state:
   - draft if uncertain or conflicting,
   - accepted if clear and approved in source,
   - locked only if source is explicitly authoritative/final.
6) For each new decision, include:
   - title, domain, state, source, supersedes, created date
   - decision statement
   - why/rationale
   - implementation impact
7) Preserve immutability:
   - Do not rewrite existing locked decision bodies.
   - If a locked decision changes, create a new decision with supersedes=<old ID>.
8) Append implementation events in LOG_PATH with event type `planned` for new accepted/locked decisions.
9) Add an import coverage summary in your response:
   - source artifact path
   - backup copy path
   - Q&A items extracted
   - mapped to existing decisions
   - new decisions added
   - unresolved/open questions (draft decisions)
10) For multi-chat continuity:
   - Never overwrite prior source artifacts.
   - Reuse TOPIC_SLUG for the same workstream so files are easy to group.
   - Carry unresolved draft decisions forward until explicitly resolved.
11) Return a summary with:
   - decisions added
   - decisions superseded
   - unresolved conflicts/questions
12) Commit and push with message:
   "docs: import decisions from <source name> into locked ledger"
```

---

## Prompt B: Check off implementation progress for decisions

```md
Update decision implementation progress only.

LEDGER_PATH: docs/LOCKED_DECISION_LEDGER.md
LOG_PATH: docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md
EVIDENCE: <commit hashes, PR links, files changed, test results>
TARGET_DECISIONS: <comma-separated IDs, e.g., DL-2026-02-14-001,DL-2026-02-14-004>
NEW_EVENT_TYPE: <in_progress|completed|verified|blocked>
TODAY: <YYYY-MM-DD>

Requirements:
1) Do not edit locked decision content.
2) Append one new row per target decision to LOG_PATH with:
   - event id DLE-<date>-<nnn>
   - date
   - decision id
   - NEW_EVENT_TYPE
   - evidence
   - actor
   - concise notes
3) If evidence conflicts with a locked decision, do not modify the old decision.
   Instead, add a "conflict note" and propose a superseding decision ID.
4) Return a summary table of appended events.
5) Commit and push with message:
   "docs: log decision progress (<NEW_EVENT_TYPE>)"
```

---

## Prompt C: Lock approved decisions at milestone boundary

```md
Lock the following accepted decisions:
<decision IDs>

Rules:
1) Change state from accepted -> locked in docs/LOCKED_DECISION_LEDGER.md.
2) Set locked date to today.
3) Append `verified` events to docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md with evidence.
4) Do not alter decision text while locking.
5) Commit and push:
   "docs: lock approved decisions for milestone <name>"
```

---

## Quick usage pattern

1. Pick a stable TOPIC_SLUG for the workstream (example: `LOCATIONS_CONTAINERS`) and reuse it across related chats.
2. Run Prompt A after each major Q&A/planning artifact (or at end of each chat) to avoid decision loss.
3. Run Prompt B whenever build progress changes.
4. Run Prompt C at milestone close when decisions are final.

