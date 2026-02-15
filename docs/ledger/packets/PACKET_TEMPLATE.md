# Ledger Pending Packet Template

- Packet ID: `LDP-<YYYY-MM-DD>-<topic-slug>-<chat-id>`
- Date: `<YYYY-MM-DD>`
- Topic slug: `<topic-slug>`
- Chat ID: `<chat-id>`
- Source artifact:
  - `docs/ledger/sources/LOCKED_DECISION_SOURCE_<TOPIC_SLUG>_<YYYY-MM-DD>_chat-<CHAT_ID>.md`

## Decision Index Rows

| Decision ID | Action | Title | State | Notes |
|---|---|---|---|---|
| DL-YYYY-MM-DD-NNN | add\|update\|reference | <title> | draft\|accepted\|locked | <notes> |

## Detailed Decision Entries

### DL-YYYY-MM-DD-NNN
- Domain: <domain>
- State: <state>
- Source: <source reference>
- Supersedes: <decision IDs or ->
- Superseded by: <decision IDs or ->

#### Decision
<decision statement>

#### Why
<rationale>

#### Implementation impact
<implementation notes>

## Implementation Log Rows

| Event ID | Date | Decision ID | Event Type | Evidence | Actor | Notes |
|---|---|---|---|---|---|---|
| DLE-YYYY-MM-DD-NNN | YYYY-MM-DD | DL-YYYY-MM-DD-NNN | planned\|in_progress\|completed\|verified\|blocked | <evidence> | <actor> | <notes> |
