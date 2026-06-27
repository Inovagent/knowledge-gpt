function normalizePropertyMapping(propertyMapping = {}) {
  return {
    title: String(propertyMapping.title || "").trim(),
    videoUrl: String(propertyMapping.videoUrl || propertyMapping.url || "").trim(),
    videoId: String(propertyMapping.videoId || propertyMapping.externalId || "").trim(),
    channel: String(propertyMapping.channel || propertyMapping.source || "").trim(),
    sourceType: String(propertyMapping.sourceType || "").trim(),
    lastSyncedAt: String(propertyMapping.lastSyncedAt || "").trim()
  };
}

function buildTranscriptPayload(body, defaultDatabaseId) {
  const propertyMapping = normalizePropertyMapping(body.propertyMapping);
  const content = String(body.content || body.transcript || "").trim();
  const title = String(body.title || "").trim();
  const url = String(body.url || "").trim();
  const source = String(body.source || body.channel || "").trim();
  const sourceType = String(body.sourceType || "").trim();
  const externalId = String(body.externalId || body.videoId || "").trim();
  const contentType = String(body.contentType || (body.transcript ? "transcript" : "content")).trim();

  return {
    databaseId: String(body.databaseId || defaultDatabaseId || "").trim(),
    propertyMapping,
    payload: {
      videoId: externalId,
      externalId,
      url,
      title,
      channel: source,
      source,
      sourceType,
      transcript: content,
      content,
      contentType,
      capturedAt: body.capturedAt ? String(body.capturedAt).trim() : new Date().toISOString()
    }
  };
}

module.exports = {
  normalizePropertyMapping,
  buildTranscriptPayload
};
