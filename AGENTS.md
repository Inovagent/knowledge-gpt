# Knowledge GPT Agent Guide

Entry point for agents and humans working in Knowledge GPT. Read this before
making code or documentation changes. Before finishing any change, evaluate the
[Docs Impact](#docs-impact-definition-of-done) table; documentation impact is
part of the change, not a follow-up.

## Project Overview

Knowledge GPT is a Chromium Manifest V3 extension plus a local Node.js/Express
backend. The extension captures content from supported browser contexts, and the
backend persists captures to Notion or backend-configured local Markdown without
putting secrets or filesystem paths in browser code.

Current shipped capture surfaces are YouTube transcript capture, Gmail message
capture, clean web-page capture, and selected-text capture.

## Project Structure

- `extension/manifest.json` defines the extension name, permissions, host
  permissions, background service worker, options page, and content scripts.
- `extension/pages/options/` owns the extension settings UI for storage
  destination, backend URL, Notion database ID, and property mapping.
- `extension/scripts/background.js` owns toolbar behavior and context-menu
  actions for clean page and selected text capture.
- `extension/scripts/content/` owns page-specific capture flows for YouTube,
  Gmail, generic web pages, selection previews, and injected save buttons.
- `extension/scripts/shared/` owns browser-side shared helpers such as backend
  URL handling and settings.
- `src/backend/config/env.js` is the backend env contract.
- `src/backend/routes/` owns the public local API routes.
- `src/backend/services/storage/` owns storage destination routing and Notion or
  local Markdown persistence.
- `src/backend/services/transcripts/` owns capture payload normalization, Notion
  properties, Notion blocks, and Notion queries.
- `src/backend/middleware/` and `src/backend/lib/` own cross-cutting backend
  concerns such as CORS, request logging, and logging helpers.
- `test/` contains Node test-runner coverage for backend routes, storage, payload
  validation, and extension capture helpers.
- `docs/` contains the domain glossary and ADR template.
- `specs/` contains durable product and implementation specs written in the
  local `to-spec` shape.
- `scripts/docs_*` and `.github/workflows/docs-impact.yml` implement the
  self-improving docs guardrails.

## Public API

- `GET /health` returns backend status and safe configuration booleans:
  `hasNotionToken`, `hasDefaultDatabaseId`, and `hasLocalMarkdownRoot`.
- `POST /save-transcript` accepts YouTube transcript saves using the shared
  capture schema.
- `POST /save-content` accepts Gmail, clean page, and selected-text saves using
  the shared capture schema.

## Extension Surface

- Extension permissions: `activeTab`, `contextMenus`, `scripting`, `storage`.
- Host permissions: `https://www.youtube.com/*`, `https://mail.google.com/*`,
  `http://localhost/*`, and `http://127.0.0.1/*`.
- Content scripts are registered for YouTube watch pages and Gmail message
  views. Generic page and selected-text capture are invoked by context menus and
  injected on demand.

## Commands

- `npm install` installs dependencies.
- `npm run dev` starts the backend with Node watch mode.
- `npm run start` starts the backend without watch mode.
- `npm run check` syntax-checks JavaScript under `src`, `extension`, and `test`.
- `npm test` runs the Node test suite.
- `bash scripts/install_hooks.sh` installs the local Docs Impact git hooks for a
  fresh clone.

## Rules And Deeper Docs

- `README.md` is canonical for setup, requirements, env keys, storage behavior,
  extension loading, API payload examples, and verification commands.
- `CONTRIBUTING.md` is canonical for local development and pull request
  expectations.
- `docs/CONTEXT.md` is the project glossary. Add terms there when code introduces
  vocabulary future contributors must use consistently.
- `docs/adr/` is for architecture decision records. Use the template at
  `docs/adr/adr-template.md`.
- `specs/` is canonical for PRD-style product and implementation specs. Use
  `specs/README.md` for the format.

## Docs Impact (Definition of Done)

A code change is not complete until you have evaluated this table and either
updated the listed docs in the same branch/PR, or stated
`Docs impact: none - <reason>` in your final summary, commit message, or PR body.
Doc updates are part of the change. The explicit negative declaration keeps the
step grep-able instead of silently skipped.

| If the change... | Update... |
| --- | --- |
| Adds, removes, or renames a top-level area, module, feature, route group, or extension script family | This file's Project Structure |
| Adds, removes, or changes an API route, request payload, response payload, status behavior, or safe `/health` field | This file's Public API and `README.md` API section |
| Adds, renames, or changes a backend env key, default, validation rule, or secret-handling rule | `README.md` setup/env block and `.env.example` |
| Changes storage destinations, Notion mapping, Markdown filename/frontmatter behavior, dedupe behavior, or save error semantics | `README.md` storage sections and `docs/CONTEXT.md` if terminology changes |
| Changes capture capabilities, supported sites, content-script registration, context menus, extension permissions, or options UI behavior | This file's Extension Surface and `README.md` Features, Setup, or Current Scope |
| Changes a product capability from planned to shipped, or removes/limits a shipped capability | `README.md` Features and Current Scope, plus the relevant `specs/` file |
| Adds a dependency or changes the runtime/tooling contract contributors must know about | `README.md` Requirements, Development, or Publishing notes |
| Introduces a domain term readers of the code must know | `docs/CONTEXT.md` with an Avoid line |
| Makes a hard-to-reverse architecture decision or rejects an obvious alternative | New `docs/adr/NNNN-*.md` and a row in the ADR Index |
| None of the above | State `Docs impact: none - <reason>` explicitly |

The trigger paths that almost always need docs live in
`scripts/docs_hot_paths.txt`. The Codex Stop hook, git hooks, and CI all read
that same file through `scripts/docs_impact_guard.sh`, so local and CI behavior
stay aligned. Changes under `specs/` count as documentation updates. Keep the
trigger list high-signal; narrow it if more than roughly one in five reminders
are false positives.

## ADR Index

No ADRs have been recorded yet. Add one line here for each new decision record.

## Self-Improving Docs System

This repo now has a model-agnostic docs gate:

- Contract: the Docs Impact table above.
- In-session reminder: `.codex/hooks.toml` calls `scripts/docs_impact_guard.sh`.
- Git gate: `bash scripts/install_hooks.sh` installs an advisory `pre-commit`
  reminder and a blocking `commit-msg` hook.
- CI gate: `.github/workflows/docs-impact.yml` runs the same guard on PRs and
  then runs `scripts/docs_consistency_check.sh`.
- Mechanical drift checks: `scripts/docs_consistency_check.sh` verifies documented
  API routes, env keys, and extension permissions/hosts against code.

The local hook and CI allow an intentional no-docs change only when the author
declares `Docs impact: none - <reason>`.
