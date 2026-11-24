# Contributing

<p align="left">
  <b>English</b> · <a href="CONTRIBUTING.md">简体中文</a>
</p>

> This is the English translation. The Chinese version is authoritative.

Thank you for giving your time and ideas to this project. It is a research-driven personal project, and all kinds of contributions are welcome: bug fixes, documentation improvements, tool enhancements, UI refinements, new feature experiments, and secondary development based on this architecture.

## Understand the Project Boundaries First

This project has a clear development direction. The following are not recommended for direct PR changes; if you have a different idea, please open an Issue to discuss it first. For the full statement, see "Architectural Invariants" in the [Architecture Document](architecture.en.md):

- **The ledger is the single source of truth.** State is derived from the event sequence; tickets and approvals store no status field; writes are append-only with content-derived idempotency keys.
- **Dependencies are one-way.** `shared/` forbids runtime imports; `host/` modules must not import the root entry; `runtime/` must not depend in reverse on `sessions/`; `console-api/` must not read or write the ledger directly.
- **Single ownership of state.** Each fact has exactly one owner and one write boundary; state changes only through semantic operations.
- **Pure functions separated from side effects.** Classification, normalization, projection, and key derivation must be pure functions; data is "all the facts once passed in".
- **Deliver first, record later.** Approvals and deliveries write to the ledger only after the side effect is confirmed; claiming happens before any ledger write.
- **The root is the sole composition point.** Stateful modules are composed by the root `index.ts`; modules collaborate through explicitly injected instances, with no module-level singletons.
- **Compatibility takes priority.** New fields default to optional; retired fields keep read compatibility only and are never written; behavior changes must be recorded explicitly.

**Everything else is open**

## Submitting a PR

Small, focused PRs are the most welcome. For large refactors or feature rewrites, please open an Issue to talk it through first. Such PRs may not be merged directly, but I will read and evaluate them carefully and extract the useful parts into the existing architecture.

The project iterates quickly, so just base your work on the code at the time of your fork — there is no need to worry about merge conflicts. Mechanical conflicts are handled by me; if a semantic change is involved, I will confirm it with you in the PR.

## Extend, Don't Modify

If you have ideas about the architecture, the friendliest way to participate is to **fork this repository and do secondary development on its architecture, or create your own DSH plugin**. You do not need to wait for review: your implementation can serve your own use case immediately while continuing to sync upstream improvements.

If you find architectural shortcomings while extending, come back and open an Issue. Feedback backed by a real implementation carries far more weight than abstract design.

## Development & Testing

Setup, build, test, and type-check commands are in the "Local Development" section of the [README](../README.en.md). Before submitting, make sure `pnpm check` (typecheck → test → build) passes; add tests for any new behavior.

A few hard conventions (full rules are in each directory's `AGENTS.md`):

- **Pure functions first**: use pure functions for core logic, keep dependencies one-way, and place shared logic in modules with clear responsibilities.
- **One responsibility per file**: each file has one clear responsibility; name things by what they do, not how they are implemented.
- **Bilingual copy**: any user-visible UI text must go through the dictionary, with `zh` / `en` added in sync; no hardcoded strings in components.
- **Comments explain why**: only add what the code does not express; update or delete comments in sync when behavior changes.
- **Sync contract changes**: when modifying a public interface, data structure, or contract, check callers and tests in sync.
- **Respect layer boundaries**: Host never imports the root entry; Client dependencies are one-way with network access only through the unified boundary; the shared layer stays side-effect free.

## Last Words

Every contributor who gives time and effort deserves respect. I will do my best to review every submission, and I look forward to your Issues and PRs.
