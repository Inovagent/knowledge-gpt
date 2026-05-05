const express = require("express");
const { createHealthRouter } = require("./routes/health");
const { createTranscriptRouter } = require("./routes/transcripts");
const { cors } = require("./middleware/cors");
const { requestLogger } = require("./middleware/request-logger");

function createApp(serverConfig) {
  const app = express();

  app.use(express.json({ limit: "2mb" }));
  app.use(requestLogger);
  app.use(cors);
  app.use("/health", createHealthRouter(serverConfig));
  app.use("/", createTranscriptRouter(serverConfig));

  return app;
}

module.exports = {
  createApp
};
