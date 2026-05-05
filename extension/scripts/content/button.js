function setButtonState(state, detail) {
  const button = document.getElementById(BUTTON_ID);
  if (!button) {
    return;
  }

  button.dataset.state = state;

  const stateLabelMap = {
    idle: "Save transcript",
    loading: "Saving transcript",
    saved: "Transcript saved",
    error: "Save failed",
    skipped: "Skipped"
  };

  button.innerHTML = ICONS[state] || ICONS.idle;
  button.setAttribute("aria-label", detail || stateLabelMap[state] || "Save transcript");
  button.title = detail || stateLabelMap[state] || "Save transcript";
  button.disabled = state === "loading";

  log("button-state", { state, detail: detail || "" });
}

async function saveTranscript() {
  log("save-transcript:clicked");

  if (isSaving) {
    log("save-transcript:ignored-already-saving");
    return;
  }

  if (!isWatchPage()) {
    setButtonState("error", "Open a YouTube watch page first.");
    return;
  }

  isSaving = true;
  setButtonState("loading");

  try {
    const transcript = await extractTranscript();
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
      setButtonState("skipped", response.data.reason || "Skipped because the entry is no longer To Process.");
      return;
    }

    await markVideoProcessed(payload.videoId, {
      title: payload.title,
      url: payload.url
    });
    setButtonState("saved", `Transcript ${response.data.action} in Notion.`);
  } catch (error) {
    log("save-transcript:error", error);
    setButtonState("error", error?.message || "Failed to save transcript.");
  } finally {
    isSaving = false;
  }
}

function createButton() {
  const container = document.createElement("div");
  container.id = BUTTON_CONTAINER_ID;
  container.className = "yt-transcript-to-notion";

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.className = "yt-transcript-to-notion__button";
  button.innerHTML = ICONS.idle;
  button.setAttribute("aria-label", "Save transcript");
  button.title = "Save transcript";
  button.addEventListener("click", saveTranscript);

  container.appendChild(button);
  return container;
}

async function syncButtonStateForCurrentVideo() {
  const videoId = getVideoId();
  if (!videoId) {
    return;
  }

  const processed = await isVideoProcessed(videoId);
  if (processed) {
    setButtonState("saved", "Transcript already saved for this video.");
    return;
  }

  setButtonState("idle", "Save transcript");
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
