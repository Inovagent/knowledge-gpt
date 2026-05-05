importScripts("../scripts/shared/settings.js", "../scripts/shared/backend-url.js");

function log(...args) {
  console.log("[YT Transcript BG]", ...args);
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return mergeSettings(stored);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "SAVE_TRANSCRIPT") {
    return false;
  }

  (async () => {
    try {
      log("message-received", {
        tabId: sender?.tab?.id,
        url: sender?.tab?.url,
        hasPayload: Boolean(message.payload)
      });

      const settings = await getSettings();
      log("settings-loaded", {
        backendUrl: settings.backendUrl,
        databaseIdPresent: Boolean(settings.databaseId),
        propertyMapping: settings.propertyMapping
      });

      const candidateBaseUrls = buildCandidateUrls(settings.backendUrl);

      if (!candidateBaseUrls.length) {
        throw new Error("Set a backend URL in the extension options.");
      }

      const requestBody = JSON.stringify({
        ...message.payload,
        databaseId: settings.databaseId,
        propertyMapping: settings.propertyMapping
      });

      let response;
      let data = {};
      let lastFetchError;

      for (const baseUrl of candidateBaseUrls) {
        const requestUrl = `${baseUrl}/save-transcript`;
        log("request-start", {
          requestUrl,
          databaseIdPresent: Boolean(settings.databaseId),
          videoId: message.payload?.videoId,
          title: message.payload?.title
        });

        try {
          response = await fetch(requestUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: requestBody
          });

          data = await response.json().catch(() => ({}));
          log("request-finished", {
            status: response.status,
            ok: response.ok,
            data
          });
          break;
        } catch (error) {
          lastFetchError = error;
          log("request-fetch-failed", {
            requestUrl,
            error: error?.message || String(error)
          });
        }
      }

      if (!response) {
        throw new Error(
          `Failed to reach the local backend. Tried: ${candidateBaseUrls.join(", ")}. ` +
            `Make sure the server is running and the extension backend URL matches it. ` +
            `Last error: ${lastFetchError?.message || "Failed to fetch"}`
        );
      }

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error ||
            (Array.isArray(data.errors) ? data.errors.join(" ") : "") ||
            `Backend request failed with status ${response.status}.`
        );
      }

      sendResponse({
        ok: true,
        data
      });
    } catch (error) {
      log("request-error", error);
      sendResponse({
        ok: false,
        error: error?.message || "Unknown background error."
      });
    }
  })();

  return true;
});
