/**
 * SCMDB Utility Functions
 *
 * Provides URL parsing and validation for SCMDB mission links.
 * Designed to be reusable for future external catalog integrations (SC Craft, RSI, etc.).
 *
 * Format Support:
 * - https://scmdb.net/en/contracts/{ID}
 * - https://scmdb.net/contracts/{ID}
 * - Bare ID (alphanumeric)
 */

/**
 * Extract mission ID from SCMDB URL or return input if it's already an ID.
 *
 * Examples:
 * - 'https://scmdb.net/en/contracts/ABC123' → 'ABC123'
 * - 'https://scmdb.net/contracts/XYZ789' → 'XYZ789'
 * - 'ABC123' → 'ABC123'
 * - 'invalid-url' → null
 *
 * @param input URL or ID string
 * @returns Extracted mission ID or null if parsing fails
 */
export function parseScmdbMissionUrl(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Try to match SCMDB URL pattern
  // Supports: https://scmdb.net/[locale/]contracts/{ID}
  const urlPattern = /^https?:\/\/scmdb\.net(?:\/[a-z]{2})?\/contracts\/([a-zA-Z0-9_-]+)$/i;
  const urlMatch = trimmed.match(urlPattern);

  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  // Check if input is a bare ID (alphanumeric with optional hyphens/underscores)
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 0) {
    return trimmed;
  }

  // Invalid format
  return null;
}

/**
 * Validate if a string is a valid SCMDB URL or ID.
 *
 * @param input URL or ID string
 * @returns true if valid, false otherwise
 */
export function isValidScmdbUrl(input: string): boolean {
  return parseScmdbMissionUrl(input) !== null;
}

/**
 * Normalize a SCMDB mission identifier to a standard URL format.
 *
 * @param id Mission ID or URL
 * @returns Normalized URL string or null if invalid
 */
export function normalizeScmdbUrl(id: string): string | null {
  const missionId = parseScmdbMissionUrl(id);
  if (!missionId) {
    return null;
  }
  return `https://scmdb.net/contracts/${missionId}`;
}
