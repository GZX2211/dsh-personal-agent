# Root AGENTS.md

<p align="left">
  <b>English</b> · <a href="AGENTS.md">简体中文</a>
</p>

> This is the English translation for international readers. [AGENTS.md](AGENTS.md) is the single authoritative version; the Chinese version governs.

## Repository Governance System (Authoritative Source)

`AGENTS.md` is organized in three layers. Each layer writes only the rules it governs; the same rule is not repeated across layers.

| Layer | File | Scope | Responsibility |
|---|---|---|---|
| Repository | `AGENTS.md` | Whole repository | Repository-wide general conventions |
| Test | `tests/AGENTS.md` | Test domain | Test-domain-specific rules only |
| Business | `src/<domain>/AGENTS.md` | Business domain | Business-domain-specific rules only |

---

## Development Conventions

- Prefer pure functions for core logic; maintain one-way dependencies; place shared logic in modules with clear responsibilities.
- Name things by what they do, not by how they are implemented.
- Each file has one clear responsibility and ideally one main reason to change; split distinct responsibilities into separate modules.
- When modifying a public interface, data structure, or contract, you must check callers, tests, and related code in sync.

---

## Comment Conventions

- Principle: comments only add what the code does not express, and explain only the "why" (non-obvious constraints, workarounds, decision context, traps). If deleting it does not hurt understanding, do not write it.
- Forbidden: historical narration; line numbers / internal document pointers; restating the code; asserting external library behavior.
- Keep: the first-line path header comment of each file.
- Required: compatibility and degradation (branch conditions, failure behavior); invariants / preconditions; business / security rules; design rationale that cannot be inferred from the code.
- Style: place comments next to the code they describe; natural language only, leaving structural labels to tooling; concise and to the point, no longer than necessary.
- When behavior changes, update or delete the corresponding comments in sync; if they cannot be synchronized, deleting a wrong comment is better than keeping it.

## Internationalization Conventions

- Any UI text a user can see directly must be bilingual (including toasts, buttons, text, etc.); establish an i18n dictionary.
- Other project-language practices that help international users and international developers.

---

## Special Notes

* You do not need to read `AGENTS.md` — it is injected into your context automatically when you enter.
* The `docs/` directory is the unified location for all project documentation.
* `collab/` is the Agent collaboration area; `img/` holds temporary images (including e2e verification screenshots); `md/` holds temporary collaboration documents; `scr/` holds temporary probes and scripts. Other unclassified temporary files also go under `collab/`.
* `docs/archive` is the unified archive location, and no file inside it may be read.
* `scripts/` is the build-script directory.
