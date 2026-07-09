const STORAGE_DESTINATIONS = {
  NOTION: "notion",
  LOCAL_MARKDOWN: "localMarkdown"
};

let localMarkdownStatusRequestId = 0;

function getElement(id) {
  return document.getElementById(id);
}

function getNotionInputs() {
  return [
    getElement("databaseId"),
    getElement("title"),
    getElement("videoUrl"),
    getElement("videoId"),
    getElement("channel"),
    getElement("sourceType"),
    getElement("lastSyncedAt")
  ];
}

function setNotionInputsEnabled(enabled) {
  for (const input of getNotionInputs()) {
    input.disabled = !enabled;
  }

  getElement("title").required = enabled;
}

async function updateLocalMarkdownStatus() {
  const status = getElement("localMarkdownStatus");
  const requestId = ++localMarkdownStatusRequestId;
  const candidateBaseUrls = buildCandidateUrls(getElement("backendUrl").value);

  if (!candidateBaseUrls.length) {
    status.textContent = "Set a backend URL to check LOCAL_MARKDOWN_ROOT.";
    return;
  }

  status.textContent = "Checking backend setup...";

  for (const baseUrl of candidateBaseUrls) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json().catch(() => ({}));
      if (requestId !== localMarkdownStatusRequestId) {
        return;
      }

      if (!response.ok || !data.ok) {
        continue;
      }

      status.textContent = data.hasLocalMarkdownRoot
        ? "Backend reports LOCAL_MARKDOWN_ROOT is configured and writable."
        : data.localMarkdownRootError || "Backend is reachable, but LOCAL_MARKDOWN_ROOT is not usable.";
      return;
    } catch (caughtError) {
      // Try the next localhost variant before showing an error.
    }
  }

  if (requestId === localMarkdownStatusRequestId) {
    status.textContent = "Could not reach the backend to check LOCAL_MARKDOWN_ROOT.";
  }
}

function updateDestinationUi() {
  const storageDestination = getElement("storageDestination").value;
  const isNotion = storageDestination === STORAGE_DESTINATIONS.NOTION;
  const isLocalMarkdown = storageDestination === STORAGE_DESTINATIONS.LOCAL_MARKDOWN;

  getElement("notion-settings").hidden = !isNotion;
  getElement("local-markdown-settings").hidden = !isLocalMarkdown;
  setNotionInputsEnabled(isNotion);

  if (isLocalMarkdown) {
    updateLocalMarkdownStatus();
  }
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const settings = mergeSettings(stored);

  getElement("storageDestination").value = settings.storageDestination;
  getElement("backendUrl").value = settings.backendUrl;
  getElement("databaseId").value = settings.databaseId;
  getElement("title").value = settings.propertyMapping.title || "";
  getElement("videoUrl").value = settings.propertyMapping.videoUrl || "";
  getElement("videoId").value = settings.propertyMapping.videoId || "";
  getElement("channel").value = settings.propertyMapping.channel || "";
  getElement("sourceType").value = settings.propertyMapping.sourceType || "";
  getElement("lastSyncedAt").value = settings.propertyMapping.lastSyncedAt || "";
  updateDestinationUi();
}

async function saveSettings(event) {
  event.preventDefault();

  const settings = {
    storageDestination: getElement("storageDestination").value.trim(),
    backendUrl: getElement("backendUrl").value.trim(),
    databaseId: getElement("databaseId").value.trim(),
    propertyMapping: {
      title: getElement("title").value.trim(),
      videoUrl: getElement("videoUrl").value.trim(),
      videoId: getElement("videoId").value.trim(),
      channel: getElement("channel").value.trim(),
      sourceType: getElement("sourceType").value.trim(),
      lastSyncedAt: getElement("lastSyncedAt").value.trim()
    }
  };

  await chrome.storage.sync.set(settings);

  updateDestinationUi();

  const status = getElement("status");
  status.textContent = "Saved.";

  window.setTimeout(() => {
    status.textContent = "";
  }, 2500);
}

getElement("storageDestination").addEventListener("change", updateDestinationUi);
getElement("backendUrl").addEventListener("change", updateDestinationUi);
getElement("settings-form").addEventListener("submit", saveSettings);
loadSettings();
