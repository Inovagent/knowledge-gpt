const { normalizePropertyMapping } = require("./payload");

function validateSaveTranscriptRequest(body, serverConfig) {
  const errors = [];

  if (!serverConfig.notionToken) {
    errors.push("Server is missing NOTION_TOKEN.");
  }

  if (!body || typeof body !== "object") {
    errors.push("Request body must be a JSON object.");
    return errors;
  }

  const fields = ["videoId", "url", "title", "channel", "transcript"];
  for (const field of fields) {
    if (!String(body[field] || "").trim()) {
      errors.push(`Missing required field: ${field}.`);
    }
  }

  const propertyMapping = normalizePropertyMapping(body.propertyMapping);

  if (!propertyMapping.title) {
    errors.push("Property mapping must include a title property name.");
  }

  if (!propertyMapping.videoId && !propertyMapping.videoUrl) {
    errors.push("Configure at least one dedupe property: videoId or videoUrl.");
  }

  const databaseId = String(body.databaseId || serverConfig.defaultNotionDatabaseId || "").trim();
  if (!databaseId) {
    errors.push("Missing Notion database ID.");
  }

  return errors;
}

module.exports = {
  validateSaveTranscriptRequest
};
