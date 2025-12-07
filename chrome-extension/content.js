// Content script for Import to Markdown extension
// This bridges between chrome.storage (extension context) and the page (web context)
'use strict';

// Simple logger with levels
const Logger = {
  PREFIX: '[Import-MD:Content]',
  debug: (...args) => console.debug(Logger.PREFIX, ...args),
  info: (...args) => console.info(Logger.PREFIX, ...args),
  warn: (...args) => console.warn(Logger.PREFIX, ...args),
  error: (...args) => console.error(Logger.PREFIX, ...args),
};

Logger.info('Content script loaded on:', window.location.href);

// Listen for import requests from the page
window.addEventListener('message', async (event) => {
  // Only handle messages from the same window
  if (event.source !== window) return;

  // Only handle our specific message type
  if (event.data.type !== 'REQUEST_IMPORT') return;

  const docId = event.data.docId;
  Logger.info('Received import request for docId:', docId);

  try {
    // Validate docId
    if (!docId || typeof docId !== 'string') {
      Logger.error('Invalid docId received:', docId);
      return;
    }

    // Content scripts CAN access chrome.storage
    const key = `import_${docId}`;
    Logger.debug('Looking up storage key:', key);

    const result = await chrome.storage.local.get(key);

    if (result[key]) {
      Logger.info('Found import data, markdown length:', result[key].markdown?.length || 0);
      Logger.debug('Source URL:', result[key].sourceUrl);
      Logger.debug('Source title:', result[key].sourceTitle);

      // Validate data structure
      if (!result[key].markdown) {
        Logger.error('Import data missing markdown content');
        return;
      }

      // Send data back to the page
      window.postMessage({
        type: 'IMPORT_MARKDOWN',
        docId: docId,
        markdown: result[key].markdown,
        sourceUrl: result[key].sourceUrl,
        sourceTitle: result[key].sourceTitle,
      }, '*');

      Logger.debug('Import data sent to page');

      // Clean up storage
      try {
        await chrome.storage.local.remove(key);
        Logger.info('Import data cleaned up from storage');
      } catch (cleanupError) {
        Logger.warn('Failed to cleanup storage (non-critical):', cleanupError.message);
      }
    } else {
      Logger.warn('No import data found for docId:', docId);
      Logger.debug('Available keys in storage:', Object.keys(result));
    }
  } catch (error) {
    Logger.error('Error processing import request:', error.message);
    Logger.error('Stack trace:', error.stack);
  }
});

