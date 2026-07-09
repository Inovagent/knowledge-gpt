const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const transcriptScriptPath = path.join(__dirname, "../../extension/scripts/content/transcript.js");

function createNode(textBySelector = {}) {
  return {
    querySelector(selector) {
      const text = textBySelector[selector];
      return text === undefined ? null : { textContent: text };
    }
  };
}

function loadTranscriptContext(document) {
  const context = vm.createContext({
    document,
    log() {}
  });

  vm.runInContext(fs.readFileSync(transcriptScriptPath, "utf8"), context);
  return context;
}

function getTranscriptNodes(context) {
  return Array.from(context.transcriptNodes());
}

test("transcriptNodes extracts the legacy transcript renderer", () => {
  const legacyRows = [createNode({ ".segment-text": " First legacy line " }), createNode({ ".segment-text": "Second legacy line" })];
  const document = {
    querySelectorAll(selector) {
      return selector === "ytd-transcript-segment-renderer" ? legacyRows : [];
    }
  };
  const context = loadTranscriptContext(document);

  assert.deepEqual(getTranscriptNodes(context), ["First legacy line", "Second legacy line"]);
});

test("transcriptNodes extracts YouTube's modern PAmodern_transcript_view panel", () => {
  const modernRows = [
    createNode({ 'span[role="text"]': "I'm here with Eddie Kim, Gusto's co-founder and head of technology." }),
    createNode({ 'span[role="text"]': "annual revenue and now serves over 500,000 small businesses in the US." })
  ];
  const document = {
    querySelectorAll(selector) {
      if (selector === "ytd-transcript-segment-renderer") {
        return [];
      }

      if (selector === 'yt-section-list-renderer[data-target-id="PAmodern_transcript_view"] transcript-segment-view-model') {
        return modernRows;
      }

      return [];
    }
  };
  const context = loadTranscriptContext(document);

  assert.deepEqual(getTranscriptNodes(context), [
    "I'm here with Eddie Kim, Gusto's co-founder and head of technology.",
    "annual revenue and now serves over 500,000 small businesses in the US."
  ]);
});

test("transcriptNodes keeps trying newer transcript shapes when stale legacy nodes have no text", () => {
  const staleLegacyRows = [createNode()];
  const fallbackRows = [createNode({ 'span[role="text"]': "Modern fallback line" })];
  const document = {
    querySelectorAll(selector) {
      if (selector === "ytd-transcript-segment-renderer") {
        return staleLegacyRows;
      }

      if (selector === "#contents transcript-segment-view-model") {
        return fallbackRows;
      }

      return [];
    }
  };
  const context = loadTranscriptContext(document);

  assert.deepEqual(getTranscriptNodes(context), ["Modern fallback line"]);
});
