const express = require("express");
const { error, log } = require("../../lib/logger");
const { saveCapture } = require("../../services/storage/storage-service");
const { buildTranscriptPayload } = require("./payload");
const { validateSaveTranscriptRequest } = require("./validate-request");

function createTranscriptRouter(serverConfig) {
  const router = express.Router();

  async function handleSave(req, res) {
    const errors = validateSaveTranscriptRequest(req.body, serverConfig);
    if (errors.length) {
      error("API", "validation-error", errors);
      return res.status(400).json({
        ok: false,
        errors
      });
    }

    const { storageDestination, requestOptions, payload } = buildTranscriptPayload(
      req.body,
      serverConfig.defaultNotionDatabaseId
    );
    const content = payload.content || payload.transcript || "";

    try {
      log("API", "save-capture:start", {
        storageDestination,
        databaseId: requestOptions.databaseId || undefined,
        title: payload.title,
        url: payload.url,
        source: payload.source || payload.channel,
        sourceType: payload.sourceType,
        contentType: payload.contentType,
        contentLength: content.length
      });

      const result = await saveCapture({
        storageDestination,
        requestOptions,
        serverConfig,
        payload
      });

      log("API", "save-capture:success", result);

      return res.json({
        ok: true,
        ...result
      });
    } catch (caughtError) {
      const message = caughtError && caughtError.message ? caughtError.message : "Unexpected save error.";
      error("API", "save-capture:error", message);
      return res.status(500).json({
        ok: false,
        error: message
      });
    }
  }

  router.post("/save-transcript", handleSave);
  router.post("/save-content", handleSave);

  return router;
}

module.exports = {
  createTranscriptRouter
};
