function gmailLog(...args) {
  console.log("[KG Email]", ...args);
}

function isGmailPage() {
  return window.location.hostname === "mail.google.com";
}

function isVisibleElement(element) {
  return Boolean(element && element.isConnected && element.offsetParent !== null);
}

function isOpenEmailView() {
  if (!isVisibleElement(document.querySelector("h2.hP"))) {
    return false;
  }

  return Array.from(document.querySelectorAll(".adn.ads, .h7, [data-legacy-message-id], [data-message-id]")).some(
    (messageRoot) => {
      if (!isVisibleElement(messageRoot)) {
        return false;
      }

      return Boolean(getMessageBodyNode(messageRoot));
    }
  );
}

function findMessageActionBars() {
  if (!isOpenEmailView()) {
    return [];
  }

  return Array.from(document.querySelectorAll(".G-Ni.J-J5-Ji")).filter((actionBar) => {
    if (!isVisibleElement(actionBar) || !findMoreButton(actionBar)) {
      return false;
    }

    const messageRoot = findMessageRootFromActionBar(actionBar);
    if (!messageRoot || !isVisibleElement(messageRoot)) {
      return false;
    }

    return Boolean(getMessageBodyNode(messageRoot));
  });
}

function findMoreButton(actionBar) {
  if (!actionBar) {
    return null;
  }

  const selectors = [
    '[aria-label="More email options"]',
    '[data-tooltip="More"]',
    '[aria-label^="More"]'
  ];

  for (const selector of selectors) {
    const button = actionBar.querySelector(selector);
    if (button) {
      return button;
    }
  }

  return null;
}

function getThreadSubject() {
  const selectors = ["h2.hP", "[role='main'] h2"];

  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return document.title.replace(/\s*-\s*Gmail$/, "").trim();
}

function findMessageRootFromActionBar(actionBar) {
  const typedRoot = actionBar.closest(".adn.ads, .h7, [data-legacy-message-id], [data-message-id]");
  if (typedRoot) {
    return typedRoot;
  }

  let current = actionBar;
  while (current && current !== document.body) {
    if (current.querySelector(".a3s") && current.querySelector(".gD, .yP, [email][name]")) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function removeUnwantedEmailNodes(root) {
  const selectors = [
    "script",
    "style",
    "noscript",
    ".gmail_quote",
    ".gmail_signature",
    ".a6S",
    ".yj6qo",
    "button",
    "svg"
  ];

  root.querySelectorAll(selectors.join(",")).forEach((node) => node.remove());
}

function extractReadableText(node) {
  if (!node) {
    return "";
  }

  const clone = node.cloneNode(true);
  removeUnwantedEmailNodes(clone);

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-99999px";
  wrapper.style.top = "0";
  wrapper.style.width = `${Math.max(node.clientWidth || 640, 640)}px`;
  wrapper.style.pointerEvents = "none";
  wrapper.style.opacity = "0";
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  const text = clone.innerText || clone.textContent || "";
  wrapper.remove();

  return text
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function getMessageBodyNode(messageRoot) {
  if (!messageRoot) {
    return null;
  }

  const candidates = Array.from(messageRoot.querySelectorAll(".a3s")).filter((node) => node.offsetParent !== null);
  if (!candidates.length) {
    return null;
  }

  let bestNode = null;
  let bestLength = 0;

  for (const candidate of candidates) {
    const text = extractReadableText(candidate);
    if (text.length > bestLength) {
      bestNode = candidate;
      bestLength = text.length;
    }
  }

  return bestNode;
}

function getMessageContent(messageRoot) {
  const bodyNode = getMessageBodyNode(messageRoot);
  return extractReadableText(bodyNode);
}

function getMessageSource(messageRoot) {
  if (!messageRoot) {
    return "Unknown sender";
  }

  const selectors = [
    ".gD span",
    ".gD",
    "span[email][name] .gD span",
    "span[email][name]",
    ".yP"
  ];

  for (const selector of selectors) {
    const text = messageRoot.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return "Unknown sender";
}

function hashText(value) {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return `kg-${(hash >>> 0).toString(16)}`;
}

function getMessageExternalId(messageRoot) {
  const explicitId =
    messageRoot?.getAttribute("data-legacy-message-id") ||
    messageRoot?.getAttribute("data-message-id") ||
    messageRoot?.querySelector("[data-legacy-message-id]")?.getAttribute("data-legacy-message-id") ||
    messageRoot?.querySelector("[data-message-id]")?.getAttribute("data-message-id");

  if (explicitId) {
    return explicitId;
  }

  const fallback = [window.location.href, getThreadSubject(), getMessageSource(messageRoot), getMessageContent(messageRoot)]
    .filter(Boolean)
    .join("::");

  return hashText(fallback);
}
