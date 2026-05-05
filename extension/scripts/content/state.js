let mountObserver = null;
let lastVideoId = null;
let isSaving = false;

async function getProcessedVideos() {
  const stored = await chrome.storage.local.get(PROCESSED_VIDEOS_KEY);
  return stored[PROCESSED_VIDEOS_KEY] || {};
}

async function markVideoProcessed(videoId, metadata = {}) {
  if (!videoId) {
    return;
  }

  const processedVideos = await getProcessedVideos();
  processedVideos[videoId] = {
    processedAt: new Date().toISOString(),
    ...metadata
  };

  await chrome.storage.local.set({
    [PROCESSED_VIDEOS_KEY]: processedVideos
  });
}

async function isVideoProcessed(videoId) {
  if (!videoId) {
    return false;
  }

  const processedVideos = await getProcessedVideos();
  return Boolean(processedVideos[videoId]);
}
