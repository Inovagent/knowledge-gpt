function log(...args) {
  console.log("[YT Transcript]", ...args);
}

function isWatchPage() {
  return window.location.pathname === WATCH_PATH && new URL(window.location.href).searchParams.has("v");
}

function getVideoId() {
  return new URL(window.location.href).searchParams.get("v") || "";
}

function getVideoTitle() {
  const selectors = [
    "ytd-watch-metadata h1 yt-formatted-string",
    "h1.ytd-watch-metadata yt-formatted-string",
    "h1.title yt-formatted-string"
  ];

  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return document.title.replace(/\s*-\s*YouTube$/, "").trim();
}

function getChannelName() {
  const selectors = [
    "ytd-watch-metadata ytd-channel-name a",
    "#owner #channel-name a",
    "ytd-video-owner-renderer #channel-name a"
  ];

  for (const selector of selectors) {
    const text = document.querySelector(selector)?.textContent?.trim();
    if (text) {
      return text;
    }
  }

  return "Unknown channel";
}

function findActionBar() {
  const selectors = [
    "#above-the-fold #top-level-buttons-computed",
    "ytd-watch-metadata #top-level-buttons-computed",
    "#menu ytd-menu-renderer #top-level-buttons-computed"
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }

  return null;
}
