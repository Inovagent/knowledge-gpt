# Contributing

## Local development

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Install local docs hooks with `bash scripts/install_hooks.sh`
4. Start the backend with `npm run dev`
5. Load the `extension/` directory as an unpacked extension in Chrome

## Project conventions

- Keep the backend modular under `src/backend`
- Keep extension code split by concern under `extension/scripts`
- Avoid adding browser secrets to the extension
- Keep the product framing honest: broader site support is the goal, but current behavior is still YouTube-first
- Prefer small, focused modules over large single-file scripts

## Pull requests

- Include a short description of the behavior change
- Mention any Notion schema assumptions
- Update docs and relevant `specs/` files for any changed public contract, or include `Docs impact: none - <reason>`
- Run `npm run check` before opening a PR
- Run `bash scripts/docs_impact_guard.sh --worktree` and `bash scripts/docs_consistency_check.sh` before opening a PR
