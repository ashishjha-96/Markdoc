/**
 * Floating Chat State Management
 *
 * Utilities for persisting floating chat window state in localStorage.
 * Handles position validation, off-screen detection, and state persistence.
 * Also stores minimized state per-user (local, not synced).
 */

export interface FloatingChatState {
  isFloating: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
  isMinimized?: boolean; // Local minimized state (not synced)
}

const STORAGE_KEY = "markdoc-floating-chats";
const MINIMIZED_STORAGE_KEY = "markdoc-minimized-blocks";

/**
 * Load floating state for a specific chat from localStorage
 * Validates position to ensure it's within viewport bounds
 */
export function loadFloatingState(chatId: string): FloatingChatState | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const allStates: Record<string, FloatingChatState> = JSON.parse(stored);
    const state = allStates[chatId];

    if (!state) return null;

    // Validate position is within viewport
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Check if position is completely off-screen
    // Allow some tolerance for partially off-screen windows
    if (state.x < -state.width + 50 || state.x > viewportWidth - 50 ||
        state.y < -50 || state.y > viewportHeight - 50) {
      // Return centered default position with saved dimensions
      return {
        ...state,
        x: (viewportWidth - state.width) / 2,
        y: (viewportHeight - state.height) / 2,
      };
    }

    return state;
  } catch (error) {
    console.error("Error loading floating state:", error);
    return null;
  }
}

/**
 * Save floating state for a specific chat to localStorage
 */
export function saveFloatingState(chatId: string, state: FloatingChatState): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const allStates: Record<string, FloatingChatState> = stored ? JSON.parse(stored) : {};

    allStates[chatId] = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allStates));
  } catch (error) {
    console.error("Error saving floating state:", error);
  }
}

/**
 * Remove floating state for a specific chat from localStorage
 */
export function clearFloatingState(chatId: string): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return;

    const allStates: Record<string, FloatingChatState> = JSON.parse(stored);
    delete allStates[chatId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allStates));
  } catch (error) {
    console.error("Error clearing floating state:", error);
  }
}

/**
 * Calculate default centered position for a floating window
 */
export function getDefaultFloatingPosition(width: number, height: number): { x: number; y: number } {
  return {
    x: Math.max(0, (window.innerWidth - width) / 2),
    y: Math.max(0, (window.innerHeight - height) / 2),
  };
}

/**
 * Load minimized state for a specific block from localStorage
 * This is stored separately and locally per-user (not synced)
 */
export function loadMinimizedState(blockId: string): boolean {
  try {
    const stored = localStorage.getItem(MINIMIZED_STORAGE_KEY);
    if (!stored) return false;

    const allStates: Record<string, boolean> = JSON.parse(stored);
    return allStates[blockId] || false;
  } catch (error) {
    console.error("Error loading minimized state:", error);
    return false;
  }
}

/**
 * Save minimized state for a specific block to localStorage
 * This is stored separately and locally per-user (not synced)
 */
export function saveMinimizedState(blockId: string, isMinimized: boolean): void {
  try {
    const stored = localStorage.getItem(MINIMIZED_STORAGE_KEY);
    const allStates: Record<string, boolean> = stored ? JSON.parse(stored) : {};

    if (isMinimized) {
      allStates[blockId] = true;
    } else {
      delete allStates[blockId]; // Remove entry when expanded
    }

    localStorage.setItem(MINIMIZED_STORAGE_KEY, JSON.stringify(allStates));
  } catch (error) {
    console.error("Error saving minimized state:", error);
  }
}

/**
 * Clear minimized state for a specific block from localStorage
 */
export function clearMinimizedState(blockId: string): void {
  try {
    const stored = localStorage.getItem(MINIMIZED_STORAGE_KEY);
    if (!stored) return;

    const allStates: Record<string, boolean> = JSON.parse(stored);
    delete allStates[blockId];
    localStorage.setItem(MINIMIZED_STORAGE_KEY, JSON.stringify(allStates));
  } catch (error) {
    console.error("Error clearing minimized state:", error);
  }
}
