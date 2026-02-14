# Decision Ledger Builder Prompts

Use these prompts with any coding builder (Cursor agent, Claude, ChatGPT code agent) to keep the ledger current.

---

## Prompt A: Import a new Q&A or plan document into the ledger

```md
Update the locked decision ledger using this new source document:

SOURCE_PATH: <path to PDF/markdown/transcript>
LEDGER_PATH: docs/LOCKED_DECISION_LEDGER.md
LOG_PATH: docs/LOCKED_DECISION_IMPLEMENTATION_LOG.md
TODAY: <YYYY-MM-DD>

Requirements:
1) Read SOURCE_PATH fully.
2) Extract explicit decisions only (no guesses). Group duplicates.
3) Add new decision entries to LEDGER_PATH using IDs DL-<date>-<nnn>.
4) Set state:
   - draft if uncertain or conflicting,
   - accepted if clear and approved in source,
   - locked only if source is marked authoritative/final.
5) For each new decision, include:
   - title, domain, state, source, supersedes, created date
   - decision statement
   - why/rationale
   - implementation impact
6) Preserve immutability:
   - Do not rewrite existing locked decision bodies.
   - If a locked decision changes, create a new decision with supersedes=<old ID>.
7) Append implementation events in LOG_PATH with event type `planned` for new accepted/locked decisions.
8) Return a summary with:
   - decisions added
   - decisions superseded
   - unresolved conflicts/questions
9) Commit and push with message:
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

1. Run Prompt A after each major Q&A/planning artifact.
2. Run Prompt B whenever build progress changes.
3. Run Prompt C at milestone close when decisions are final.

