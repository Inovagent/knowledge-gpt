const { upsertTranscript } = require("../transcripts/transcript-service");
const { STORAGE_DESTINATIONS } = require("./constants");

async function saveCapture({ payload, requestOptions, serverConfig }) {
  const result = await upsertTranscript({
    notionToken: serverConfig.notionToken,
    databaseId: requestOptions.databaseId,
    propertyMapping: requestOptions.propertyMapping,
    payload
  });

  return {
    ...result,
    storageDestination: STORAGE_DESTINATIONS.NOTION
  };
}

module.exports = {
  saveCapture
};
