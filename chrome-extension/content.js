// Content script for Import to Markdown extension
// This bridges between chrome.storage (extension context) and the page (web context)

console.log('Import to Markdown content script loaded');

// Listen for import requests from the page
window.addEventListener('message', async (event) => {
  // Only handle messages from the same window
  if (event.source !== window) return;
  
  if (event.data.type === 'REQUEST_IMPORT') {
    const docId = event.data.docId;
    console.log('Content script: Received import request for', docId);
    
    try {
      // Content scripts CAN access chrome.storage
      const key = `import_${docId}`;
      const result = await chrome.storage.local.get(key);
      
      if (result[key]) {
        console.log('Content script: Found import data, sending to page');
        
        // Send data back to the page
        window.postMessage({
          type: 'IMPORT_MARKDOWN',
          docId: docId,
          markdown: result[key].markdown,
          sourceUrl: result[key].sourceUrl,
          sourceTitle: result[key].sourceTitle,
        }, '*');
        
        // Clean up storage
        await chrome.storage.local.remove(key);
        console.log('Content script: Import data sent and cleaned up');
      } else {
        console.log('Content script: No import data found for', docId);
      }
    } catch (error) {
      console.error('Content script: Error retrieving import data:', error);
    }
  }
});

