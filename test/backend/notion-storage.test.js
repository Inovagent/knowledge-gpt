const test = require("node:test");
const assert = require("node:assert/strict");
const { upsertTranscript } = require("../../src/backend/services/transcripts/transcript-service");

const propertyMapping = {
  title: "Title",
  videoUrl: "URL",
  videoId: "External ID",
  channel: "Creator / Source"
};

const payload = {
  title: "Example",
  url: "https://example.com/video",
  source: "Creator",
  channel: "Creator",
  externalId: "video-1",
  videoId: "video-1",
  contentType: "transcript",
  capturedAt: "2026-05-05T10:00:00.000Z",
  content: "Transcript body"
};

function createFakeNotion(existingPage) {
  const calls = {
    queries: [],
    deletes: [],
    creates: []
  };

  const notion = {
    databases: {
      query: async (query) => {
        calls.queries.push(query);
        return {
          results: existingPage ? [existingPage] : []
        };
      }
    },
    blocks: {
      delete: async (request) => {
        calls.deletes.push(request);
        return {};
      }
    },
    pages: {
      create: async (request) => {
        calls.creates.push(request);
        return {
          id: "created-page",
          url: "https://notion.so/created-page"
        };
      }
    }
  };

  return {
    calls,
    notion
  };
}

test("upsertTranscript skips existing pages that are not To Process", async () => {
  const existingPage = {
    id: "existing-page",
    url: "https://notion.so/existing-page",
    properties: {
      Status: {
        type: "select",
        select: {
          name: "Done"
        }
      }
    }
  };
  const { calls, notion } = createFakeNotion(existingPage);

  const result = await upsertTranscript({
    notionToken: "secret",
    databaseId: "db",
    propertyMapping,
    payload,
    notionClient: notion
  });

  assert.equal(result.action, "skipped");
  assert.equal(result.pageId, "existing-page");
  assert.equal(calls.deletes.length, 0);
  assert.equal(calls.creates.length, 0);
});

test("upsertTranscript deletes and recreates existing To Process pages", async () => {
  const existingPage = {
    id: "existing-page",
    url: "https://notion.so/existing-page",
    properties: {
      Status: {
        type: "select",
        select: {
          name: "To Process"
        }
      }
    }
  };
  const { calls, notion } = createFakeNotion(existingPage);

  const result = await upsertTranscript({
    notionToken: "secret",
    databaseId: "db",
    propertyMapping,
    payload,
    notionClient: notion
  });

  assert.equal(result.action, "recreated");
  assert.deepEqual(calls.deletes, [{ block_id: "existing-page" }]);
  assert.equal(calls.creates.length, 1);
  assert.equal(calls.creates[0].parent.database_id, "db");
});

test("upsertTranscript creates a page when no match exists", async () => {
  const { calls, notion } = createFakeNotion(null);

  const result = await upsertTranscript({
    notionToken: "secret",
    databaseId: "db",
    propertyMapping,
    payload,
    notionClient: notion
  });

  assert.equal(result.action, "created");
  assert.equal(result.pageId, "created-page");
  assert.equal(calls.deletes.length, 0);
  assert.equal(calls.creates.length, 1);
});

test("upsertTranscript labels article bodies with an Article heading", async () => {
  const { calls, notion } = createFakeNotion(null);

  await upsertTranscript({
    notionToken: "secret",
    databaseId: "db",
    propertyMapping,
    payload: {
      ...payload,
      contentType: "article",
      content: "Article body"
    },
    notionClient: notion
  });

  assert.equal(calls.creates[0].children[0].heading_2.rich_text[0].text.content, "Article");
});

test("upsertTranscript does not dedupe selections by URL when no external id mapping exists", async () => {
  const existingPage = {
    id: "existing-page",
    url: "https://notion.so/existing-page",
    properties: {
      Status: {
        type: "select",
        select: {
          name: "To Process"
        }
      }
    }
  };
  const { calls, notion } = createFakeNotion(existingPage);

  const result = await upsertTranscript({
    notionToken: "secret",
    databaseId: "db",
    propertyMapping: {
      ...propertyMapping,
      videoId: ""
    },
    payload: {
      ...payload,
      contentType: "selection",
      sourceType: "Selection",
      content: "Selected body"
    },
    notionClient: notion
  });

  assert.equal(result.action, "created");
  assert.equal(calls.queries.length, 0);
  assert.equal(calls.deletes.length, 0);
  assert.equal(calls.creates.length, 1);
});
