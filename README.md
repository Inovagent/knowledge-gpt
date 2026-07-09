# Knowledge GPT

Save information from supported sites into Notion or local Markdown without exposing secrets or filesystem paths in the browser. The project currently supports YouTube transcript capture and Gmail email-content capture, with room to expand further over time.

This repository currently contains:

- a Chromium Manifest V3 extension that adds save buttons on supported pages like YouTube and Gmail
- a small local Node.js API that writes captured content into Notion or backend-configured Markdown files

## Why this project exists

Most browser-side Notion integrations force you to put a secret in the extension itself. This project avoids that by sending captured page data to a local backend, which then talks to Notion using your private integration token.

## Features

- Uses a local-first architecture so browser-side code never needs your Notion secret
- Injects a save button into YouTube's watch-page action bar
- Injects a Gmail-style save button into open Gmail message action bars
- Opens the transcript panel automatically when needed
- Extracts transcript text across multiple known YouTube DOM variants
- Extracts readable email content from the active Gmail message body
- Sends captured data to a local backend for persistence into Notion or local Markdown
- Creates a new Notion page or recreates an existing one based on your dedupe mapping
- Writes local Markdown files with YAML frontmatter when `localMarkdown` is selected
- Preserves a simple load-unpacked development flow

## Repository structure

```text
.
├── extension/
│   ├── manifest.json
│   ├── pages/
│   │   └── options/
│   ├── scripts/
│   │   ├── background.js
│   │   ├── content/
│   │   └── shared/
│   └── styles/
├── src/
│   └── backend/
│       ├── config/
│       ├── lib/
│       ├── middleware/
│       ├── routes/
│       └── services/
├── .env.example
└── package.json
```

## Requirements

- Node.js 18+
- Chrome, Chromium, or another Chromium-based browser
- A Notion integration with access to your target database, if saving to Notion
- A local folder configured in the backend, if saving to local Markdown

## Setup

### 1. Install dependencies

```bash
npm install
cp .env.example .env
```

### 2. Choose a storage destination

The extension requires an explicit destination before saving:

- `notion`: writes captures into Notion using the backend's Notion token
- `localMarkdown`: writes `.md` files into the backend folder configured by `LOCAL_MARKDOWN_ROOT`

Existing users must open the extension options page and choose a destination after upgrading.

### 3. Create a Notion integration

1. Go to [Notion integrations](https://www.notion.so/my-integrations)
2. Create an internal integration
3. Copy the integration token
4. Share your destination database with that integration

Skip this step if you only plan to save local Markdown.

### 4. Configure the backend

Fill in `.env`:

- `NOTION_TOKEN`: required for Notion saves, your Notion integration secret
- `HOST`: optional, defaults to `127.0.0.1`
- `PORT`: optional, defaults to `8787`
- `DEFAULT_NOTION_DATABASE_ID`: optional fallback database ID for Notion saves
- `LOCAL_MARKDOWN_ROOT`: required for local Markdown saves; must be an absolute path or start with `~/`, point to an existing directory, and be writable by the backend

Start the server:

```bash
npm run start
```

The API will be available at `http://127.0.0.1:8787` unless you change `HOST`.

### Running the server in the background on macOS

If you want the backend to keep running without an open terminal, use a `launchd` agent.

1. Create `~/Library/LaunchAgents/com.example.knowledge-gpt.plist`
2. Paste in:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.example.knowledge-gpt</string>

    <key>ProgramArguments</key>
    <array>
      <string>/opt/homebrew/bin/node</string>
      <string>/path/to/knowledge-gpt/src/backend/server.js</string>
    </array>

    <key>WorkingDirectory</key>
    <string>/path/to/knowledge-gpt</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>/path/to/knowledge-gpt/server.log</string>

    <key>StandardErrorPath</key>
    <string>/path/to/knowledge-gpt/server-error.log</string>
  </dict>
</plist>
```

3. Load the service:

```bash
launchctl load ~/Library/LaunchAgents/com.example.knowledge-gpt.plist
launchctl start com.example.knowledge-gpt
```

4. Verify that it is running:

```bash
launchctl list | grep knowledge-gpt
curl http://127.0.0.1:8787/health
tail -f "/path/to/knowledge-gpt/server.log"
```

Notes:

- `launchd` restarts the backend if it exits
- the backend will not run while the Mac is asleep
- replace `/path/to/knowledge-gpt` with the actual path to your cloned repository
- replace `com.example.knowledge-gpt` with your own preferred LaunchAgent label if you want
- if `node` is installed somewhere else on your machine, run `which node` and update the plist path

### Restarting the background server after code changes

If you change the backend source code, restart the `launchd` service to apply the changes:

```bash
launchctl unload ~/Library/LaunchAgents/com.example.knowledge-gpt.plist
launchctl load ~/Library/LaunchAgents/com.example.knowledge-gpt.plist
launchctl start com.example.knowledge-gpt
```

You can then confirm the new version is running with:

```bash
curl http://127.0.0.1:8787/health
tail -n 50 "/path/to/knowledge-gpt/server.log"
```

For local Markdown, the browser never sends a folder, filename, extension, or subpath. The backend generates direct-child `.md` filenames and writes with exclusive create semantics so existing files are not overwritten.

### 5. Load the extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Click `Load unpacked`
4. Select the repository's `extension/` directory

The manifest pins a stable unpacked-extension ID with a public `key`, so saved options survive normal extension reloads and loading the extension from another local workspace path.

### 6. Configure the extension

Open the extension options page and set:

- Storage destination: `Notion` or `Local Markdown`
- Backend URL, for example `http://127.0.0.1:8787`
- For Notion: Notion database ID, or leave it blank if you set `DEFAULT_NOTION_DATABASE_ID`
- For Notion: property names for the fields you want this integration to populate
- For Local Markdown: make sure `/health` reports that `LOCAL_MARKDOWN_ROOT` is set

After the extension is loaded, clicking the Knowledge GPT toolbar icon opens this options page directly.

## Current scope

The current implementation supports:

- YouTube watch pages for transcript capture
- Gmail message views for email-content capture

## Recommended Notion mapping

At minimum, configure:

- a title property

Recommended optional mappings:

- a URL property
- an external ID property for stronger deduplication
- a select property for `Creator / Source`
- a select property for `Source Type`
- a date property for the last synced timestamp
The current YouTube flow writes the full transcript into the Notion page body as code blocks under a `Transcript` heading. The Gmail flow writes the extracted email body into the page body as code blocks under a `Content` heading.

## Local Markdown output

Local Markdown files are named with this pattern:

```text
YYYY-MM-DD-<contentType-or-sourceType>-<slug-title>-<short-externalId>.md
```

If a generated filename already exists, the backend writes `-2`, `-3`, and so on. Each file includes YAML frontmatter for available metadata and a Markdown body headed by `Transcript` or `Content`.

## API

### `GET /health`

Returns a simple status payload for the local backend, including booleans such as `hasNotionToken`, `hasDefaultDatabaseId`, and `hasLocalMarkdownRoot`. The local Markdown flag is only true when `LOCAL_MARKDOWN_ROOT` exists and is writable. It does not expose the configured local Markdown path.

### `POST /save-transcript`

Accepts YouTube transcript saves using the shared capture schema.

Notion request:

```json
{
  "storageDestination": "notion",
  "videoId": "abc123",
  "url": "https://www.youtube.com/watch?v=abc123",
  "title": "Example video",
  "channel": "Example creator",
  "transcript": "First line\nSecond line",
  "capturedAt": "2026-05-05T10:00:00.000Z",
  "databaseId": "optional-database-id",
  "propertyMapping": {
    "title": "Title",
    "videoUrl": "URL",
    "videoId": "External ID",
    "channel": "Creator / Source",
    "sourceType": "Source Type",
    "lastSyncedAt": "Last Synced At"
  }
}
```

### `POST /save-content`

Accepts:

```json
{
  "storageDestination": "localMarkdown",
  "externalId": "abc123",
  "url": "https://example.com/item/abc123",
  "title": "Example title",
  "source": "Example source",
  "sourceType": "Newsletter",
  "content": "First line\nSecond line",
  "contentType": "email",
  "capturedAt": "2026-05-05T10:00:00.000Z"
}
```

For Notion saves, include the Notion fields:

```json
{
  "storageDestination": "notion",
  "externalId": "abc123",
  "url": "https://example.com/item/abc123",
  "title": "Example title",
  "source": "Example source",
  "sourceType": "Newsletter",
  "content": "First line\nSecond line",
  "contentType": "email",
  "capturedAt": "2026-05-05T10:00:00.000Z",
  "databaseId": "optional-database-id",
  "propertyMapping": {
    "title": "Title",
    "videoUrl": "URL",
    "videoId": "External ID",
    "channel": "Creator / Source",
    "sourceType": "Source Type",
    "lastSyncedAt": "Last Synced At"
  }
}
```

## Development

Run the backend in watch mode:

```bash
npm run dev
```

Use `npm run dev` during active local development if you want the server to restart automatically when backend files change. Use the `launchd` setup above when you want the server to keep running in the background between terminal sessions.

Run syntax checks:

```bash
npm run check
```

Run tests:

```bash
npm test
```

## Publishing notes

Before publishing publicly, you will probably still want to add:

- a screenshot or demo GIF
- a real repository URL in `package.json`
- GitHub issue templates or contribution automation if you want outside contributors

## License

[MIT](./LICENSE)
