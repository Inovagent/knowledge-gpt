const SAVE_BUTTON_LABELS = {
  idle: "Save transcript",
  loading: "Saving transcript",
  saved: "Transcript saved",
  error: "Save failed",
  skipped: "Skipped"
};

const COPY_BUTTON_LABELS = {
  idle: "Copy transcript",
  loading: "Copying transcript",
  copied: "Transcript copied",
  error: "Copy failed"
};

const COPY_SUCCESS_RESET_MS = 2000;

function getTranscriptSavedDetail(responseData) {
  if (responseData.storageDestination === "localMarkdown") {
    return "Transcript saved locally.";
  }

  return `Transcript ${responseData.action} in Notion.`;
}

function setActionButtonState(buttonId, state, detail, icons, labels) {
  const button = document.getElementById(buttonId);
  if (!button) {
    return;
  }

  button.dataset.state = state;
  button.innerHTML = icons[state] || icons.idle;
  button.setAttribute("aria-label", detail || labels[state] || labels.idle);
  button.title = detail || labels[state] || labels.idle;
  button.disabled = state === "loading";

  log("button-state", { buttonId, state, detail: detail || "" });
}

function setSaveButtonState(state, detail) {
  setActionButtonState(BUTTON_ID, state, detail, ICONS, SAVE_BUTTON_LABELS);
}

function setCopyButtonState(state, detail) {
  setActionButtonState(COPY_BUTTON_ID, state, detail, COPY_ICONS, COPY_BUTTON_LABELS);
}

function clearCopyResetTimeout() {
  if (copyResetTimeoutId) {
    window.clearTimeout(copyResetTimeoutId);
    copyResetTimeoutId = null;
  }
}

function scheduleCopyIdleReset() {
  clearCopyResetTimeout();
  copyResetTimeoutId = window.setTimeout(() => {
    copyResetTimeoutId = null;
    setCopyButtonState("idle");
  }, COPY_SUCCESS_RESET_MS);
}

async function withTranscriptExtraction() {
  if (isExtractingTranscript) {
    throw new Error("Transcript extraction already in progress.");
  }

  isExtractingTranscript = true;
  try {
    return await extractTranscript();
  } finally {
    isExtractingTranscript = false;
  }
}

async function saveTranscript() {
  log("save-transcript:clicked");

  if (isSaving) {
    log("save-transcript:ignored-already-saving");
    return;
  }

  if (!isWatchPage()) {
    setSaveButtonState("error", "Open a YouTube watch page first.");
    return;
  }

  isSaving = true;
  setSaveButtonState("loading");

  try {
    const transcript = await withTranscriptExtraction();
    const payload = {
      videoId: getVideoId(),
      url: window.location.href,
      title: getVideoTitle(),
      channel: getChannelName(),
      transcript,
      capturedAt: new Date().toISOString()
    };

    log("save-transcript:payload-ready", {
      videoId: payload.videoId,
      title: payload.title,
      channel: payload.channel,
      transcriptLength: payload.transcript.length
    });

    const response = await chrome.runtime.sendMessage({
      type: "SAVE_TRANSCRIPT",
      payload
    });

    log("save-transcript:background-response", response);

    if (!response?.ok) {
      throw new Error(response?.error || "Unknown save error.");
    }

    if (response.data.action === "skipped") {
      setSaveButtonState("skipped", response.data.reason || "Skipped because the entry is no longer To Process.");
      return;
    }

    await markVideoProcessed(payload.videoId, {
      title: payload.title,
      url: payload.url
    });
    setSaveButtonState("saved", getTranscriptSavedDetail(response.data));
  } catch (error) {
    log("save-transcript:error", error);
    setSaveButtonState("error", error?.message || "Failed to save transcript.");
  } finally {
    isSaving = false;
  }
}

async function copyTranscript() {
  log("copy-transcript:clicked");
  clearCopyResetTimeout();

  if (!isWatchPage()) {
    setCopyButtonState("error", "Open a YouTube watch page first.");
    scheduleCopyIdleReset();
    return;
  }

  setCopyButtonState("loading");

  try {
    const transcript = await withTranscriptExtraction();
    const normalizedTranscript = normalizeTranscriptBody(transcript);

    if (!normalizedTranscript) {
      throw new Error("Transcript was empty after loading.");
    }

    await navigator.clipboard.writeText(normalizedTranscript);
    log("copy-transcript:success", { length: normalizedTranscript.length });
    setCopyButtonState("copied", "Transcript copied to clipboard.");
    scheduleCopyIdleReset();
  } catch (error) {
    log("copy-transcript:error", error);
    setCopyButtonState("error", error?.message || "Failed to copy transcript.");
    scheduleCopyIdleReset();
  }
}

function createActionButton({ id, className, ariaLabel, title, onClick, icons }) {
  const button = document.createElement("button");
  button.id = id;
  button.type = "button";
  button.className = className;
  button.innerHTML = icons.idle;
  button.setAttribute("aria-label", ariaLabel);
  button.title = title;
  button.addEventListener("click", onClick);
  return button;
}

function createButton() {
  const container = document.createElement("div");
  container.id = BUTTON_CONTAINER_ID;
  container.className = "yt-transcript-to-notion";

  const copyButton = createActionButton({
    id: COPY_BUTTON_ID,
    className: "yt-transcript-to-notion__button yt-transcript-to-notion__button--copy",
    ariaLabel: "Copy transcript",
    title: "Copy transcript",
    onClick: copyTranscript,
    icons: COPY_ICONS
  });

  const saveButton = createActionButton({
    id: BUTTON_ID,
    className: "yt-transcript-to-notion__button yt-transcript-to-notion__button--save",
    ariaLabel: "Save transcript",
    title: "Save transcript",
    onClick: saveTranscript,
    icons: ICONS
  });

  container.appendChild(copyButton);
  container.appendChild(saveButton);
  return container;
}

async function syncButtonStateForCurrentVideo() {
  const videoId = getVideoId();
  if (!videoId) {
    return;
  }

  clearCopyResetTimeout();
  setCopyButtonState("idle");

  const processed = await isVideoProcessed(videoId);
  if (processed) {
    setSaveButtonState("saved", "Transcript already saved.");
    return;
  }

  setSaveButtonState("idle", "Save transcript");
}

async function mountButton() {
  const existing = document.getElementById(BUTTON_CONTAINER_ID);
  if (existing && !isWatchPage()) {
    existing.remove();
  }

  if (!isWatchPage()) {
    return;
  }

  const actionBar = findActionBar();
  if (!actionBar) {
    return;
  }

  if (document.getElementById(BUTTON_CONTAINER_ID)) {
    return;
  }

  const button = createButton();
  actionBar.prepend(button);
  await syncButtonStateForCurrentVideo();
  log("mount-button:mounted");
}

function handleNavigationChange() {
  const currentVideoId = getVideoId();
  if (currentVideoId === lastVideoId) {
    mountButton();
    return;
  }

  lastVideoId = currentVideoId;
  clearCopyResetTimeout();
  const existing = document.getElementById(BUTTON_CONTAINER_ID);
  if (existing) {
    existing.remove();
  }

  window.setTimeout(() => {
    mountButton();
  }, 800);
}

function startObservers() {
  if (mountObserver) {
    mountObserver.disconnect();
  }

  mountObserver = new MutationObserver(() => {
    mountButton();
  });

  mountObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}
