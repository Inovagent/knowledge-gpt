const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildCaptureExternalId,
  canonicalizeUrl,
  getHostname,
  getWordCount,
  normalizeTextBlock,
  sanitizeTitle
} = require("../../extension/scripts/shared/web-capture-utils");

test("normalizeTextBlock preserves paragraph breaks while trimming noisy whitespace", () => {
  assert.equal(normalizeTextBlock(" First   line \n\n\nSecond line\t\n"), "First line\n\nSecond line");
});

test("sanitizeTitle trims publisher suffixes and falls back when empty", () => {
  assert.equal(sanitizeTitle(" A useful article - Example News "), "A useful article");
  assert.equal(sanitizeTitle("   ", "Fallback"), "Fallback");
});

test("canonicalizeUrl removes fragments while preserving normal URL parts", () => {
  assert.equal(canonicalizeUrl("https://www.example.com/path?q=1#comments"), "https://www.example.com/path?q=1");
});

test("getHostname removes www prefixes", () => {
  assert.equal(getHostname("https://www.example.com/path"), "example.com");
});

test("buildCaptureExternalId is stable and content-sensitive", () => {
  const first = buildCaptureExternalId("selection", "https://example.com/page#section", "Selected text");
  const second = buildCaptureExternalId("selection", "https://example.com/page", "Selected text");
  const third = buildCaptureExternalId("selection", "https://example.com/page", "Other text");

  assert.equal(first, second);
  assert.notEqual(first, third);
});

test("getWordCount counts normalized words", () => {
  assert.equal(getWordCount("One  two\nthree"), 3);
});
