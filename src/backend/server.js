require("dotenv").config();

const { createApp } = require("./app");
const { getServerConfig } = require("./config/env");
const { log } = require("./lib/logger");

const serverConfig = getServerConfig();
const app = createApp(serverConfig);

app.listen(serverConfig.port, serverConfig.host, () => {
  log("API", `YouTube Transcript backend listening on http://${serverConfig.host}:${serverConfig.port}`);
});
