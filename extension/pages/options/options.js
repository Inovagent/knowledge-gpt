async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  const settings = mergeSettings(stored);

  document.getElementById("backendUrl").value = settings.backendUrl;
  document.getElementById("databaseId").value = settings.databaseId;
  document.getElementById("title").value = settings.propertyMapping.title || "";
  document.getElementById("videoUrl").value = settings.propertyMapping.videoUrl || "";
  document.getElementById("videoId").value = settings.propertyMapping.videoId || "";
  document.getElementById("channel").value = settings.propertyMapping.channel || "";
  document.getElementById("sourceType").value = settings.propertyMapping.sourceType || "";
  document.getElementById("lastSyncedAt").value = settings.propertyMapping.lastSyncedAt || "";
}

async function saveSettings(event) {
  event.preventDefault();

  const settings = {
    backendUrl: document.getElementById("backendUrl").value.trim(),
    databaseId: document.getElementById("databaseId").value.trim(),
    propertyMapping: {
      title: document.getElementById("title").value.trim(),
      videoUrl: document.getElementById("videoUrl").value.trim(),
      videoId: document.getElementById("videoId").value.trim(),
      channel: document.getElementById("channel").value.trim(),
      sourceType: document.getElementById("sourceType").value.trim(),
      lastSyncedAt: document.getElementById("lastSyncedAt").value.trim()
    }
  };

  await chrome.storage.sync.set(settings);

  const status = document.getElementById("status");
  status.textContent = "Saved.";

  window.setTimeout(() => {
    status.textContent = "";
  }, 2500);
}

document.getElementById("settings-form").addEventListener("submit", saveSettings);
loadSettings();
