const DEFAULT_SETTINGS = {
  backendUrl: "http://127.0.0.1:8787",
  databaseId: "",
  propertyMapping: {
    title: "Title",
    videoUrl: "URL",
    videoId: "",
    channel: "Creator / Source",
    lastSyncedAt: ""
  }
};

function mergeSettings(stored = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    propertyMapping: {
      ...DEFAULT_SETTINGS.propertyMapping,
      ...(stored.propertyMapping || {})
    }
  };
}
