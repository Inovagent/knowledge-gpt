const DEFAULT_SETTINGS = {
  storageDestination: "",
  backendUrl: "http://127.0.0.1:8787",
  databaseId: "",
  propertyMapping: {
    title: "Title",
    videoUrl: "URL",
    videoId: "",
    channel: "Creator / Source",
    sourceType: "Source Type",
    lastSyncedAt: ""
  }
};

function mergeSettings(stored = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    storageDestination: String(stored.storageDestination || DEFAULT_SETTINGS.storageDestination).trim(),
    propertyMapping: {
      ...DEFAULT_SETTINGS.propertyMapping,
      ...(stored.propertyMapping || {})
    }
  };
}
