window.addEventListener("yt-navigate-finish", handleNavigationChange);
window.addEventListener("yt-page-data-updated", handleNavigationChange);

startObservers();
mountButton();
handleNavigationChange();
log("content-script:ready");
