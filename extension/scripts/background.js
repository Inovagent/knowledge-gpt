importScripts("../scripts/shared/settings.js", "../scripts/shared/backend-url.js");

function log(...args) {
  console.log("[Knowledge GPT BG]", ...args);
}

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return mergeSettings(stored);
}

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!["SAVE_TRANSCRIPT", "SAVE_EMAIL_CONTENT"].includes(message?.type)) {
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
        storageDestination: settings.storageDestination,
        backendUrl: settings.backendUrl,
        databaseIdPresent: Boolean(settings.databaseId),
        propertyMapping: settings.propertyMapping
      });

      if (!settings.storageDestination) {
        throw new Error("Choose a storage destination in the extension options before saving.");
      }

      const candidateBaseUrls = buildCandidateUrls(settings.backendUrl);

      if (!candidateBaseUrls.length) {
        throw new Error("Set a backend URL in the extension options.");
      }

      const requestPayload = {
        ...message.payload,
        storageDestination: settings.storageDestination
      };

      if (settings.storageDestination === "notion") {
        requestPayload.databaseId = settings.databaseId;
        requestPayload.propertyMapping = settings.propertyMapping;
      }

      const requestBody = JSON.stringify(requestPayload);
      const endpoint = message.type === "SAVE_EMAIL_CONTENT" ? "/save-content" : "/save-transcript";

      let response;
      let data = {};
      let lastFetchError;

      for (const baseUrl of candidateBaseUrls) {
        const requestUrl = `${baseUrl}${endpoint}`;
        log("request-start", {
          requestUrl,
          storageDestination: settings.storageDestination,
          databaseIdPresent: Boolean(settings.databaseId),
          externalId: message.payload?.externalId || message.payload?.videoId,
          title: message.payload?.title,
          sourceType: message.payload?.sourceType,
          contentType: message.payload?.contentType
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
