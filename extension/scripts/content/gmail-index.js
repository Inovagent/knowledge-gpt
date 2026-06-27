let gmailMountObserver = null;
let gmailMountTimeout = null;

function scheduleGmailMount() {
  if (gmailMountTimeout) {
    window.clearTimeout(gmailMountTimeout);
  }

  gmailMountTimeout = window.setTimeout(() => {
    mountEmailButtons();
  }, 150);
}

function startGmailObservers() {
  if (gmailMountObserver) {
    gmailMountObserver.disconnect();
  }

  gmailMountObserver = new MutationObserver(() => {
    scheduleGmailMount();
  });

  gmailMountObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
}

startGmailObservers();
scheduleGmailMount();
gmailLog("content-script:gmail-ready");
