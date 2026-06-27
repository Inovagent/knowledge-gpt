function setEmailButtonState(button, state, detail) {
  if (!button) {
    return;
  }

  const stateLabelMap = {
    idle: "Save email content",
    loading: "Saving email content",
    saved: "Email content saved",
    error: "Save failed",
    skipped: "Skipped"
  };

  button.dataset.state = state;
  button.innerHTML = `
    <div class="asa">
      <div class="kg-email-save-button__icon-shell">
        ${GMAIL_ICONS[state] || GMAIL_ICONS.idle}
      </div>
    </div>
    <div class="G-asx T-I-J3 J-J5-Ji">&nbsp;</div>
  `;

  const label = detail || stateLabelMap[state] || "Save email content";
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.setAttribute("data-tooltip", label);
  button.setAttribute("aria-disabled", state === "loading" ? "true" : "false");

  gmailLog("button-state", { state, detail: detail || "", emailId: button.dataset.emailId || "" });
}

async function syncEmailButtonState(button, messageRoot) {
  const emailId = getMessageExternalId(messageRoot);
  button.dataset.emailId = emailId;

  const processed = await isEmailProcessed(emailId);
  if (processed) {
    setEmailButtonState(button, "saved", "Email content already saved for this message.");
    return;
  }

  setEmailButtonState(button, "idle", "Save email content");
}

async function saveEmailContent(button, messageRoot) {
  gmailLog("save-email:clicked");

  if (!button || button.dataset.state === "loading") {
    gmailLog("save-email:ignored-already-saving");
    return;
  }

  const title = getThreadSubject();
  const source = getMessageSource(messageRoot);
  const content = getMessageContent(messageRoot);
  const externalId = getMessageExternalId(messageRoot);

  if (!title) {
    setEmailButtonState(button, "error", "Could not find the Gmail subject.");
    return;
  }

  if (!content) {
    setEmailButtonState(button, "error", "Could not extract the email body.");
    return;
  }

  setEmailButtonState(button, "loading");

  try {
    const payload = {
      title,
      source,
      sourceType: "Newsletter",
      externalId,
      url: window.location.href,
      content,
      contentType: "email",
      capturedAt: new Date().toISOString()
    };

    gmailLog("save-email:payload-ready", {
      title: payload.title,
      source: payload.source,
      externalId: payload.externalId,
      contentLength: payload.content.length
    });

    const response = await chrome.runtime.sendMessage({
      type: "SAVE_EMAIL_CONTENT",
      payload
    });

    gmailLog("save-email:background-response", response);

    if (!response?.ok) {
      throw new Error(response?.error || "Unknown save error.");
    }

    if (response.data.action === "skipped") {
      setEmailButtonState(button, "skipped", response.data.reason || "Skipped because the entry is no longer To Process.");
      return;
    }

    await markEmailProcessed(externalId, {
      title: payload.title,
      source: payload.source
    });
    setEmailButtonState(button, "saved", `Email ${response.data.action} in Notion.`);
  } catch (error) {
    gmailLog("save-email:error", error);
    setEmailButtonState(button, "error", error?.message || "Failed to save email content.");
  }
}

function createEmailButton() {
  const button = document.createElement("button");
  button.className = `T-I J-J5-Ji nf T-I-ax7 L3 ${GMAIL_SAVE_BUTTON_CLASS}`;
  button.type = "button";

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    const actionBar = button.parentElement;
    const messageRoot = findMessageRootFromActionBar(actionBar);
    saveEmailContent(button, messageRoot);
  });

  setEmailButtonState(button, "idle", "Save email content");
  return button;
}

function removeDetachedEmailButtons() {
  document.querySelectorAll(GMAIL_SAVE_BUTTON_SELECTOR).forEach((button) => {
    const actionBar = button.parentElement;
    const messageRoot = findMessageRootFromActionBar(actionBar);

    if (!isOpenEmailView() || !actionBar || !messageRoot || !isVisibleElement(messageRoot) || !getMessageBodyNode(messageRoot)) {
      button.remove();
    }
  });
}

async function mountEmailButtons() {
  removeDetachedEmailButtons();

  if (!isGmailPage()) {
    return;
  }

  const actionBars = findMessageActionBars();
  if (!actionBars.length) {
    return;
  }

  for (const actionBar of actionBars) {
    const moreButton = findMoreButton(actionBar);
    if (!moreButton) {
      continue;
    }

    if (actionBar.querySelector(GMAIL_SAVE_BUTTON_SELECTOR)) {
      continue;
    }

    const messageRoot = findMessageRootFromActionBar(actionBar);
    if (!messageRoot) {
      continue;
    }

    const button = createEmailButton();
    actionBar.insertBefore(button, moreButton);
    await syncEmailButtonState(button, messageRoot);
  }
}
