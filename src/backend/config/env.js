const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 8787;

function getServerConfig() {
  return {
    host: process.env.HOST || DEFAULT_HOST,
    port: Number(process.env.PORT || DEFAULT_PORT),
    notionToken: String(process.env.NOTION_TOKEN || "").trim(),
    defaultNotionDatabaseId: String(process.env.DEFAULT_NOTION_DATABASE_ID || "").trim()
  };
}

module.exports = {
  getServerConfig
};
