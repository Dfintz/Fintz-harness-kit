/**
 * URL Safety Utilities
 * Prevents open redirect and other URL-based vulnerabilities
 */

/**
 * Check if a URL is safe for external navigation
 * Only allows http/https protocols to prevent javascript: and data: URLs
 */
export function isSafeExternalUrl(rawUrl: string | null | undefined): rawUrl is string {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Check if a redirect path is safe for internal navigation
 * Must be a relative path starting with / and not containing protocol or //
 * Prevents open redirect attacks via sessionStorage or URL parameters
 *
 * @param path - The path to validate
 * @returns true if the path is safe for internal navigation
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== 'string') return false;

  const trimmedPath = path.trim();

  // Must start with /
  if (!trimmedPath.startsWith('/')) return false;

  // Must not start with // (protocol-relative URL)
  if (trimmedPath.startsWith('//')) return false;

  // Must not contain protocol (http://, https://, javascript:, data:, etc.)
  if (trimmedPath.includes('://')) return false;

  // Must not contain backslashes (Windows path traversal)
  if (trimmedPath.includes('\\')) return false;

  // Additional check: try to parse as URL with a base
  // If it resolves to a different origin, it's not safe
  try {
    const baseUrl = 'http://localhost';
    const resolved = new URL(trimmedPath, baseUrl);
    // Check that the resolved URL is still on the same origin
    if (resolved.origin !== baseUrl) return false;
  } catch {
    // If URL parsing fails, it might be a valid relative path
    // but we'll be conservative and reject it
    return false;
  }

  return true;
}

/**
 * Sanitize a redirect path to ensure it's safe for internal navigation
 * Returns the path if safe, otherwise returns a default safe path
 *
 * @param path - The path to sanitize
 * @param defaultPath - The default path to return if unsafe (default: '/')
 * @returns A safe path for internal navigation
 */
export function sanitizeInternalPath(
  path: string | null | undefined,
  defaultPath: string = '/'
): string {
  return isSafeInternalPath(path) ? path : defaultPath;
}
