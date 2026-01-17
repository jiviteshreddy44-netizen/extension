
/**
 * fakey.ai Service Worker
 * Handles tab captures and communication with the popup
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('fakey.ai installed.');
});

// Listener for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "capture_tab") {
    // Note: captureVisibleTab requires the 'activeTab' permission 
    // and is triggered when the popup is open.
    chrome.tabs.captureVisibleTab(null, {format: 'jpeg', quality: 80}, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({error: chrome.runtime.lastError.message});
      } else {
        sendResponse({dataUrl: dataUrl});
      }
    });
    return true; // Keep message channel open for async response
  }
});
