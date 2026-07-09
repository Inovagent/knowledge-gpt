const {
  STORAGE_DESTINATIONS,
  SUPPORTED_STORAGE_DESTINATIONS
} = require("../../services/storage/constants");
const { validateLocalMarkdownRoot } = require("../../services/storage/local-markdown-storage");
const { normalizePropertyMapping, normalizeStorageDestination } = require("./payload");

function validateSaveTranscriptRequest(body, serverConfig) {
  const errors = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    errors.push("Request body must be a JSON object.");
    return errors;
  }

  const storageDestination = normalizeStorageDestination(body.storageDestination);
  const content = String(body.content || body.transcript || "").trim();
  const title = String(body.title || "").trim();
  const source = String(body.source || body.channel || "").trim();

  if (!storageDestination) {
    errors.push("Choose a storage destination in the extension options: notion or localMarkdown.");
  } else if (!SUPPORTED_STORAGE_DESTINATIONS.includes(storageDestination)) {
    errors.push(`storageDestination must be one of: ${SUPPORTED_STORAGE_DESTINATIONS.join(", ")}.`);
  }

  if (!title) {
    errors.push("Missing required field: title.");
  }

  if (!source) {
    errors.push("Missing required field: source.");
  }

  if (!content) {
    errors.push("Missing required field: content.");
  }

  const propertyMapping = normalizePropertyMapping(body.propertyMapping);

  if (storageDestination === STORAGE_DESTINATIONS.NOTION) {
    if (!serverConfig.notionToken) {
      errors.push("Server is missing NOTION_TOKEN.");
    }

    if (!propertyMapping.title) {
      errors.push("Property mapping must include a title property name.");
    }

    const databaseId = String(body.databaseId || serverConfig.defaultNotionDatabaseId || "").trim();
    if (!databaseId) {
      errors.push("Missing Notion database ID.");
    }
  }

  if (storageDestination === STORAGE_DESTINATIONS.LOCAL_MARKDOWN) {
    errors.push(...validateLocalMarkdownRoot(serverConfig.localMarkdownRoot));
  }

  return errors;
}

module.exports = {
  validateSaveTranscriptRequest
};
