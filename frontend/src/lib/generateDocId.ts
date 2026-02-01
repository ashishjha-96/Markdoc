import { nanoid } from "nanoid";

/**
 * Valid doc ID pattern: 21 characters, URL-safe (A-Za-z0-9_-)
 * This matches the nanoid default output format.
 */
const DOC_ID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

/**
 * Generates a unique document ID using nanoid.
 *
 * Format: URL-safe alphanumeric characters (A-Za-z0-9_-)
 * Length: 21 characters (default nanoid length)
 * Collision probability: ~1 million years needed to have 1% probability of collision
 *
 * Example output: "V1StGXR8_Z5jdHi6B-myT"
 */
export function generateDocId(): string {
  return nanoid();
}

/**
 * Validates if a string is a valid document ID.
 *
 * Valid IDs must:
 * - Be exactly 21 characters long
 * - Only contain URL-safe characters (A-Za-z0-9_-)
 *
 * @param id - The string to validate
 * @returns true if valid, false otherwise
 */
export function isValidDocId(id: string): boolean {
  return DOC_ID_PATTERN.test(id);
}
