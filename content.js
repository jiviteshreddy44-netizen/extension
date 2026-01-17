
/**
 * fakey.ai Content Script
 * Scans DOM for visible media elements
 */

console.log('fakey.ai active in current tab.');

// Listen for specific commands if the popup wants to highlight an element
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_media_info") {
    const images = document.getElementsByTagName('img');
    const videos = document.getElementsByTagName('video');
    const canvases = document.getElementsByTagName('canvas');
    
    sendResponse({
      images: images.length,
      videos: videos.length,
      canvases: canvases.length,
      url: window.location.href
    });
  }
});
