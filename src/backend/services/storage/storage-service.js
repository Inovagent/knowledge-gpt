const { STORAGE_DESTINATIONS } = require("./constants");
const notionStorage = require("./notion-storage");
const localMarkdownStorage = require("./local-markdown-storage");

async function saveCapture({ storageDestination, payload, requestOptions, serverConfig }) {
  if (storageDestination === STORAGE_DESTINATIONS.NOTION) {
    return notionStorage.saveCapture({
      payload,
      requestOptions,
      serverConfig
    });
  }

  if (storageDestination === STORAGE_DESTINATIONS.LOCAL_MARKDOWN) {
    return localMarkdownStorage.saveCapture({
      payload,
      requestOptions,
      serverConfig
    });
  }

  throw new Error(`Unsupported storage destination: ${storageDestination || "empty"}.`);
}

module.exports = {
  saveCapture
};
