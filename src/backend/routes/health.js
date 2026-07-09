const express = require("express");
const { validateLocalMarkdownRoot } = require("../services/storage/local-markdown-storage");

function createHealthRouter(serverConfig) {
  const router = express.Router();

  router.get("/", (req, res) => {
    const localMarkdownRootErrors = validateLocalMarkdownRoot(serverConfig.localMarkdownRoot);

    res.json({
      ok: true,
      host: serverConfig.host,
      port: serverConfig.port,
      hasNotionToken: Boolean(serverConfig.notionToken),
      hasDefaultDatabaseId: Boolean(serverConfig.defaultNotionDatabaseId),
      hasLocalMarkdownRoot: localMarkdownRootErrors.length === 0,
      localMarkdownRootError: localMarkdownRootErrors[0] || ""
    });
  });

  return router;
}

module.exports = {
  createHealthRouter
};
