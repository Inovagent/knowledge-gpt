# Contributing

## Local development

1. Install dependencies with `npm install`
2. Copy `.env.example` to `.env`
3. Start the backend with `npm run dev`
4. Load the `extension/` directory as an unpacked extension in Chrome

## Project conventions

- Keep the backend modular under `src/backend`
- Keep extension code split by concern under `extension/scripts`
- Avoid adding browser secrets to the extension
- Keep the product framing honest: broader site support is the goal, but current behavior is still YouTube-first
- Prefer small, focused modules over large single-file scripts

## Pull requests

- Include a short description of the behavior change
- Mention any Notion schema assumptions
- Run `npm run check` before opening a PR
