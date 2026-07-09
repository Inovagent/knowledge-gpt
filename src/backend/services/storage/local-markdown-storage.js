const fs = require("fs");
const os = require("os");
const path = require("path");
const { STORAGE_DESTINATIONS } = require("./constants");

const MAX_BASENAME_LENGTH = 180;
const MAX_TITLE_SLUG_LENGTH = 96;
const MAX_TYPE_SLUG_LENGTH = 32;
const MAX_EXTERNAL_ID_SLUG_LENGTH = 24;
const MAX_COLLISION_ATTEMPTS = 1000;

function expandHomePath(rawPath) {
  const trimmedPath = String(rawPath || "").trim();
  if (trimmedPath.startsWith("~/")) {
    return path.join(os.homedir(), trimmedPath.slice(2));
  }

  return trimmedPath;
}

function resolveLocalMarkdownRoot(rawRoot) {
  const expandedRoot = expandHomePath(rawRoot);

  if (!expandedRoot) {
    throw new Error("Server is missing LOCAL_MARKDOWN_ROOT.");
  }

  if (!path.isAbsolute(expandedRoot)) {
    throw new Error("LOCAL_MARKDOWN_ROOT must be an absolute path or start with ~/.");
  }

  if (!fs.existsSync(expandedRoot)) {
    throw new Error("LOCAL_MARKDOWN_ROOT must point to an existing directory.");
  }

  const rootPath = fs.realpathSync(expandedRoot);
  const stats = fs.statSync(rootPath);
  if (!stats.isDirectory()) {
    throw new Error("LOCAL_MARKDOWN_ROOT must point to an existing directory.");
  }

  try {
    fs.accessSync(rootPath, fs.constants.W_OK);
  } catch (caughtError) {
    throw new Error("LOCAL_MARKDOWN_ROOT must be writable.");
  }

  return rootPath;
}

function validateLocalMarkdownRoot(rawRoot) {
  try {
    resolveLocalMarkdownRoot(rawRoot);
    return [];
  } catch (caughtError) {
    return [caughtError?.message || "LOCAL_MARKDOWN_ROOT is not writable."];
  }
}

function slugify(value, maxLength, fallback = "untitled") {
  const normalized = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const trimmed = normalized.slice(0, maxLength).replace(/-+$/g, "");
  return trimmed || fallback;
}

function getCaptureDate(payload) {
  const capturedAt = new Date(payload.capturedAt || "");
  const date = Number.isNaN(capturedAt.getTime()) ? new Date() : capturedAt;
  return date.toISOString().slice(0, 10);
}

function truncateBasename(basename, maxLength = MAX_BASENAME_LENGTH) {
  if (basename.length <= maxLength) {
    return basename;
  }

  return basename.slice(0, maxLength).replace(/-+$/g, "") || basename.slice(0, maxLength);
}

function buildLocalMarkdownFilename(payload) {
  const datePart = getCaptureDate(payload);
  const typePart = slugify(payload.contentType || payload.sourceType || "capture", MAX_TYPE_SLUG_LENGTH, "capture");
  const titlePart = slugify(payload.title, MAX_TITLE_SLUG_LENGTH, "untitled");
  const externalIdPart = slugify(payload.externalId || payload.videoId, MAX_EXTERNAL_ID_SLUG_LENGTH, "");
  const basename = truncateBasename([datePart, typePart, titlePart, externalIdPart].filter(Boolean).join("-"));

  return `${basename}.md`;
}

function buildCollisionFilename(filename, attempt) {
  if (attempt === 1) {
    return filename;
  }

  const suffix = `-${attempt}`;
  const basename = filename.endsWith(".md") ? filename.slice(0, -3) : filename;
  return `${truncateBasename(basename, MAX_BASENAME_LENGTH - suffix.length)}${suffix}.md`;
}

function assertSafeMarkdownTarget(rootPath, filename) {
  if (path.basename(filename) !== filename || !filename.endsWith(".md")) {
    throw new Error("Generated Markdown filename is invalid.");
  }

  const targetPath = path.resolve(rootPath, filename);
  const relativePath = path.relative(rootPath, targetPath);
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Generated Markdown target escaped LOCAL_MARKDOWN_ROOT.");
  }

  return targetPath;
}

function yamlString(value) {
  return `"${String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")}"`;
}

function addFrontmatterValue(lines, key, value, indent = "") {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return;
  }

  lines.push(`${indent}${key}: ${yamlString(normalized)}`);
}

function getWebsite(payload) {
  if (!payload.url) {
    return "";
  }

  try {
    return new URL(payload.url).hostname.replace(/^www\./i, "");
  } catch (caughtError) {
    return "";
  }
}

function buildMarkdownFrontmatter(payload) {
  const lines = ["---"];
  const isTranscript = payload.contentType === "transcript";

  addFrontmatterValue(lines, "website", getWebsite(payload));
  addFrontmatterValue(lines, "title", payload.title);
  addFrontmatterValue(lines, "url", payload.url);
  addFrontmatterValue(lines, "source", payload.source || payload.channel);
  addFrontmatterValue(lines, "sourceType", payload.sourceType);
  addFrontmatterValue(lines, "capturedAt", payload.capturedAt);
  addFrontmatterValue(lines, "externalId", payload.externalId || payload.videoId);
  addFrontmatterValue(lines, "contentType", payload.contentType);

  if (isTranscript && (payload.videoId || payload.channel)) {
    lines.push("video:");
    addFrontmatterValue(lines, "id", payload.videoId, "  ");
    addFrontmatterValue(lines, "channel", payload.channel, "  ");
  }

  lines.push("---");
  return lines.join("\n");
}

function normalizeMarkdownContent(content) {
  return String(content || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function getMarkdownHeading(payload) {
  const headings = {
    article: "Article",
    email: "Content",
    selection: "Selection",
    transcript: "Transcript"
  };

  return headings[payload.contentType] || "Content";
}

function normalizeMarkdownTitle(title) {
  return String(title || "Untitled")
    .replace(/\s+/g, " ")
    .trim() || "Untitled";
}

function buildMarkdownDocument(payload) {
  const content = normalizeMarkdownContent(payload.content || payload.transcript);

  return [
    buildMarkdownFrontmatter(payload),
    "",
    `# ${normalizeMarkdownTitle(payload.title)}`,
    "",
    `## ${getMarkdownHeading(payload)}`,
    "",
    content,
    ""
  ].join("\n");
}

async function writeLocalMarkdownCapture({ root, payload }) {
  const rootPath = resolveLocalMarkdownRoot(root);
  const baseFilename = buildLocalMarkdownFilename(payload);
  const document = buildMarkdownDocument(payload);

  for (let attempt = 1; attempt <= MAX_COLLISION_ATTEMPTS; attempt += 1) {
    const filename = buildCollisionFilename(baseFilename, attempt);
    const targetPath = assertSafeMarkdownTarget(rootPath, filename);

    try {
      await fs.promises.writeFile(targetPath, document, {
        encoding: "utf8",
        flag: "wx"
      });

      return {
        filename,
        filePath: targetPath
      };
    } catch (caughtError) {
      if (caughtError?.code === "EEXIST") {
        continue;
      }

      throw caughtError;
    }
  }

  throw new Error(`Could not create a unique Markdown filename after ${MAX_COLLISION_ATTEMPTS} attempts.`);
}

async function saveCapture({ payload, serverConfig }) {
  const result = await writeLocalMarkdownCapture({
    root: serverConfig.localMarkdownRoot,
    payload
  });

  return {
    action: "created",
    storageDestination: STORAGE_DESTINATIONS.LOCAL_MARKDOWN,
    filename: result.filename
  };
}

module.exports = {
  MAX_BASENAME_LENGTH,
  assertSafeMarkdownTarget,
  buildLocalMarkdownFilename,
  buildMarkdownDocument,
  buildMarkdownFrontmatter,
  saveCapture,
  slugify,
  validateLocalMarkdownRoot,
  writeLocalMarkdownCapture
};
