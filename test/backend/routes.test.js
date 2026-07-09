const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { createApp } = require("../../src/backend/app");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "knowledge-gpt-"));
}

async function withServer(serverConfig, run) {
  const server = http.createServer(createApp(serverConfig));

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const { port } = server.address();
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  return {
    response,
    data: await response.json()
  };
}

test("POST /save-content rejects missing storageDestination", async () => {
  await withServer({}, async (baseUrl) => {
    const { response, data } = await postJson(`${baseUrl}/save-content`, {
      title: "Example",
      source: "Sender",
      content: "Body"
    });

    assert.equal(response.status, 400);
    assert.equal(data.ok, false);
    assert.deepEqual(data.errors, ["Choose a storage destination in the extension options: notion or localMarkdown."]);
  });
});

test("POST /save-content writes local Markdown when localMarkdown is selected", async () => {
  const root = makeTempDir();
  try {
    await withServer(
      {
        localMarkdownRoot: root
      },
      async (baseUrl) => {
        const { response, data } = await postJson(`${baseUrl}/save-content`, {
          storageDestination: "localMarkdown",
          title: "Example Email",
          source: "Sender",
          content: "Body",
          contentType: "email",
          externalId: "message-1",
          capturedAt: "2026-05-05T10:00:00.000Z"
        });

        assert.equal(response.status, 200);
        assert.equal(data.ok, true);
        assert.equal(data.action, "created");
        assert.equal(data.storageDestination, "localMarkdown");
        assert.equal(data.filename, "2026-05-05-email-example-email-message-1.md");
        assert.match(fs.readFileSync(path.join(root, data.filename), "utf8"), /## Content\n\nBody/);
      }
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("POST /save-transcript applies Notion-only validation when notion is selected", async () => {
  await withServer({}, async (baseUrl) => {
    const { response, data } = await postJson(`${baseUrl}/save-transcript`, {
      storageDestination: "notion",
      title: "Video",
      channel: "Creator",
      transcript: "Transcript"
    });

    assert.equal(response.status, 400);
    assert.deepEqual(data.errors, [
      "Server is missing NOTION_TOKEN.",
      "Property mapping must include a title property name.",
      "Missing Notion database ID."
    ]);
  });
});

test("GET /health reports configured storage capabilities without exposing local paths", async () => {
  const root = makeTempDir();
  try {
    await withServer(
      {
        host: "127.0.0.1",
        port: 0,
        localMarkdownRoot: root,
        notionToken: "",
        defaultNotionDatabaseId: ""
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health`);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.hasLocalMarkdownRoot, true);
        assert.equal(data.localMarkdownRootError, "");
        assert.equal(Object.values(data).includes(root), false);
      }
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("GET /health reports invalid local Markdown roots without exposing local paths", async () => {
  const root = makeTempDir();
  const missingRoot = path.join(root, "missing");
  try {
    await withServer(
      {
        host: "127.0.0.1",
        port: 0,
        localMarkdownRoot: missingRoot,
        notionToken: "",
        defaultNotionDatabaseId: ""
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/health`);
        const data = await response.json();

        assert.equal(response.status, 200);
        assert.equal(data.hasLocalMarkdownRoot, false);
        assert.equal(data.localMarkdownRootError, "LOCAL_MARKDOWN_ROOT must point to an existing directory.");
        assert.equal(Object.values(data).includes(missingRoot), false);
      }
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
