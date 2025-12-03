import { nanoid } from "nanoid";

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
