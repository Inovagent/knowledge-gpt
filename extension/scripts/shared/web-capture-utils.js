(function attachWebCaptureUtils(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.KnowledgeGptWebCaptureUtils = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildWebCaptureUtils() {
  const MAX_TITLE_LENGTH = 180;

  function normalizeTextBlock(value) {
    return String(value || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function normalizeInlineText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function sanitizeTitle(value, fallback = "Untitled capture") {
    const normalized = normalizeInlineText(value).replace(/\s[|:-]\s[^|:-]{1,80}$/g, "");
    return (normalized || fallback).slice(0, MAX_TITLE_LENGTH).trim() || fallback;
  }

  function canonicalizeUrl(value) {
    const rawUrl = String(value || "").trim();
    if (!rawUrl) {
      return "";
    }

    try {
      const url = new URL(rawUrl);
      url.hash = "";
      return url.toString();
    } catch (caughtError) {
      return rawUrl;
    }
  }

  function getHostname(value) {
    try {
      return new URL(value).hostname.replace(/^www\./i, "");
    } catch (caughtError) {
      return "";
    }
  }

  function hashString(value) {
    let hash = 5381;
    const input = String(value || "");

    for (let index = 0; index < input.length; index += 1) {
      hash = (hash * 33) ^ input.charCodeAt(index);
    }

    return (hash >>> 0).toString(36);
  }

  function buildCaptureExternalId(contentType, url, content) {
    const normalizedType = normalizeInlineText(contentType || "capture").toLowerCase();
    const normalizedUrl = canonicalizeUrl(url);
    const normalizedContent = normalizeTextBlock(content);
    return `${normalizedType}:${hashString(`${normalizedUrl}\n${normalizedContent}`)}`;
  }

  function getWordCount(value) {
    const normalized = normalizeTextBlock(value);
    if (!normalized) {
      return 0;
    }

    return normalized.split(/\s+/).filter(Boolean).length;
  }

  return {
    buildCaptureExternalId,
    canonicalizeUrl,
    getHostname,
    getWordCount,
    hashString,
    normalizeInlineText,
    normalizeTextBlock,
    sanitizeTitle
  };
});
