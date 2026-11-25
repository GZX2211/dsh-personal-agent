<p align="center">
  <!-- Image placeholder: main interface overview. Suggest capturing the "Overview" page of the right-sidebar Console, showing the status pulse, attention bar, in-progress list, and today's stats -->
  <img src="" width="100%" />
</p>

<h1 align="center">dsh-gzx-agent</h1>

<p align="center">
  A personal agent plugin built on <a href="https://github.com/deepseek-ai">DeepSeek Harness (DSH)</a><br>
  A pinned router session dispatches tickets, worker sessions run independently, and approvals reach you without relaying
</p>

<p align="center">
  <b>English</b> · <a href="README.md">简体中文</a>
</p>

<p align="center">
  <!-- Badge sources: version from package.json 0.1.0; license from package.json MIT; runtime from engines.node -->
  <a href="README.md"><img alt="language" src="https://img.shields.io/badge/language-English-blue"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-lightgrey"></a>
  <a href="package.json"><img alt="version" src="https://img.shields.io/badge/version-0.1.0-0891b2"></a>
  <a href="package.json"><img alt="runtime" src="https://img.shields.io/badge/node-%5E22.19%20%7C%20%3E%3D24-green"></a>
</p>

---

## Overview

Keeping track of several worker sessions, clicking through approvals window by window, and constantly asking for progress quickly fragments your attention. DSH itself makes every session an independent event log with no shared state channel between sessions, so cross-session state and approvals have nowhere to live.

**dsh-gzx-agent** lifts task state and approvals out of the probabilistic layer (the models) into a dedicated **deterministic event layer**: a **Router session** is pinned in the left sidebar to take conversation and dispatch work, each task lands in its own **Worker session**, and anything requiring your input is surfaced by the **Console** in the right sidebar. State and approvals are projected directly to you by the Console — not relayed through the Router and not charged to its context budget.

```text
User ──chat──▶ Router session ──dispatch──▶ L2 ledger (append-only)
                                              │ projection
                                              ▼
                                       Console ◀──── human (view status / decide)
                                              │ dispatch / brief
                                              ▼
                              Worker session ──submit approval──▶ L2 ledger
```

Works out of the box: no extra services, the ledger lives in a local state directory, and the Router session is created and reused automatically on first launch. Five concurrent tickets by default, with the model inheriting the current DSH default.

> Design stance: the ledger is the single source of truth, state is a projection of events; configuration is the source, execution is the projection.

---

## Highlights

✦ **Tickets and approvals have no status field**
  - Stages are derived entirely from the event sequence, so state can never conflict with the ledger and can be replayed in order
  - Stage is decided by event order rather than wall-clock time, making it naturally resilient to clock changes; writes use content-derived idempotency keys

✦ **Approval gates are not relayed through the Router**
  - A Worker blocks while submitting an approval; your decision is delivered straight to the worker session, with separate paths for an archived session, one still blocked, and one already stopped
  - "Deliver first, record later" — on restart, decisions that were delivered but not recorded are healed from the session log

✦ **Perception sources turn external changes into signals**
  - Supports host-event, file-watch, and script channels; create one just by saying "watch … and tell me when it changes" in conversation
  - Filtering, de-duplication, and throttling happen before anything is committed to the ledger; sources can be toggled, tested, restarted, and deleted from the panel

<!-- Insert an image group after every 2-3 highlights -->
<table>
  <tr>
    <td width="50%" valign="top"><!-- Image placeholder: Console "Overview" page, showing the attention bar and in-progress list --><img src="" width="100%" /></td>
    <td width="50%" valign="top"><!-- Image placeholder: Console "Approvals" page, showing a pending card with options --><img src="" width="100%" /></td>
  </tr>
</table>

> On the left is a passive status view; on the right is the only gate that needs your action — neither appears inside the Router conversation.

✦ **Clear capability boundaries per role**
  - The Router only receives dispatch and query tools; it cannot read/write files or run commands directly. The Worker only receives the approval-submission tool
  - All technical work is isolated in ticket sessions, keeping the Router's context budget for intent understanding and on-demand ledger queries

---

## Core Concepts

| Concept | Description |
|------|------|
| **Router session** | The pinned conversation entry at the top of the left sidebar; understands intent, dispatches work, and queries the ledger on demand. Its identity is persisted and reused on reload rather than recreated |
| **Worker session** | One independent session and working directory per ticket; created only when released, so queued tickets leave no trace in the left sidebar |
| **Ticket** | One delegated task. No status field — stage `queued / running / blocked / ended` is derived from the event sequence, and `blocked` is a sub-label of `running` |
| **Approval** | A gate for an action requiring your sign-off. Decision is `selected / answered / skipped`; transport is `inline / followup`. Attachments are submitted by the Worker and read-only for you |
| **Signal** | One input arriving at the Router, sourced from `user-message / timer / perception`; its outcome is given by a decision event carrying the same id |
| **L2 ledger (Event)** | An append-only domain event log and the single source of truth; each event carries `seq / eventId / actor / correlationId / causationId / payload` |
| **Source** | A perception source = one channel plus several threads. Channels are `host-event / fs-watch / script`; definitions are committed to the ledger while runtime state is not |
| **Dispatcher / Scheduler** | Connects a pure-function dispatch plan to real side effects; executes only the first action per round and stops on failure |
| **Runtime (overview read model)** | Read-only over the ledger and session memory, deriving worker state, context usage, and 7-day activity; never writes to the ledger |
| **Policy** | Dispatch rules and decision permissions. Rules go only into the Router prompt, permissions only into the Worker prompt; both share one version number |

---

## Tools & Interfaces

Agent-facing tools are assigned by role — the Router and Worker receive different tool sets:

| Tool | Caller | Purpose |
|---|---|---|
| `pa_ticket_dispatch` | Router | Dispatch: create a new worker session or append to an existing one |
| `pa_ticket_supplement` | Router | Add a fact to a running ticket |
| `pa_ledger_query` | Router | Read-only query of ticket and approval progress |
| `pa_source_create` / `pa_source_update` / `pa_source_toggle` / `pa_source_remove` | Router | Create, update, toggle, and remove perception sources |
| `pa_approval_submit` | Worker | Submit an approval and block until the human decides |

The Console reads and writes state through a same-origin HTTP surface (prefix `/personal-agent/api`). Main endpoints: `/snapshot` (everything needed for one refresh), `/signals` (full-history search), `/settings` and `/prompts` (settings and prompt versions), `/tickets/:id` (ticket call chain), `/approvals/:id/decide` (submit a decision), and `/sources/:id/*` (toggle, test, remove). All but `/health` are same-origin checked. See the [Architecture Document](docs/architecture.en.md).

---

## 📦 Installation

> **Version compatibility**: This plugin is compatible with **DeepSeek Harness `0.2.2-rc.5` and above**. Please install or upgrade the host first (before upgrading, **fully stop the dsh process** in an external terminal):
>
> Tip: You can copy the following paragraphs directly to an AI assistant such as Claude Codex to install this plugin. When using the web profile, replace `desktop` with `web` in the commands below.

> **Package name**: this plugin is published on npm as `dsh-gzx-agent` (`dsh-personal-agent` is taken by another author); the GitHub repository is still named `dsh-personal-agent`.

### Option 1: Install everything with one command (recommended)

We provide an aggregation package that includes all the following features:
- `dsh-capability-manager` (Capability Manager)
- `dsh-gzx-agent` (Personal Assistant)
- `dsh-run-python` (Python Workbench)

Run the following command in a terminal to install and configure all plugins at once:

**Desktop** (recommended: click the plugin page and enter the package name to install):

```
dsh-gzx-plugin
```
or
```bash
dsh plugin --profile desktop add dsh-gzx-plugin
```

---

### Option 2: Install individually as needed

[Capability Manager](https://github.com/GZX2211/dsh-capability-manager "If you need meta_search's on-demand tool recall, take a look")
```bash
dsh plugin add dsh-capability-manager
```

[Personal Assistant](https://github.com/GZX2211/dsh-personal-agent "If you need an assistant that can proactively get work done on its own, take a look (usually used together with the other two plugins, otherwise some capabilities will be missing)")
```bash
dsh plugin add dsh-gzx-agent
```

[Python Workbench](https://github.com/GZX2211/dsh-run-python "If you need a tool that can directly execute Python code and maintain kernel state cell by cell, take a look")
```bash
dsh plugin add dsh-run-python
```

### Uninstall

```bash
dsh plugin --profile desktop remove dsh-gzx-agent
```

> Uninstalling only removes the plugin mount — the state directory (ledger, settings, ticket working directories) is kept so a later reinstall can restore state. To clean up completely, delete that state directory manually.

---

## Quick Start

- Want to understand the architecture? See the [Architecture Document](docs/architecture.en.md)
- Want to contribute? See [Contributing](docs/CONTRIBUTING.en.md)
- Want to learn how to use it? See the [User Guide](docs/USER_GUIDE.en.md)
- Developing on top of it? See the [Project Development Rules](AGENTS.en.md)
- Installation and overview? This file, [README.en.md](README.en.md)

---

## Data Storage

The state directory defaults to `<DSH_HOME>/state/personal-agent` (or `~/.dsh/state/personal-agent` when `DSH_HOME` is unset), overridable via the bundle's `stateDir` config.

```text
<state>/personal-agent/
├── events.jsonl          # append-only L2 ledger, single source of truth (idempotent, replayable, fsynced)
├── kv.json               # technical metadata: Router session identity, perception de-dup state
├── settings.json         # executor config, dispatch rules, decision permissions (revision optimistic lock)
├── prompt-history.jsonl  # prompt versions, append-only and immutable
├── work/<ticketId>/      # isolated working directory per ticket
└── perception/<sourceId>/# script text for script channels
```

> Session L1 event logs are managed by DSH itself — they are not in this directory and are not double-written. Signal-to-turn pairing, blocked approval resolvers, and source runtime state live only in memory; after a restart they are rebuilt from the ledger or shown as unsettled, never persisted.

---

## Local Development

```bash
git clone https://github.com/GZX2211/dsh-personal-agent.git
cd dsh-personal-agent
pnpm install
pnpm build
pnpm check
```

Common commands:

```bash
pnpm build       # bundle with tsdown and wrap the client artifact
pnpm typecheck   # TypeScript type checking
pnpm test        # run vitest tests
pnpm check       # run typecheck, test, and build in order
```

> After changing `src/`, run `pnpm build` again to refresh the `lib/` artifacts before reloading the plugin; HMR reloads config, not source. UI copy changes must be made in both the `zh` and `en` dictionaries.

---

## Known Limitations

| Item | Description |
|---|---|
| Delivery idempotency is process-local | After a restart the inbox is empty and the same request may be delivered once more; cross-process de-duplication is not implemented |
| Signal pairing is lost on restart | Delivered-but-unsettled signals stay pending, shown truthfully on the events page, with no automatic resolution |
| Signal snapshot limit | A snapshot carries at most the latest 200 signals; older history uses `/signals` (1–500 per query) |
| Ticket detail read limit | At most 8 sessions and 3,000 log entries per session per request; overflow is truncated to the tail and marked partial |
| Timer sources are read-only | Timed tasks are owned by the host automation page; this plugin only translates and delivers them, never creates or modifies them |
| No dispatch from the panel | Dispatch and supplement are Agent-facing tools; the Console ticket pages are read-only, and approval question/options/attachments cannot be edited |
| Restoring a prompt needs another save | "Load into editor" from history does not take effect until you click "Save" |
| Capability management page is unimplemented | The tools / skill / MCP management page is a placeholder, out of MVP scope |

Future plans are tracked in the project Issues.

---

## License

[MIT](LICENSE) © HHH. Issues and PRs are welcome.
