// Background service worker for Import to Markdown extension
'use strict';

// Simple logger with levels and timestamp
const Logger = {
  PREFIX: '[Import-MD:BG]',
  _format: (level, args) => {
    const timestamp = new Date().toISOString();
    return [`${Logger.PREFIX} [${timestamp}] [${level}]`, ...args];
  },
  debug: (...args) => console.debug(...Logger._format('DEBUG', args)),
  info: (...args) => console.info(...Logger._format('INFO', args)),
  warn: (...args) => console.warn(...Logger._format('WARN', args)),
  error: (...args) => console.error(...Logger._format('ERROR', args)),
};

const ALARM_NAME = 'cleanup-old-imports';
const CLEANUP_INTERVAL_MINUTES = 60; // 1 hour
const MAX_IMPORT_AGE_MS = 60 * 60 * 1000; // 1 hour

Logger.info('Import to Markdown extension loaded');

// Set up alarm when extension starts
chrome.runtime.onStartup.addListener(() => {
  Logger.info('Extension startup detected');
  setupCleanupAlarm();
  cleanupOldImports();
});

chrome.runtime.onInstalled.addListener((details) => {
  Logger.info('Extension installed/updated', { reason: details.reason });
  setupCleanupAlarm();
  cleanupOldImports();
});

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  Logger.debug('Alarm triggered:', alarm.name);
  if (alarm.name === ALARM_NAME) {
    cleanupOldImports();
  }
});

// Set up periodic cleanup alarm using Chrome Alarms API
async function setupCleanupAlarm() {
  try {
    // Check if alarm already exists
    const existingAlarm = await chrome.alarms.get(ALARM_NAME);

    if (existingAlarm) {
      Logger.debug('Cleanup alarm already exists, next trigger:', new Date(existingAlarm.scheduledTime));
      return;
    }

    // Create new alarm - periodInMinutes for recurring
    await chrome.alarms.create(ALARM_NAME, {
      delayInMinutes: 1, // First run after 1 minute
      periodInMinutes: CLEANUP_INTERVAL_MINUTES,
    });

    Logger.info(`Cleanup alarm created, will run every ${CLEANUP_INTERVAL_MINUTES} minutes`);
  } catch (error) {
    Logger.error('Failed to create cleanup alarm:', error.message, error.stack);
  }
}

// Clean up old import data (older than MAX_IMPORT_AGE_MS)
async function cleanupOldImports() {
  try {
    Logger.debug('Starting cleanup of old imports...');

    const items = await chrome.storage.local.get(null);
    const now = Date.now();
    const keysToRemove = [];
    const importKeys = [];

    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith('import_')) {
        importKeys.push(key);

        if (value && value.timestamp) {
          const age = now - value.timestamp;
          if (age > MAX_IMPORT_AGE_MS) {
            keysToRemove.push(key);
            Logger.debug(`Marking for removal: ${key} (age: ${Math.round(age / 1000 / 60)} minutes)`);
          }
        } else {
          // Remove imports without valid timestamp
          keysToRemove.push(key);
          Logger.warn(`Marking for removal (no timestamp): ${key}`);
        }
      }
    }

    Logger.debug(`Found ${importKeys.length} total imports, ${keysToRemove.length} expired`);

    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      Logger.info(`Cleaned up ${keysToRemove.length} old imports`);
    } else {
      Logger.debug('No old imports to clean up');
    }
  } catch (error) {
    Logger.error('Failed to cleanup old imports:', error.message, error.stack);
  }
}

