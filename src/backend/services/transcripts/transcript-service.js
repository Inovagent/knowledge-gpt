const { createNotionClient } = require("./notion-client");
const { buildTranscriptBlocks, getContentHeading } = require("./notion-blocks");
const { buildProperties, getPageStatusName } = require("./notion-properties");
const { findExistingPage } = require("./notion-queries");
const { TO_PROCESS_STATUS } = require("./constants");

async function upsertTranscript({
  notionToken,
  databaseId,
  propertyMapping,
  payload
}) {
  const notion = createNotionClient(notionToken);
  const existingPage = await findExistingPage(notion, databaseId, payload, propertyMapping);
  const properties = buildProperties(payload, propertyMapping);

  if (existingPage) {
    const existingStatus = getPageStatusName(existingPage);
    if (existingStatus !== TO_PROCESS_STATUS) {
      return {
        action: "skipped",
        reason: `Existing entry status is "${existingStatus || "empty"}", not "${TO_PROCESS_STATUS}".`,
        pageId: existingPage.id,
        pageUrl: existingPage.url
      };
    }

    await notion.blocks.delete({
      block_id: existingPage.id
    });
  }

  const createdPage = await notion.pages.create({
    parent: {
      database_id: databaseId
    },
    properties,
    children: buildTranscriptBlocks(payload.content || payload.transcript, getContentHeading(payload))
  });

  return {
    action: existingPage ? "recreated" : "created",
    pageId: createdPage.id,
    pageUrl: createdPage.url
  };
}

module.exports = {
  upsertTranscript
};
