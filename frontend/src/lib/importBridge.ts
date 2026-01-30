/**
 * Import Bridge
 *
 * Handles communication between external sources (Chrome extension, VSCode extension)
 * and the Markdoc app to import markdown content.
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
 * Fetch pending import from the API (used by VSCode extension flow)
 * This is a one-time read - the content is deleted after retrieval.
 * Returns the markdown content if found, null otherwise.
 */
export async function fetchPendingImport(docId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/import/${docId}`);
    if (!res.ok) {
      if (res.status === 404) {
        console.log('📥 No pending import found for:', docId);
        return null;
      }
      console.error('📥 Failed to fetch pending import:', res.status);
      return null;
    }
    const data = await res.json();
    console.log('📥 Fetched pending import:', { docId, length: data.markdown?.length });
    return data.markdown || null;
  } catch (error) {
    console.error('📥 Error fetching pending import:', error);
    return null;
  }
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

