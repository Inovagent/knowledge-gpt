# 0001 - Capture and Storage Platform

## Problem Statement

Knowledge workers need to save useful browser content into Notion or local
Markdown without copying text by hand and without exposing private Notion secrets
or local filesystem paths to browser code.

The current system supports YouTube transcripts, Gmail message content, clean
web-page captures, and selected-text captures. This spec records the product
contract those flows rely on so future changes can extend the platform without
breaking its trust boundary or storage behavior.

## Solution

Use a Chromium Manifest V3 extension as the capture and interaction layer, and a
local Node.js backend as the persistence and trust-boundary layer.

The extension captures content, reads user-facing settings, and sends capture
payloads to the backend. The backend validates setup, owns Notion secrets and
local filesystem access, normalizes the capture payload, and persists it to the
selected storage destination.

## User Stories

1. As a YouTube user, I want to save or copy a transcript from a watch page, so
   that I can keep useful video content without manual transcript handling.
2. As a Gmail user, I want to save readable message content with subject and
   sender metadata, so that useful email can become knowledge material.
3. As a web reader, I want to save a clean page capture or selected passage, so
   that I can keep the useful content without page chrome.
4. As a Notion user, I want captures saved into my configured database with
   mapped metadata, so that saved pages are searchable and organized.
5. As a local Markdown user, I want captures saved as safe direct-child Markdown
   files under the backend-configured root, so that local files are useful and
   never overwrite existing captures.
6. As a privacy-conscious user, I want secrets and local paths to stay in the
   backend, so that browser code never receives sensitive configuration.
7. As a first-time user, I want clear setup validation and health feedback, so
   that I can fix missing destination, backend URL, Notion settings, or Markdown
   root issues.
8. As a contributor, I want one shared capture/storage contract, so that new
   capture surfaces can reuse the existing backend behavior.
9. As a maintainer, I want specs and docs to track public behavior, so that API,
   extension, storage, and setup changes do not drift silently.

## Implementation Decisions

- The extension captures content and presents user interactions. It must not own
  Notion secrets or local filesystem paths.
- The backend owns persistence, storage validation, Notion API access, local
  Markdown writes, and safe health reporting.
- Storage destination is explicit and required. Current destinations are
  `notion` and `localMarkdown`.
- Save endpoints accept a shared capture shape across transcripts, email,
  articles, and selections. Legacy transcript fields and generic content fields
  are normalized into one backend payload.
- The extension background worker bridges content scripts and the backend. It
  loads settings, chooses the save endpoint, tries candidate backend origins, and
  returns success or error state to the caller.
- YouTube and Gmail are site-specific capture flows. Generic page and selected
  text capture are explicit context-menu flows with an editable preview before
  saving.
- Notion saves populate mapped properties, write body content under a content-
  type heading, and dedupe before creation. Existing entries are recreated only
  when their status is To Process; other existing entries are skipped.
- Local Markdown saves validate the backend root, generate bounded direct-child
  filenames from capture metadata, write with exclusive create semantics, and
  add collision suffixes rather than overwriting files.
- Health responses may expose setup booleans and safe error messages, but must
  not expose the configured local Markdown root path.
- Public contract changes in API, config, storage, extension capture, options,
  or dependency surface must update docs and the relevant spec, or explicitly
  declare `Docs impact: none - <reason>`.

## Testing Decisions

- Test external behavior at the highest stable seam; avoid tests that lock in
  incidental internal decomposition.
- Backend save behavior should usually be tested through route-level requests,
  because that exercises validation, normalization, routing, and storage as one
  user-visible contract.
- Storage helpers should have focused tests for filename generation, Markdown
  document shape, path safety, root validation, and collision behavior.
- Notion behavior should use fake Notion clients to cover dedupe, skip/recreate,
  property construction, and block construction without network calls.
- Extension extraction should use representative DOM or utility tests for the
  fragile parts: YouTube transcript variants, Gmail message extraction, clean
  page text normalization, URL handling, and external ID stability.
- New capture surfaces should add tests at their extraction seam and reuse the
  existing backend route/storage tests for persistence.
- Any hot-path change should pass `bash scripts/docs_impact_guard.sh --worktree` and
  `bash scripts/docs_consistency_check.sh`.

## Out of Scope

- Hosted or multi-user backend service.
- Browser-side storage of Notion secrets.
- Browser-side selection of arbitrary local filesystem paths.
- OAuth or Notion account connection flows.
- Non-Chromium extension packaging.
- Attachment, PDF, full-thread, or automatic background capture.
- Bi-directional sync from Notion or Markdown back into the browser.
- Rich Notion formatting beyond the current plain-text body blocks.
- A design refresh of the options page or injected preview UI.
- Issue-tracker publication; this spec remains in-repo until a tracker and
  `ready-for-agent` label are configured.

## Further Notes

- This spec documents current behavior discovered from the codebase on
  2026-07-09.
- The preferred implementation seam is the existing split between extension
  capture, background request routing, backend validation, storage routing, and
  destination-specific persistence.
- The preferred testing seam is route-level backend behavior plus focused
  extraction and storage helper tests.
