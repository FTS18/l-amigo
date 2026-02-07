// Auto-reload extension when files change in development
if (process.env.NODE_ENV === "development") {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RELOAD_EXTENSION") {
      chrome.runtime.reload();
    }
  });
}
