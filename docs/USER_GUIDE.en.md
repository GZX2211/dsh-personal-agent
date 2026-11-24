# User Guide

<p align="left">
  <b>English</b> · <a href="USER_GUIDE.md">简体中文</a>
</p>

> This is the English translation. The Chinese version is authoritative.

This guide focuses only on the actual operation of the plugin, showing **how to use** every feature of the right-sidebar "Console"; for basic concepts and installation, see the [README](../README.en.md).

<!-- Image placeholder: Console main interface overview (right-sidebar tab strip + Overview page), with annotations -->
<p align="center">
  <!-- Image placeholder: main interface overview -->
  <img src="" width="100%" />
</p>

---

## 1. Getting to Know the Main Interface

The Console is a tab in the right sidebar, **not a standalone page**. After installation and a host restart, find the "Console" tab in the right sidebar to open it; it lands on "Overview" by default. The tab strip has six tabs, left to right:

| Tab | Purpose |
|---|---|
| Overview | Read-only summary: whether you are needed, what is running, and today's / 7-day data |
| Approvals | Review approvals awaiting your decision; pick an option / write an answer / skip and submit |
| Tickets | Browse tickets by stage, open one for detail |
| Events | See inputs arriving at the Router and their outcomes; search covers the full history |
| Sources | View / toggle / test / remove perception sources |
| Settings | Edit dispatch rules, decision permissions, the executor, and prompts |

The "Approvals" tab carries a red badge with the pending count, shown as `99+` above 99. The "Help" button at the far right of the toolbar shows guidance for the current page; Overview and Settings have no Help button.

**Language**: complete Chinese / English dictionaries are included and switch automatically with the DSH language setting; there is no separate language switch in the panel.

---

## 2. Overview

Overview answers three questions: is the system alive, what needs you, and who is running.

<!-- Image placeholder: Overview page, labeling the status pulse, attention bar, and in-progress list -->
<p align="center">
  <!-- Image placeholder: Overview core area -->
  <img src="" width="100%" />
</p>

- **Status pulse**: shows "Running / Sensing / Idle", or "Router session not ready" when the Router is unavailable; "Last activity" appears on the right. Click to open the Router session. If the connection fails, it warns that "Data may be stale".
- **Attention bar**: puts what most needs you first, showing at most 2 entries with the rest folded into "N more". Entry types: approval ("N approvals waiting", with "waiting N minutes" and "highest risk"), source ("N sources failing · may miss changes"), ticket ("N tickets interrupted", "N worker sessions offline", "N worker contexts ≥80%"). Click an entry to jump to its tab or session.
- **In progress**: lists worker sessions with context usage, showing "occupied / max slots" and "N queued"; beyond 5 rows, "N more" jumps to the Tickets tab. Each row can "Open worker session".
- **Today**: three read-only counters — approvals ("N decided · N pending"), tickets ("N done · N failed", average duration on hover), events ("N delivered · N filtered"). These three cells are not clickable.
- **Activity, last 7 days**: stacked "Delivered / Filtered" per day, with an empty state "No events in the last 7 days".
- **Footer**: cumulative tickets / approvals / events and running sources / timers — plain text, not clickable.

> In a fresh empty state it shows "No activity yet", with an "Open sources" button, or prompts you to say something to the Router first.

---

## 3. Approvals

Approvals are the only place that needs your action. The toolbar has three filter capsules — "Pending / Approved / All" — a search box, and a Help button.

<!-- Image placeholder: Approvals page, showing a pending card expanded with options and attachments -->
<p align="center">
  <!-- Image placeholder: approval operation panel -->
  <img src="" width="100%" />
</p>

1. Under the "Pending" capsule, find the target card and click "Expand" on its right.
2. The expanded card shows the full question, "Risk" (Low / Medium / High), and a single-choice group "Choose one option". You can also just write text in "Type your answer".
3. When there are attachments, an "Attachments" section appears; click a filename to open it in the sidebar — **attachments are view-only and cannot be edited**.
4. Click "Submit" to decide; click "Skip" if you do not want to handle it.

**Decision rules** (in priority order): explicit "Skip" → skipped; no option chosen but text written → the text becomes the answer; an option chosen → selected; **submitting with nothing filled in also equals skipped**. Any text you write is delivered along with any decision.

The post-submit message has two forms: "Decision delivered; the worker continues" means the session was still waiting and received your decision directly; "Decision saved; the worker was woken up" means the session had stopped and was woken with your saved decision.

> Handled approvals appear under the "Approved" capsule, read-only, showing the answer and time, with no options or submit button. "Open session" opens the matching worker session.

**Filtering hides, it does not gray out**: switching capsules or searching removes non-matching cards from the list and shows empty states such as "No matching approvals"; the search term and the filter intersect.

---

## 4. Tickets & Ticket Detail

### 4.1 Ticket List

The Tickets page has four filter capsules — "Queued / Running / Ended / All", defaulting to "Running". Note that **"Running" includes blocked and interrupted tickets**, which still hold an execution slot. Click a whole row to open its detail.

### 4.2 Ticket Detail

The detail page replaces the list within the same tab; it does not open a new tab.

<!-- Image placeholder: ticket detail page, showing the handoff timeline and delivery area -->
<p align="center">
  <!-- Image placeholder: ticket detail core area -->
  <img src="" width="100%" />
</p>

- **Header**: "Back to ticket list" (the capsule and search term are preserved on return), ticket short code, stage tag, "Open session" button (disabled before a session exists), plus owner, agent count, handoff count, and duration.
- **Handoff timeline**: each delegation is a handoff. Switch between "Lanes / Event stream"; lanes separate Router / You / Worker / subagent rows. Clicking a row expands full text and from → to in place rather than navigating (up to two session entry points). You can "Focus" on an agent.
  - Row types: Dispatch, Append, Supplement, Delegate, Report up, Sync, Approval, Decision, Intervene, Queued, Interrupted, Resumed, Closed, Failed, Discarded, plus a live "Live" row.
  - When the session log is unreadable, it shows "Session log unavailable; showing ledger facts only"; when partial, "Session log is partial; some deliveries may be missing".
- **Delivery** (folded by default, auto-expands when a ticket ends with a report): shows reason, report, and metrics (Turns / Handoffs / Duration / Tokens), with a "Copy" action. Shows "No report yet" when there is none.
- **Sessions & directory**: lists owner, subagents, working directory, and session ids; shows "No session yet" before dispatch.

> The Tickets pages are **read-only** — dispatch and supplement are tools the Router calls through conversation and cannot be operated from the panel.

---

## 5. Events

The Events page shows "inputs arriving at the Router" and their outcomes.

- **Two dropdowns**: "Event kind" (All kinds / User / Timer / Perception) and "Handling" (All handling / Dispatch / Append / Supplement / Reply / Ignored (filtered)).
- **Outcome badges**: Pending, Filtered (optionally with "no match / throttled / no change"), Dispatch / Append / Supplement (with a ticket short code), Reply. A signal with no explicit handling action at turn end is marked "Inferred", with a hover explanation. Badges carrying a ticket are clickable and open that ticket.
- **Source line**: user messages show "Conversation"; others show "source · thread".
- **Search**: after typing, a 250 ms debounce searches the **whole history** (not just the recent snapshot), showing "Searching history…"; older in-flight searches are cancelled.

> "Ignored (filtered)" means a perception rule stopped the signal at the filter step before delivery to the Router; it is not a ticket failure.

---

## 6. Sources

The Sources page manages **perception sources**: they let the Agent reach you while you are away.

<!-- Image placeholder: Sources page, showing a source card with thread toggles -->
<p align="center">
  <!-- Image placeholder: source operation panel -->
  <img src="" width="100%" />
</p>

- Channels: "Host events / Local files / Script"; statuses: "Running / Stopped / Error". Cards show the thread count and "Last triggered / Never triggered".
- **Toggle**: switch the source or an individual thread. It applies immediately: the UI updates locally first, and on failure it rolls back and warns "The switch failed; the previous state was restored". A disabled thread produces and records no signals of that kind.
- **Test**: "Test" really delivers a synthetic candidate, listed under "Latest signals"; with no result it shows "The test produced no new signal."
- **Restart**: appears only when status is "Error" and simply re-enables the source.
- **Delete**: requires confirmation, with a dialog stating "It stops watching; its past signals stay on the events page." Deleting an already-deleted source is not an error.
- **Create**: sources can only be created **in conversation** — "Create in conversation" jumps to the Router session, where you say "watch … and tell me when it changes" (the button is disabled without a Router session). The panel cannot edit a source's paths, events, or script command.

> Timed tasks belong to the host automation page and are not repeated here; only their count appears in the Overview footer. This plugin neither creates nor modifies timed tasks.

---

## 7. Settings

Settings has three sections: "Dispatch rules / Executor / Prompts". A save bar appears only when there are changes, with "Discard" and "Save"; success shows "Settings saved".

### 7.1 Dispatch Rules

- "Dispatch rules" go only into the Router prompt and decide what to hand to a worker session; **only enabled rules apply**.
- "Decision permissions" go only into the Worker prompt, stating what must be approved and what can be decided locally.
- Both groups share one version and are saved together. Use "Add rule / Add permission" and "Remove rule / Remove permission", up to 50 entries; names and instructions cannot be empty, names are limited to 40 characters and instructions to 500.
- Two entries with identical name and instruction are rejected as duplicates; newlines are collapsed to spaces so a rule occupies a single line.

### 7.2 Executor

- "Executor model" lets you pick provider, model, and reasoning effort (optional), or "Inherit the DSH default". These settings **only affect worker sessions created afterwards**, never ones already running.
- "Parallel tickets" ranges 1–100, default 5. **Lowering it does not stop running tickets** — it only limits later dispatches.
- "Execution root directory" uses the default when empty; when set, it must be an absolute path.

### 7.3 Prompts

- Three texts: "Shared", "Router role", "Worker role"; the shared text enters both roles.
- Three subpages: "Edit / Full prompt / History". "Full prompt" can be viewed per role, compared against defaults, and copied in full.
- "History" lists saved versions; "View" is read-only, while "Load into editor" puts an old version into the editor. **Loading still requires clicking "Save" to take effect**.
- Each prompt is limited to 32,000 characters and cannot be empty.

> If saving shows "Settings changed elsewhere; the latest version was loaded", the version was changed elsewhere. "The input is invalid; check it before saving" means you should fix the fields per the rules above.

---

## 8. Common Operational Questions

- **The worker did nothing after I submitted an approval?** Check the message: "Decision delivered" means the session was waiting and should continue immediately; "Decision saved; the worker was woken up" means the original session had stopped and was woken. If the target session was archived, the decision is discarded and you need to re-dispatch.
- **Why is a signal "Filtered / Ignored"?** A perception rule stopped it before delivery (no match / throttled / no change) without bothering the Router. Check the thread toggles and configuration on the Sources page.
- **What does a "Blocked" ticket mean?** It is waiting for your approval and still holds an execution slot; handle it on the Approvals page to release it.
- **Cannot find older signals?** A snapshot carries only the latest 200; type a keyword in the Events search box to search the full history (up to 500 per query).
- **Changed the executor model but the current ticket did not change?** Executor settings only affect sessions created afterwards; running tickets keep the model they were created with.
- **Restored a prompt but nothing changed?** Loading only puts it in the editor; you must click "Save".
- **A source toggle failed?** The system restores the previous state and warns you; retry shortly. For persistent failures, check the source configuration in Settings or in conversation.

If you hit an issue you cannot resolve, note the circumstances and reproduce it once if you can, then open an issue; if you are comfortable locating and fixing the code, a PR is welcome too.
