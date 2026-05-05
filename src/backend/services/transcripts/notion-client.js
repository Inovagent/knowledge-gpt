const { Client } = require("@notionhq/client");
const { NOTION_VERSION } = require("./constants");

function createNotionClient(auth) {
  return new Client({ auth, notionVersion: NOTION_VERSION });
}

module.exports = {
  createNotionClient
};
