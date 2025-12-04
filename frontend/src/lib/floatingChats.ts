/**
 * Floating Chat State Management
 *
 * Utilities for persisting floating chat window state in localStorage.
 * Handles position validation, off-screen detection, and state persistence.
 */

export interface FloatingChatState {
  isFloating: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex?: number;
}

const STORAGE_KEY = "markdoc-floating-chats";

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
