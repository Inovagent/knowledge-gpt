async function getProcessedEmails() {
  const stored = await chrome.storage.local.get(GMAIL_PROCESSED_EMAILS_KEY);
  return stored[GMAIL_PROCESSED_EMAILS_KEY] || {};
}

async function markEmailProcessed(emailId, metadata = {}) {
  if (!emailId) {
    return;
  }

  const processedEmails = await getProcessedEmails();
  processedEmails[emailId] = {
    processedAt: new Date().toISOString(),
    ...metadata
  };

  await chrome.storage.local.set({
    [GMAIL_PROCESSED_EMAILS_KEY]: processedEmails
  });
}

async function isEmailProcessed(emailId) {
  if (!emailId) {
    return false;
  }

  const processedEmails = await getProcessedEmails();
  return Boolean(processedEmails[emailId]);
}
