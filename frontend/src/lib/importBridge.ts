/**
 * Import Bridge
 * 
 * Handles communication between the Chrome extension and the Markdoc app
 * to import markdown content from webpages.
 */

export interface ImportData {
  markdown: string;
  timestamp: number;
  sourceUrl?: string;
  sourceTitle?: string;
}

/**
 * Initialize the import bridge to handle Chrome extension imports
 * The content script will handle chrome.storage access and forward data via postMessage
 */
export function initImportBridge() {
  console.log('📥 Import bridge initialized');
  // Note: The actual chrome.storage access happens in the content script
  // This just sets up message listeners
}

/**
 * Request import data for a specific document ID
 * Call this when you want to check if there's pending import data
 */
export function requestImport(docId: string) {
  window.postMessage({
    type: 'REQUEST_IMPORT',
    docId,
  }, '*');
}

/**
 * Listen for import markdown events
 * Returns a cleanup function to remove the listener
 */
export function onImportMarkdown(
  docId: string,
  callback: (markdown: string, sourceUrl?: string, sourceTitle?: string) => void
): () => void {
  const handleMessage = (event: MessageEvent) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'IMPORT_MARKDOWN' && event.data.docId === docId) {
      callback(event.data.markdown, event.data.sourceUrl, event.data.sourceTitle);
    }
  };
  
  window.addEventListener('message', handleMessage);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('message', handleMessage);
  };
}

