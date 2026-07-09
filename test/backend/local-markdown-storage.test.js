const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  assertSafeMarkdownTarget,
  buildLocalMarkdownFilename,
  buildMarkdownDocument,
  slugify,
  validateLocalMarkdownRoot,
  writeLocalMarkdownCapture
} = require("../../src/backend/services/storage/local-markdown-storage");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-gpt-"));
}

const basePayload = {
  title: "A Useful Capture",
  url: "https://www.youtube.com/watch?v=abc123",
  source: "Example Creator",
  channel: "Example Creator",
  sourceType: "Video",
  externalId: "abc123",
  videoId: "abc123",
  contentType: "transcript",
  capturedAt: "2026-05-05T10:00:00.000Z",
  content: "First line\nSecond line"
};

test("slugify normalizes to a bounded ASCII slug", () => {
  assert.equal(slugify(" Café déjà vu! ", 40), "cafe-deja-vu");
  assert.equal(slugify("!!!", 40, "fallback"), "fallback");
  assert.equal(slugify("long title value", 9), "long-titl");
});

test("buildLocalMarkdownFilename uses date, type, title, and short external id", () => {
  assert.equal(
    buildLocalMarkdownFilename({
      ...basePayload,
      title: "Hello, World!",
      contentType: "email",
      externalId: "message/id-123"
    }),
    "2026-05-05-email-hello-world-message-id-123.md"
  );
});

test("buildMarkdownDocument writes frontmatter and destination-appropriate body heading", () => {
  const document = buildMarkdownDocument({
    ...basePayload,
    title: 'A "Quoted" Title'
  });

  assert.match(document, /website: "youtube.com"/);
  assert.match(document, /title: "A \\"Quoted\\" Title"/);
  assert.match(document, /video:\n  id: "abc123"\n  channel: "Example Creator"/);
  assert.match(document, /# A "Quoted" Title\n\n## Transcript\n\nFirst line\nSecond line\n$/);
});

test("buildMarkdownDocument uses Content heading for email captures", () => {
  const document = buildMarkdownDocument({
    ...basePayload,
    contentType: "email"
  });

  assert.match(document, /## Content\n\nFirst line/);
  assert.doesNotMatch(document, /\nvideo:\n/);
});

test("assertSafeMarkdownTarget rejects paths outside the root and non-markdown names", () => {
  const root = makeTempDir();
  try {
    assert.throws(() => assertSafeMarkdownTarget(root, "../escape.md"), /invalid|escaped/);
    assert.throws(() => assertSafeMarkdownTarget(root, "capture.txt"), /invalid/);
    assert.equal(assertSafeMarkdownTarget(root, "capture.md"), path.join(root, "capture.md"));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("writeLocalMarkdownCapture creates collision suffixes without overwriting", async () => {
  const root = makeTempDir();
  try {
    const first = await writeLocalMarkdownCapture({
      root,
      payload: basePayload
    });
    const second = await writeLocalMarkdownCapture({
      root,
      payload: basePayload
    });

    assert.equal(first.filename, "2026-05-05-transcript-a-useful-capture-abc123.md");
    assert.equal(second.filename, "2026-05-05-transcript-a-useful-capture-abc123-2.md");
    assert.match(fs.readFileSync(first.filePath, "utf8"), /# A Useful Capture/);
    assert.match(fs.readFileSync(second.filePath, "utf8"), /# A Useful Capture/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("validateLocalMarkdownRoot enforces backend-controlled absolute directories", () => {
  const root = makeTempDir();
  try {
    assert.deepEqual(validateLocalMarkdownRoot(root), []);
    assert.deepEqual(validateLocalMarkdownRoot(""), ["Server is missing LOCAL_MARKDOWN_ROOT."]);
    assert.deepEqual(validateLocalMarkdownRoot("relative/path"), [
      "LOCAL_MARKDOWN_ROOT must be an absolute path or start with ~/."
    ]);
    assert.deepEqual(validateLocalMarkdownRoot("~"), [
      "LOCAL_MARKDOWN_ROOT must be an absolute path or start with ~/."
    ]);
    assert.deepEqual(validateLocalMarkdownRoot(path.join(root, "missing")), [
      "LOCAL_MARKDOWN_ROOT must point to an existing directory."
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
