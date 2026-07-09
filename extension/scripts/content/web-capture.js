(function initializeWebCapture() {
  if (globalThis.KnowledgeGptWebCapture?.initialized) {
    return;
  }

  const utils = globalThis.KnowledgeGptWebCaptureUtils;
  const ARTICLE_MIN_CHARS = 120;
  const ENABLE_KEYBOARD_SAVE_SHORTCUT = false;
  const OVERLAY_ID = "knowledge-gpt-web-capture-root";
  const SKIPPED_TAGS = new Set(["script", "style", "noscript", "template", "svg", "canvas", "form", "button", "iframe"]);
  const BLOCK_TAGS = new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "details",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "header",
    "hr",
    "li",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul"
  ]);

  function captureLog(...args) {
    console.log("[Knowledge GPT Capture]", ...args);
  }

  function getUtility(name) {
    if (!utils?.[name]) {
      throw new Error("Web capture utilities failed to load. Reload the extension and try again.");
    }

    return utils[name];
  }

  const normalizeTextBlock = getUtility("normalizeTextBlock");
  const normalizeInlineText = getUtility("normalizeInlineText");
  const sanitizeTitle = getUtility("sanitizeTitle");
  const canonicalizeUrl = getUtility("canonicalizeUrl");
  const getHostname = getUtility("getHostname");
  const getWordCount = getUtility("getWordCount");
  const buildCaptureExternalId = getUtility("buildCaptureExternalId");

  function getPageUrl() {
    return canonicalizeUrl(window.location.href);
  }

  function getDefaultSource() {
    return getHostname(window.location.href) || "Web page";
  }

  function isSafeLink(value) {
    if (!value) {
      return false;
    }

    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:", "mailto:"].includes(url.protocol);
    } catch (caughtError) {
      return false;
    }
  }

  function normalizeMarkdown(value) {
    return normalizeTextBlock(value)
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n[ \t]+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function textContentOf(node) {
    return normalizeInlineText(node?.textContent || "");
  }

  function markdownChildren(node, state = {}) {
    return Array.from(node.childNodes || [])
      .map((child) => markdownNode(child, state))
      .join("");
  }

  function markdownListItem(node, state) {
    const listDepth = state.listDepth || 0;
    const indent = "  ".repeat(listDepth);
    const marker = state.ordered ? `${state.index}. ` : "- ";
    const content = normalizeMarkdown(markdownChildren(node, { ...state, listDepth: listDepth + 1 }))
      .replace(/\n/g, `\n${indent}  `)
      .trim();

    return `${indent}${marker}${content}\n`;
  }

  function markdownNode(node, state = {}) {
    if (!node) {
      return "";
    }

    if (node.nodeType === Node.TEXT_NODE) {
      return node.nodeValue.replace(/\s+/g, " ");
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return "";
    }

    const tagName = node.tagName.toLowerCase();
    if (SKIPPED_TAGS.has(tagName)) {
      return "";
    }

    if (/^h[1-6]$/.test(tagName)) {
      const level = Number(tagName.slice(1));
      const headingText = textContentOf(node);
      return headingText ? `\n\n${"#".repeat(level)} ${headingText}\n\n` : "";
    }

    if (tagName === "p") {
      const content = normalizeMarkdown(markdownChildren(node, state));
      return content ? `\n\n${content}\n\n` : "";
    }

    if (tagName === "br") {
      return "\n";
    }

    if (tagName === "strong" || tagName === "b") {
      const content = normalizeInlineText(markdownChildren(node, state));
      return content ? `**${content}**` : "";
    }

    if (tagName === "em" || tagName === "i") {
      const content = normalizeInlineText(markdownChildren(node, state));
      return content ? `*${content}*` : "";
    }

    if (tagName === "code" && node.parentElement?.tagName?.toLowerCase() !== "pre") {
      const content = normalizeInlineText(node.textContent || "");
      return content ? `\`${content.replace(/`/g, "'")}\`` : "";
    }

    if (tagName === "pre") {
      const content = normalizeTextBlock(node.textContent || "");
      return content ? `\n\n\`\`\`\n${content}\n\`\`\`\n\n` : "";
    }

    if (tagName === "a") {
      const content = normalizeInlineText(markdownChildren(node, state)) || normalizeInlineText(node.textContent || "");
      const href = node.getAttribute("href");
      if (!content) {
        return "";
      }

      if (isSafeLink(href)) {
        const absoluteHref = new URL(href, window.location.href).toString();
        return absoluteHref === content ? content : `[${content}](${absoluteHref})`;
      }

      return content;
    }

    if (tagName === "img") {
      const alt = normalizeInlineText(node.getAttribute("alt") || "");
      return alt ? `[Image: ${alt}]` : "";
    }

    if (tagName === "blockquote") {
      const content = normalizeMarkdown(markdownChildren(node, state));
      if (!content) {
        return "";
      }

      return `\n\n${content
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;
    }

    if (tagName === "ul" || tagName === "ol") {
      const children = Array.from(node.children || []).filter((child) => child.tagName.toLowerCase() === "li");
      const ordered = tagName === "ol";
      const content = children
        .map((child, index) =>
          markdownListItem(child, {
            ...state,
            ordered,
            index: index + 1
          })
        )
        .join("");

      return content ? `\n${content}\n` : "";
    }

    if (tagName === "li") {
      return markdownListItem(node, state);
    }

    if (tagName === "hr") {
      return "\n\n---\n\n";
    }

    const content = markdownChildren(node, state);
    if (BLOCK_TAGS.has(tagName)) {
      const normalized = normalizeMarkdown(content);
      return normalized ? `\n\n${normalized}\n\n` : "";
    }

    return content;
  }

  function articleHtmlToMarkdown(html, fallbackText) {
    const parser = new DOMParser();
    const parsedDocument = parser.parseFromString(`<main>${html || ""}</main>`, "text/html");
    const markdown = normalizeMarkdown(markdownNode(parsedDocument.body));
    return markdown || normalizeTextBlock(fallbackText);
  }

  function extractWithReadability() {
    if (typeof Readability !== "function") {
      return null;
    }

    const documentClone = document.cloneNode(true);
    const article = new Readability(documentClone, {
      charThreshold: ARTICLE_MIN_CHARS
    }).parse();

    if (!article) {
      return null;
    }

    const content = articleHtmlToMarkdown(article.content, article.textContent);
    if (content.length < ARTICLE_MIN_CHARS) {
      return null;
    }

    return {
      content,
      title: sanitizeTitle(article.title || document.title),
      source: normalizeInlineText(article.siteName || article.byline || getDefaultSource()),
      excerpt: normalizeTextBlock(article.excerpt || ""),
      extractionMethod: "readability"
    };
  }

  function getLinkDensity(element, textLength) {
    const links = Array.from(element.querySelectorAll("a"));
    const linkTextLength = links.reduce((sum, link) => sum + normalizeInlineText(link.textContent || "").length, 0);
    return textLength ? linkTextLength / textLength : 0;
  }

  function scoreFallbackCandidate(element) {
    const tagName = element.tagName.toLowerCase();
    if (["nav", "header", "footer", "aside"].includes(tagName)) {
      return -1;
    }

    const text = normalizeTextBlock(element.innerText || element.textContent || "");
    if (text.length < ARTICLE_MIN_CHARS) {
      return -1;
    }

    const paragraphs = element.querySelectorAll("p").length;
    const headings = element.querySelectorAll("h1,h2,h3").length;
    const linkDensity = getLinkDensity(element, text.length);
    const roleBoost = element.matches("article, main, [role='main']") ? 500 : 0;
    const classBoost = /(article|content|post|entry|story|body|main)/i.test(`${element.id} ${element.className}`) ? 180 : 0;

    return text.length + paragraphs * 120 + headings * 80 + roleBoost + classBoost - linkDensity * text.length * 1.4;
  }

  function extractWithFallback() {
    const candidates = Array.from(
      document.querySelectorAll(
        "article, main, [role='main'], .article, .article-content, .entry-content, .post-content, .story-body, #article, #content, section"
      )
    );

    if (!candidates.length && document.body) {
      candidates.push(document.body);
    }

    const best = candidates
      .map((element) => ({
        element,
        score: scoreFallbackCandidate(element)
      }))
      .sort((a, b) => b.score - a.score)[0];

    if (!best || best.score < 0) {
      return null;
    }

    const content = normalizeTextBlock(best.element.innerText || best.element.textContent || "");
    if (content.length < ARTICLE_MIN_CHARS) {
      return null;
    }

    return {
      content,
      title: sanitizeTitle(document.querySelector("h1")?.textContent || document.title),
      source: getDefaultSource(),
      excerpt: content.slice(0, 280),
      extractionMethod: "fallback"
    };
  }

  function extractArticleDraft() {
    const extracted = extractWithReadability() || extractWithFallback();
    if (!extracted) {
      throw new Error("Could not find a readable article section on this page.");
    }

    return {
      ...extracted,
      url: getPageUrl(),
      sourceType: "Article",
      contentType: "article"
    };
  }

  function getSelectedText(fallback) {
    return normalizeTextBlock(fallback || window.getSelection()?.toString() || "");
  }

  function extractSelectionDraft(selectionText) {
    const content = getSelectedText(selectionText);
    if (!content) {
      throw new Error("Select text on the page before using Save selected text.");
    }

    const pageTitle = sanitizeTitle(document.title, "Selected text");

    return {
      title: sanitizeTitle(`Selection: ${pageTitle}`),
      source: getDefaultSource(),
      url: getPageUrl(),
      content,
      sourceType: "Selection",
      contentType: "selection",
      excerpt: content.slice(0, 280),
      extractionMethod: "selection"
    };
  }

  function buildDraft(message) {
    const draft = message.captureMode === "selection" ? extractSelectionDraft(message.selectionText) : extractArticleDraft();

    return {
      ...draft,
      capturedAt: new Date().toISOString(),
      externalId: buildCaptureExternalId(draft.contentType, draft.url, draft.content)
    };
  }

  function clearOverlay() {
    document.getElementById(OVERLAY_ID)?.remove();
  }

  function createSvgIcon(pathMarkup) {
    const span = document.createElement("span");
    span.className = "kg-preview-icon";
    span.setAttribute("aria-hidden", "true");
    span.innerHTML = `<svg viewBox="0 0 24 24">${pathMarkup}</svg>`;
    return span;
  }

  function createField(labelText, input) {
    const label = document.createElement("label");
    label.className = "kg-field";

    const text = document.createElement("span");
    text.className = "kg-field__label";
    text.textContent = labelText;

    label.append(text, input);
    return label;
  }

  function buildStyles() {
    return `
      :host {
        all: initial;
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        letter-spacing: 0;
      }

      * {
        box-sizing: border-box;
      }

      .kg-shell {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        display: grid;
        place-items: center;
        padding: 24px;
        background: rgba(15, 23, 42, 0.42);
        backdrop-filter: blur(10px);
      }

      .kg-panel {
        width: min(900px, calc(100vw - 32px));
        max-height: min(820px, calc(100vh - 32px));
        display: grid;
        grid-template-rows: auto 1fr auto;
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.14);
        border-radius: 8px;
        background: #fbfcfe;
        box-shadow: 0 28px 90px rgba(15, 23, 42, 0.28);
      }

      .kg-header,
      .kg-footer {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 18px;
        background: #ffffff;
      }

      .kg-header {
        border-bottom: 1px solid #e5e7eb;
      }

      .kg-title-wrap {
        min-width: 0;
        flex: 1;
      }

      .kg-title {
        margin: 0;
        color: #101828;
        font-size: 17px;
        line-height: 1.25;
        font-weight: 720;
      }

      .kg-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 5px;
        color: #667085;
        font-size: 12px;
        line-height: 1.35;
      }

      .kg-pill {
        display: inline-flex;
        align-items: center;
        min-height: 22px;
        padding: 2px 7px;
        border: 1px solid #d0d5dd;
        border-radius: 6px;
        background: #f8fafc;
        color: #344054;
      }

      .kg-icon-badge {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        flex: none;
        border: 1px solid #b6d7d2;
        border-radius: 8px;
        color: #0f766e;
        background: #effaf8;
      }

      .kg-preview-icon,
      .kg-preview-icon svg {
        display: block;
        width: 20px;
        height: 20px;
      }

      .kg-preview-icon svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .kg-body {
        min-height: 0;
        overflow: auto;
        padding: 18px;
      }

      .kg-fields {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
        gap: 12px;
        margin-bottom: 12px;
      }

      .kg-field {
        display: grid;
        gap: 6px;
      }

      .kg-field__label {
        color: #475467;
        font-size: 12px;
        line-height: 1.3;
        font-weight: 650;
      }

      .kg-input,
      .kg-textarea {
        width: 100%;
        border: 1px solid #d0d5dd;
        border-radius: 6px;
        background: #ffffff;
        color: #101828;
        font: inherit;
        font-size: 14px;
        line-height: 1.45;
        outline: none;
        transition:
          border-color 140ms ease,
          box-shadow 140ms ease;
      }

      .kg-input {
        min-height: 38px;
        padding: 8px 10px;
      }

      .kg-textarea {
        min-height: min(52vh, 520px);
        resize: vertical;
        padding: 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        white-space: pre-wrap;
      }

      .kg-input:focus,
      .kg-textarea:focus {
        border-color: #0f766e;
        box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.14);
      }

      .kg-url {
        margin: 0 0 12px;
        overflow: hidden;
        color: #667085;
        font-size: 12px;
        line-height: 1.45;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .kg-footer {
        justify-content: flex-end;
        border-top: 1px solid #e5e7eb;
      }

      .kg-status {
        min-width: 0;
        flex: 1;
        color: #667085;
        font-size: 13px;
        line-height: 1.35;
      }

      .kg-status[data-tone="error"] {
        color: #b42318;
      }

      .kg-status[data-tone="success"] {
        color: #067647;
      }

      .kg-button {
        min-height: 38px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        border: 1px solid #d0d5dd;
        border-radius: 6px;
        padding: 8px 12px;
        background: #ffffff;
        color: #344054;
        cursor: pointer;
        font: inherit;
        font-size: 13px;
        line-height: 1;
        font-weight: 680;
      }

      .kg-button:hover:not(:disabled) {
        background: #f8fafc;
      }

      .kg-button:focus-visible {
        outline: 2px solid rgba(20, 184, 166, 0.44);
        outline-offset: 2px;
      }

      .kg-button:disabled {
        cursor: progress;
        opacity: 0.72;
      }

      .kg-button--primary {
        border-color: #0f766e;
        background: #0f766e;
        color: #ffffff;
      }

      .kg-button--primary:hover:not(:disabled) {
        background: #115e59;
      }

      .kg-error {
        padding: 20px;
        color: #344054;
        font-size: 14px;
        line-height: 1.5;
      }

      @media (max-width: 720px) {
        .kg-shell {
          padding: 12px;
          align-items: end;
        }

        .kg-panel {
          width: 100%;
          max-height: calc(100vh - 24px);
        }

        .kg-fields {
          grid-template-columns: 1fr;
        }

        .kg-header,
        .kg-footer {
          padding: 14px;
        }

        .kg-footer {
          flex-wrap: wrap;
        }

        .kg-status {
          flex-basis: 100%;
          order: -1;
        }
      }
    `;
  }

  function createPreviewOverlay(draft) {
    clearOverlay();

    const host = document.createElement("div");
    host.id = OVERLAY_ID;
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = buildStyles();

    const shell = document.createElement("div");
    shell.className = "kg-shell";

    const panel = document.createElement("section");
    panel.className = "kg-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "kg-preview-title");

    const header = document.createElement("header");
    header.className = "kg-header";

    const badge = document.createElement("div");
    badge.className = "kg-icon-badge";
    badge.appendChild(
      createSvgIcon('<path d="M5 4h14v16H5z"></path><path d="M8 8h8"></path><path d="M8 12h8"></path><path d="M8 16h5"></path>')
    );

    const titleWrap = document.createElement("div");
    titleWrap.className = "kg-title-wrap";

    const heading = document.createElement("h2");
    heading.className = "kg-title";
    heading.id = "kg-preview-title";
    heading.textContent = draft.contentType === "selection" ? "Review selected text" : "Review page capture";

    const meta = document.createElement("div");
    meta.className = "kg-meta";

    const typePill = document.createElement("span");
    typePill.className = "kg-pill";
    typePill.textContent = draft.sourceType;

    const wordPill = document.createElement("span");
    wordPill.className = "kg-pill";
    wordPill.textContent = `${getWordCount(draft.content)} words`;

    const methodPill = document.createElement("span");
    methodPill.className = "kg-pill";
    methodPill.textContent = draft.extractionMethod === "readability" ? "Reader" : draft.extractionMethod === "fallback" ? "Page section" : "Selection";

    meta.append(typePill, wordPill, methodPill);
    titleWrap.append(heading, meta);

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "kg-button";
    closeButton.setAttribute("aria-label", "Close preview");
    closeButton.appendChild(createSvgIcon('<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>'));
    closeButton.addEventListener("click", clearOverlay);

    header.append(badge, titleWrap, closeButton);

    const body = document.createElement("div");
    body.className = "kg-body";

    const titleInput = document.createElement("input");
    titleInput.className = "kg-input";
    titleInput.value = draft.title;

    const sourceInput = document.createElement("input");
    sourceInput.className = "kg-input";
    sourceInput.value = draft.source;

    const fields = document.createElement("div");
    fields.className = "kg-fields";
    fields.append(createField("Title", titleInput), createField("Source", sourceInput));

    const url = document.createElement("p");
    url.className = "kg-url";
    url.textContent = draft.url;

    const contentTextarea = document.createElement("textarea");
    contentTextarea.className = "kg-textarea";
    contentTextarea.spellcheck = true;
    contentTextarea.value = draft.content;
    contentTextarea.setAttribute("aria-label", "Capture content");

    body.append(fields, url, createField("Content", contentTextarea));

    const footer = document.createElement("footer");
    footer.className = "kg-footer";

    const status = document.createElement("div");
    status.className = "kg-status";
    status.textContent = "Ready to save.";

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className = "kg-button";
    cancelButton.textContent = "Cancel";
    cancelButton.addEventListener("click", clearOverlay);

    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "kg-button kg-button--primary";
    saveButton.textContent = "Save";
    let isSaving = false;
    let hasSaved = false;

    contentTextarea.addEventListener("input", () => {
      wordPill.textContent = `${getWordCount(contentTextarea.value)} words`;
      status.textContent = "Ready to save.";
      status.dataset.tone = "";
    });

    async function saveCapture() {
      if (isSaving || hasSaved) {
        return;
      }

      const payload = {
        title: sanitizeTitle(titleInput.value),
        source: normalizeInlineText(sourceInput.value) || getDefaultSource(),
        sourceType: draft.sourceType,
        externalId: buildCaptureExternalId(draft.contentType, draft.url, contentTextarea.value),
        url: draft.url,
        content: normalizeTextBlock(contentTextarea.value),
        contentType: draft.contentType,
        capturedAt: new Date().toISOString()
      };

      if (!payload.title || !payload.source || !payload.content) {
        status.textContent = "Title, source, and content are required.";
        status.dataset.tone = "error";
        return;
      }

      isSaving = true;
      saveButton.disabled = true;
      cancelButton.disabled = true;
      status.textContent = "Saving...";
      status.dataset.tone = "";

      try {
        const response = await chrome.runtime.sendMessage({
          type: "SAVE_WEB_CAPTURE",
          payload
        });

        if (!response?.ok) {
          throw new Error(response?.error || "Unknown save error.");
        }

        if (response.data.action === "skipped") {
          status.textContent = response.data.reason || "Skipped.";
          status.dataset.tone = "error";
          saveButton.disabled = false;
          cancelButton.disabled = false;
          return;
        }

        status.textContent =
          response.data.storageDestination === "localMarkdown"
            ? "Saved locally."
            : `Saved in Notion.`;
        status.dataset.tone = "success";
        saveButton.textContent = "Saved";
        hasSaved = true;
        window.setTimeout(clearOverlay, 800);
      } catch (error) {
        captureLog("save-error", error);
        status.textContent = error?.message || "Failed to save capture.";
        status.dataset.tone = "error";
        saveButton.disabled = false;
        cancelButton.disabled = false;
      } finally {
        isSaving = false;
      }
    }

    saveButton.addEventListener("click", saveCapture);
    footer.append(status, cancelButton, saveButton);

    panel.append(header, body, footer);
    shell.appendChild(panel);
    shadow.append(style, shell);
    document.documentElement.appendChild(host);

    shell.addEventListener("click", (event) => {
      if (event.target === shell) {
        clearOverlay();
      }
    });

    shadow.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        clearOverlay();
      }

      if (ENABLE_KEYBOARD_SAVE_SHORTCUT && (event.metaKey || event.ctrlKey) && event.key === "Enter") {
        saveCapture();
      }
    });

    window.setTimeout(() => contentTextarea.focus(), 0);
  }

  function createErrorOverlay(message) {
    clearOverlay();

    const host = document.createElement("div");
    host.id = OVERLAY_ID;
    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = buildStyles();

    const shell = document.createElement("div");
    shell.className = "kg-shell";

    const panel = document.createElement("section");
    panel.className = "kg-panel";
    panel.setAttribute("role", "alertdialog");
    panel.setAttribute("aria-modal", "true");

    const header = document.createElement("header");
    header.className = "kg-header";

    const badge = document.createElement("div");
    badge.className = "kg-icon-badge";
    badge.appendChild(createSvgIcon('<path d="M12 9v4"></path><path d="M12 17h.01"></path><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>'));

    const titleWrap = document.createElement("div");
    titleWrap.className = "kg-title-wrap";

    const heading = document.createElement("h2");
    heading.className = "kg-title";
    heading.textContent = "Capture failed";
    titleWrap.appendChild(heading);

    header.append(badge, titleWrap);

    const body = document.createElement("div");
    body.className = "kg-error";
    body.textContent = message;

    const footer = document.createElement("footer");
    footer.className = "kg-footer";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "kg-button kg-button--primary";
    closeButton.textContent = "Close";
    closeButton.addEventListener("click", clearOverlay);
    footer.appendChild(closeButton);

    panel.append(header, body, footer);
    shell.appendChild(panel);
    shadow.append(style, shell);
    document.documentElement.appendChild(host);
    window.setTimeout(() => closeButton.focus(), 0);
  }

  async function openPreview(message) {
    try {
      const draft = buildDraft(message || {});
      createPreviewOverlay(draft);
      captureLog("preview-opened", {
        mode: draft.contentType,
        title: draft.title,
        source: draft.source,
        words: getWordCount(draft.content),
        extractionMethod: draft.extractionMethod
      });
    } catch (error) {
      captureLog("preview-error", error);
      createErrorOverlay(error?.message || "Could not prepare capture preview.");
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== "KG_WEB_CAPTURE_OPEN_PREVIEW") {
      return false;
    }

    openPreview(message)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error?.message || "Could not open capture preview."
        });
      });

    return true;
  });

  globalThis.KnowledgeGptWebCapture = {
    initialized: true,
    openPreview
  };
})();
