const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { buildTranscriptPayload } = require("../../src/backend/routes/transcripts/payload");
const { validateSaveTranscriptRequest } = require("../../src/backend/routes/transcripts/validate-request");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-gpt-"));
}

const captureBody = {
  storageDestination: "localMarkdown",
  title: "Example",
  source: "Sender",
  content: "Body",
  contentType: "email",
  capturedAt: "2026-05-05T10:00:00.000Z"
};

test("buildTranscriptPayload preserves storage destination and normalizes capture fields", () => {
  const result = buildTranscriptPayload(
    {
      storageDestination: "notion",
      title: "  Example title  ",
      channel: "  Example channel  ",
      transcript: "  Transcript body  ",
      videoId: "video-1",
      databaseId: "",
      propertyMapping: {
        title: "Title",
        url: "URL",
        source: "Source"
      }
    },
    "default-db"
  );

  assert.equal(result.storageDestination, "notion");
  assert.equal(result.requestOptions.databaseId, "default-db");
  assert.equal(result.requestOptions.propertyMapping.videoUrl, "URL");
  assert.equal(result.requestOptions.propertyMapping.channel, "Source");
  assert.equal(result.payload.title, "Example title");
  assert.equal(result.payload.source, "Example channel");
  assert.equal(result.payload.content, "Transcript body");
  assert.equal(result.payload.externalId, "video-1");
  assert.equal(result.payload.contentType, "transcript");
});

test("validation requires an explicit supported storage destination", () => {
  assert.deepEqual(
    validateSaveTranscriptRequest(
      {
        title: "Example",
        source: "Sender",
        content: "Body"
      },
      {}
    ),
    ["Choose a storage destination in the extension options: notion or localMarkdown."]
  );

  assert.deepEqual(
    validateSaveTranscriptRequest(
      {
        storageDestination: "disk",
        title: "Example",
        source: "Sender",
        content: "Body"
      },
      {}
    ),
    ["storageDestination must be one of: notion, localMarkdown."]
  );
});

test("localMarkdown validation does not require Notion fields", () => {
  const root = makeTempDir();
  try {
    assert.deepEqual(
      validateSaveTranscriptRequest(captureBody, {
        localMarkdownRoot: root
      }),
      []
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("notion validation requires Notion token, database id, and title mapping", () => {
  assert.deepEqual(
    validateSaveTranscriptRequest(
      {
        ...captureBody,
        storageDestination: "notion",
        propertyMapping: {}
      },
      {}
    ),
    [
      "Server is missing NOTION_TOKEN.",
      "Property mapping must include a title property name.",
      "Missing Notion database ID."
    ]
  );
});
