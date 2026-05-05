function normalizePropertyMapping(propertyMapping = {}) {
  return {
    title: String(propertyMapping.title || "").trim(),
    videoUrl: String(propertyMapping.videoUrl || "").trim(),
    videoId: String(propertyMapping.videoId || "").trim(),
    channel: String(propertyMapping.channel || "").trim(),
    lastSyncedAt: String(propertyMapping.lastSyncedAt || "").trim()
  };
}

function buildTranscriptPayload(body, defaultDatabaseId) {
  const propertyMapping = normalizePropertyMapping(body.propertyMapping);

  return {
    databaseId: String(body.databaseId || defaultDatabaseId || "").trim(),
    propertyMapping,
    payload: {
      videoId: String(body.videoId).trim(),
      url: String(body.url).trim(),
      title: String(body.title).trim(),
      channel: String(body.channel).trim(),
      transcript: String(body.transcript).trim(),
      capturedAt: body.capturedAt ? String(body.capturedAt).trim() : new Date().toISOString()
    }
  };
}

module.exports = {
  normalizePropertyMapping,
  buildTranscriptPayload
};
