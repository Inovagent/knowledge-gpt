const express = require("express");

function createHealthRouter(serverConfig) {
  const router = express.Router();

  router.get("/", (req, res) => {
    res.json({
      ok: true,
      host: serverConfig.host,
      port: serverConfig.port,
      hasNotionToken: Boolean(serverConfig.notionToken),
      hasDefaultDatabaseId: Boolean(serverConfig.defaultNotionDatabaseId)
    });
  });

  return router;
}

module.exports = {
  createHealthRouter
};
