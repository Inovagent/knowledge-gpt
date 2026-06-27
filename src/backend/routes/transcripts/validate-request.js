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

  const content = String(body.content || body.transcript || "").trim();
  const title = String(body.title || "").trim();
  const source = String(body.source || body.channel || "").trim();

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

  if (!propertyMapping.title) {
    errors.push("Property mapping must include a title property name.");
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
