# CONTEXT - Domain Glossary

Canonical vocabulary for Knowledge GPT. When code introduces a new domain term a
reader must know, add it here with an Avoid line.

## Capture

Content extracted by the extension and sent to the local backend for persistence.
A capture always includes enough metadata for storage routing and user-facing
context, such as title, URL, source/source type, content type, and captured time.

- **Avoid:** "scrape" for the saved payload; reserve scraping-like language for
  extraction internals.

## Storage Destination

The explicit backend destination selected by the user before saving a capture.
Current values are `notion` and `localMarkdown`.

- **Avoid:** "provider" or "backend type" when referring to the user-selected
  value in request payloads.

## Notion Save

A capture persisted through the backend's private Notion integration token. The
browser sends mapping preferences and content, but never the Notion secret.

- **Avoid:** "browser Notion integration"; secrets stay in the local backend.

## Local Markdown Save

A capture persisted as a direct-child `.md` file under the backend-configured
`LOCAL_MARKDOWN_ROOT`. The browser never sends a local folder, filename,
extension, or subpath.

- **Avoid:** "download" or "browser file save"; the backend writes the file.

## External ID

The stable source identifier used for dedupe and traceability, such as a YouTube
video ID or another captured item identifier.

- **Avoid:** "database ID" unless referring to a Notion database ID.

## Property Mapping

The user-configured mapping between capture fields and Notion database property
names.

- **Avoid:** "schema" when the value is only the user's property-name mapping.

## Backend URL

The local HTTP origin the extension calls, usually `http://127.0.0.1:8787`.

- **Avoid:** "server path" or "API key"; this is only the local backend origin.

## Supported Site

A browser context with a shipped capture flow. Current supported sites are
YouTube watch pages and Gmail message views; generic web-page and selected-text
capture are context-menu flows.

- **Avoid:** "integration" for generic pages; reserve integration-like language
  for site-specific flows.
