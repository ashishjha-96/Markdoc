// Background service worker for Import to Markdown extension

console.log('Import to Markdown extension loaded');

// Clean up old import data (older than 1 hour)
chrome.runtime.onStartup.addListener(() => {
  cleanupOldImports();
});

chrome.runtime.onInstalled.addListener(() => {
  cleanupOldImports();
});

async function cleanupOldImports() {
  const items = await chrome.storage.local.get(null);
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  const keysToRemove = [];
  
  for (const [key, value] of Object.entries(items)) {
    if (key.startsWith('import_') && value.timestamp) {
      if (now - value.timestamp > oneHour) {
        keysToRemove.push(key);
      }
    }
  }
  
  if (keysToRemove.length > 0) {
    await chrome.storage.local.remove(keysToRemove);
    console.log(`Cleaned up ${keysToRemove.length} old imports`);
  }
}

// Clean up every hour
setInterval(cleanupOldImports, 60 * 60 * 1000);

