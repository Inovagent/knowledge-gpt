const express = require("express");
const { error, log } = require("../../lib/logger");
const { upsertTranscript } = require("../../services/transcripts/transcript-service");
const { buildTranscriptPayload } = require("./payload");
const { validateSaveTranscriptRequest } = require("./validate-request");

function createTranscriptRouter(serverConfig) {
  const router = express.Router();

  router.post("/save-transcript", async (req, res) => {
    const errors = validateSaveTranscriptRequest(req.body, serverConfig);
    if (errors.length) {
      error("API", "validation-error", errors);
      return res.status(400).json({
        ok: false,
        errors
      });
    }

    const { databaseId, propertyMapping, payload } = buildTranscriptPayload(
      req.body,
      serverConfig.defaultNotionDatabaseId
    );

    try {
      log("API", "save-transcript:start", {
        databaseId,
        title: payload.title,
        url: payload.url,
        channel: payload.channel,
        transcriptLength: payload.transcript.length
      });

      const result = await upsertTranscript({
        notionToken: serverConfig.notionToken,
        databaseId,
        propertyMapping,
        payload
      });

      log("API", "save-transcript:success", result);

      return res.json({
        ok: true,
        ...result
      });
    } catch (caughtError) {
      const message = caughtError && caughtError.message ? caughtError.message : "Unexpected Notion error.";
      error("API", "save-transcript:error", message);
      return res.status(500).json({
        ok: false,
        error: message
      });
    }
  });

  return router;
}

module.exports = {
  createTranscriptRouter
};
