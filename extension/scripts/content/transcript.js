function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TRANSCRIPT_EXTRACTORS = [
  {
    name: "legacy-renderer",
    rowSelector: "ytd-transcript-segment-renderer",
    textSelectors: [".segment-text"]
  },
  {
    name: "modern-engagement-panel",
    rowSelector: 'yt-section-list-renderer[data-target-id="PAmodern_transcript_view"] transcript-segment-view-model',
    textSelectors: ['span[role="text"]', ".ytAttributedStringHost"]
  },
  {
    name: "modern-contents-panel",
    rowSelector: "#contents transcript-segment-view-model",
    textSelectors: ['span[role="text"]', ".ytAttributedStringHost"]
  }
];

function textFromNode(node, selectors) {
  for (const selector of selectors) {
    const text = node.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return "";
}

function transcriptNodes() {
  for (const extractor of TRANSCRIPT_EXTRACTORS) {
    const nodes = Array.from(document.querySelectorAll(extractor.rowSelector));
    const lines = nodes.map((node) => textFromNode(node, extractor.textSelectors)).filter(Boolean);

    if (lines.length) {
      log("transcript-nodes:matched", { extractor: extractor.name, lines: lines.length });
      return lines;
    }
  }

  return [];
}

function isTranscriptVisible() {
  return transcriptNodes().length > 0;
}

function findTranscriptButton() {
  const candidates = Array.from(
    document.querySelectorAll('button[aria-label="Show transcript"], tp-yt-paper-button[aria-label="Show transcript"]')
  );

  if (candidates.length) {
    return candidates[0];
  }

  return Array.from(document.querySelectorAll("button, tp-yt-paper-button")).find((element) => {
    const label = element.getAttribute("aria-label") || element.textContent || "";
    return /show transcript/i.test(label);
  });
}

async function ensureTranscriptOpen() {
  log("ensure-transcript-open:start");

  if (isTranscriptVisible()) {
    log("ensure-transcript-open:already-visible");
    return;
  }

  const transcriptButton = findTranscriptButton();
  if (!transcriptButton) {
    throw new Error("Could not find YouTube's transcript button on this page.");
  }

  transcriptButton.click();
  log("ensure-transcript-open:clicked-show-transcript");

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(500);
    if (isTranscriptVisible()) {
      log("ensure-transcript-open:visible", { attempt: attempt + 1 });
      return;
    }
  }

  throw new Error("Transcript panel did not load in time.");
}

function normalizeTranscriptBody(transcript) {
  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

async function extractTranscript() {
  await ensureTranscriptOpen();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const lines = transcriptNodes();
    if (lines.length) {
      log("extract-transcript:success", { lines: lines.length });
      return lines.join("\n");
    }

    await sleep(500);
  }

  throw new Error("Transcript was empty after loading.");
}
