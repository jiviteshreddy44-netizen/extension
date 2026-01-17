
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capture_tab") {
    // captureVisibleTab works because the popup is active and has permissions
    chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 80 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ dataUrl: dataUrl });
      }
    });
    return true; // async
  }
});
