# Architecture

<p align="left">
  <b>English</b> · <a href="architecture.md">简体中文</a>
</p>

> This is the English translation. The Chinese version is authoritative.

This document describes the core architecture, design intent, and key trade-offs of this project.

---

## 1. Problem & Positioning

DSH itself makes every session an independent append-only event log (L1). Sessions are fully isolated with no shared state channel; `ctx.emit` is an in-process synchronous broadcast that is neither durable nor replayable; and the official approval `pending` is not persisted and has no resume token. As a result, three things the host does not provide: cross-session task state, approval gates that require a human, and state that is visible directly without relaying through the Router.

**dsh-personal-agent** responds by inserting a self-built **deterministic event layer (L2 ledger)** between the two probabilistic layers (the Router and Worker model sessions). All state ownership lives in the middle layer; the two ends only submit facts and consume decisions. The Router handles intent understanding, dispatch, and on-demand pull queries; the Worker executes in an isolated session; approvals are presented directly to the human by the Console. The V0 architecture design document summarizes it in one sentence: lift approvals and task state from the probabilistic layer into the deterministic layer, with the Console as that layer's projection and filter.

The project pursues **lower attentional cost** (one window for conversation, state visible on its own, approvals handled centrally). It does not pursue long-term memory or user profiles, multi-Router / cross-process operation, per-member capability configuration, or a self-built tool management system.

---

## 2. Core Architecture

```text
+- Probabilistic layer ----------------------------------------------------+
|  Router session             Worker session (one per ticket)              |
|  intent / dispatch / query    execute / submit approval                   |
+-------+----------------------------+------------------------------------+
        | domain tools submit facts  | submit approval / report
        v                            v
+- Deterministic layer - L2 ledger (append-only, single source of truth) --+
|  events.jsonl --pure projection--> ticket / approval / call-chain views   |
|  Dispatcher/Scheduler: plan -> create session -> deliver                  |
|  Perception: source definition -> filter & de-dupe -> deliver to Router   |
+-------+------------------------------------------------------------------+
        | same-origin HTTP surface /snapshot
        v
+- Presentation layer -----------------------------------------------------+
|  Right-sidebar "Console": Overview / Approvals / Tickets / Events /        |
|  Sources / Settings                                                        |
|  State visible directly (not via Router) - human decides here              |
+---------------------------------------------------------------------------+
```

### 2.1 Event Sourcing & Derived State

The ledger (`/store/event-store.ts`) is an append-only `events.jsonl`: the write order is fixed as "assign seq → write to disk with fsync → update memory", rolling back the file length on failure; `eventId` is derived from key fields for idempotency. Tickets and approvals **have no status field** — stages are computed from the event sequence by `projector/project.ts`, and `blocked` is only a sub-label of `running`. State therefore can never conflict with the ledger, and stage follows event order rather than wall-clock time.

### 2.2 Bidirectional Collaboration: Scheduling & Sessions

`dispatcher/` and `sessions/`, and `approvals/` and `sessions/`, collaborate bidirectionally: scheduling and approvals call on sessions to execute and deliver, while sessions call back to the scheduler or register blocking at turn boundaries. Both sides interact only through injected instances and the service surfaces declared in `context.ts`, never reading each other's internal state — this is collaboration, not inverted layering. The Scheduler executes only the first action per round and stops on failure, preventing anomalous data from causing an infinite loop.

### 2.3 Approval Gate & Healing

A Worker calling `pa_approval_submit` blocks until the human decides, with a pending resolver registered in `ResolverRegistry`. On submission, three branches apply: if the target session is archived, write a discard; if the resolver is still blocked, deliver inline and wait for acknowledgement; if the agent has stopped, deliver via followup to wake it. All three follow **deliver first, record later**. On startup, `healPendingApprovals` recovers decisions that were delivered but not recorded from the `tool/result` metadata in the session log, writing them back with `recovered:true`.

### 2.4 Perception Sources

Source definitions (channel + threads + statement) are committed to the ledger via `source/*` events, while runtime state stays in memory. Three channel types: `host-event` (subscribes to internal events, excluding self-generated signals to avoid self-triggering), `fs-watch` (local file changes), and `script` (a general adapter for external protocols, with scripts materialized on disk and hash-checked, rate-limited, and backed off on failure). Filtering order: thread toggle → match → de-duplication → minimum gap → edge detection; delivery and recording are separate.

### 2.5 Read-Only Overview Model

`runtime/` reads only the ledger and session memory to derive worker state, context usage, and the last 7 days of activity. It never writes to the ledger and never depends in reverse on `sessions/`. Every component degrades independently without affecting the main flow.

### 2.6 Three-Layer Dependency Direction

- `shared/` is a pure contract layer: runtime imports are forbidden, and it contains no global mutable state, singletons, or side effects, so both ends can reference it risk-free.
- Inside `host/`, modules collaborate through explicitly injected instances; module-level singletons and importing the root entry are forbidden. The root `index.ts` is the sole composition point.
- `client/` has one-way dependencies: `components / hooks → lib`, with `lib` never depending in reverse; network access goes only through the unified boundary and injected surface.

---

## 3. Key Design Trade-offs

| Design choice | Main benefit | Cost incurred |
| --- | --- | --- |
| Event sourcing + pure projection, no stored status | State never conflicts with the ledger, replayable, naturally idempotent, resilient to clock changes | Each projection folds events (mitigated by a projection cache); new fields must keep old ledgers readable, imposing strict write discipline |
| "Deliver first, record later" + startup healing | No inconsistency where the ledger says a decision was made but the worker never received it | Adds deliver/acknowledge/cancel three-state synchronization complexity and coupling through `presentationMeta` to persist decisions |
| Signal pairing kept only in memory (ClaimRegistry) | Pairing is a runtime fact, simple to implement, does not pollute the ledger | Lost on restart; unsettled signals stay pending with no automatic resolution |
| Delivery idempotency limited to the current process | No need to scan persisted history; simple and efficient | After a restart the same requestId may be delivered again; the duplicate window is shrunk by "deliver first, record later + healing" |
| Router stripped of execution tools, given only dispatch and query | Clear responsibility boundary, technical work isolated in ticket sessions | The Router depends entirely on Workers; any execution-session issue must be resolved via dispatch / supplement |
| Three built-in channels + a general script outlet | Covers local files, internal events, and external services, with judgment left to the Router | Scripts require on-disk materialization, process management, exponential-backoff restarts, and rate limiting — a heavier implementation |
| Source runtime state is not committed to the ledger | A clean ledger with no non-replayable facts such as "once ran" | State resets on restart; channels must be rebuilt and script hashes resynced from files |

These trade-offs do not mean one approach is absolutely better; they are configurable balances around "attention budget and replayable facts". Concrete thresholds and behavior are determined by the code and tests.

---

## 4. Architectural Invariants

The following constraints define the architectural boundary and are the source referenced by "Project Boundaries" in the [Contributing Guide](CONTRIBUTING.en.md).

1. **The ledger is the single source of truth.** State is derived from the event sequence; tickets and approvals store no status field; writes are append-only with content-derived idempotency keys.
2. **Dependencies are one-way.** `shared/` forbids runtime imports; `host/` modules must not import the root entry; `runtime/` must not depend in reverse on `sessions/`; `console-api/` must not read or write the ledger directly.
3. **Single ownership of state.** Each fact has exactly one owner and one write boundary; state changes only through semantic operations, never by editing fields directly or modifying another module's internal state.
4. **Pure functions separated from side effects.** Classification, normalization, projection, signatures and key derivation, and field mapping must be pure functions; data is "all the facts once passed in" and never implicitly reads globals or the environment.
5. **Deliver first, record later.** Approval decisions and deliveries write to the ledger only after the side effect is confirmed; claiming happens before any ledger write.
6. **The root is the sole composition point.** Stateful modules are composed by the root `index.ts`; modules collaborate through explicitly injected instances and interfaces, with no module-level singletons.
7. **Compatibility takes priority.** New fields default to optional; removals or semantic changes provide a compatibility path; retired fields keep read compatibility only and are never written; behavior changes must be recorded explicitly.

These constraints serve to define architectural boundaries and evaluate design changes. Implementation details are governed by the code and tests.
