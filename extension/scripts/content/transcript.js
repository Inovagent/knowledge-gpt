function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function transcriptNodes() {
  const oldNodes = Array.from(document.querySelectorAll("ytd-transcript-segment-renderer"));
  if (oldNodes.length) {
    return oldNodes
      .map((node) => node.querySelector(".segment-text")?.textContent?.trim())
      .filter(Boolean);
  }

  const newNodes = Array.from(document.querySelectorAll("#contents transcript-segment-view-model"));
  if (newNodes.length) {
    return newNodes
      .map((node) => node.querySelector('span[role="text"]')?.textContent?.trim())
      .filter(Boolean);
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
