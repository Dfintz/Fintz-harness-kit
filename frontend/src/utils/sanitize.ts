/**
 * Frontend Sanitization Utilities
 * Prevents XSS and other injection attacks in the browser
 */

import { logger } from './logger';

/** Return the API base URL for image proxy paths */
function getApiBase(): string {
  try {
    const url = import.meta.env.VITE_API_URL as string | undefined;
    if (url && url.trim() !== '') {
      let base = url.trim();
      // Strip trailing /api if present (same logic as env.ts)
      base = base.replace(/\/api\/?$/i, '');
      // Add https:// if no protocol and not a relative path
      if (base && !/^https?:\/\//i.exec(base) && !base.startsWith('/')) {
        base = 'https://' + base;
      }
      return base;
    }
  } catch {
    // import.meta not available (e.g. tests)
  }
  // Fallback: use current origin so relative image paths resolve correctly
  // when VITE_API_URL is not set (assumes same-origin proxy or reverse proxy)
  if (globalThis.window?.location?.origin) {
    return globalThis.window.location.origin;
  }
  return '';
}

/**
 * Sanitize URL to prevent javascript: protocol and other XSS vectors
 * Only allows http, https, and data: (for images) protocols
 * @param url - URL to sanitize
 * @returns Safe URL or empty string if dangerous
 */
export function sanitizeUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  // Trim and lowercase for comparison
  const trimmed = url.trim();
  const lowercase = trimmed.toLowerCase();

  // Block dangerous protocols
  const dangerousProtocols = ['javascript:', 'vbscript:', 'data:text/html', 'data:application'];

  for (const protocol of dangerousProtocols) {
    if (lowercase.startsWith(protocol)) {
      logger.warn('Blocked dangerous URL protocol:', protocol);
      return '';
    }
  }

  // Block protocol-relative URLs (//evil.com) as they can be dangerous
  if (trimmed.startsWith('//')) {
    logger.warn('Blocked protocol-relative URL:', url);
    return '';
  }

  // Allow safe protocols
  const safeProtocols = ['http:', 'https:', 'data:image/'];
  const hasSafeProtocol = safeProtocols.some(p => lowercase.startsWith(p));

  // Also allow relative URLs (starts with / but not //)
  const isRelative = trimmed.startsWith('/') && !trimmed.startsWith('//');

  if (!hasSafeProtocol && !isRelative) {
    logger.warn('Blocked URL with unknown protocol:', url);
    return '';
  }

  return trimmed;
}

/**
 * Convert an Azure Blob Storage URL to an API proxy URL.
 * Returns null if the URL is not an Azure Blob URL.
 */
function toBlobProxyUrl(trimmed: string, lowercase: string): string | null {
  if (!lowercase.includes('.blob.core.windows.net/')) {
    return null;
  }
  try {
    const parsed = new URL(trimmed);
    const fileName = parsed.pathname.split('/').pop();
    if (fileName) {
      const base = getApiBase();
      return `${base}/api/v2/images/download/${encodeURIComponent(fileName)}`;
    }
  } catch {
    // Not a valid URL
  }
  return null;
}

/** Regex for bare image filenames (e.g. "08c6e622-…-8deb.png") */
const BARE_IMAGE_FILE_RE = /^[\w-]+\.(png|jpe?g|gif|webp|svg|avif)$/i;

/**
 * Convert a bare image filename to the API download proxy URL.
 * Returns null when the value is not a bare filename.
 */
function bareFileToProxyUrl(trimmed: string): string | null {
  if (!BARE_IMAGE_FILE_RE.test(trimmed)) {
    return null;
  }
  const base = getApiBase();
  return `${base}/api/v2/images/download/${encodeURIComponent(trimmed)}`;
}

/**
 * Sanitize image URL specifically for avatar/profile images
 * More restrictive than general URL sanitization
 * @param url - Image URL to sanitize
 * @returns Safe image URL or empty string
 */
/**
 * Rewrite a relative image path to an absolute API URL.
 * Returns null when no rewrite is needed.
 */
function rewriteRelativeImagePath(trimmed: string): string | null {
  // Convert relative API image proxy paths to absolute URLs.
  // The frontend (fringecore.space) and API (api.fringecore.space) are on
  // different origins, so relative /api/v2/images/... paths must be prefixed.
  if (trimmed.startsWith('/api/v2/images/')) {
    return `${getApiBase()}${trimmed}`;
  }

  // Rewrite legacy /uploads/<file> paths to the API download proxy.
  if (trimmed.startsWith('/uploads/')) {
    const fileName = trimmed.replace('/uploads/', '');
    return `${getApiBase()}/api/v2/images/download/${fileName}`;
  }

  return null;
}

export function sanitizeImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  const lowercase = trimmed.toLowerCase();

  // Block protocol-relative URLs (//evil.com)
  if (trimmed.startsWith('//')) {
    logger.warn('Blocked protocol-relative image URL:', url);
    return '';
  }

  // Check for HTTP - allowed in development, blocked in production
  if (lowercase.startsWith('http://')) {
    if (process.env.NODE_ENV === 'production') {
      logger.warn('Blocked non-HTTPS image URL in production');
      return '';
    }
    return trimmed;
  }

  // Allow HTTPS, data:image, and relative URLs
  const isHttps = lowercase.startsWith('https://');
  const isDataImage = lowercase.startsWith('data:image/');
  const isRelative = trimmed.startsWith('/') && !trimmed.startsWith('//');

  // Handle bare filenames (e.g. "08c6e622-...png") stored in the DB without
  // a path prefix.  Convert them to the image download proxy URL.
  if (!isHttps && !isDataImage && !isRelative) {
    const proxy = bareFileToProxyUrl(trimmed);
    if (proxy) {
      return proxy;
    }
    logger.warn('Blocked unsafe image URL:', url);
    return '';
  }

  // Convert Azure Blob Storage URLs to API proxy URLs
  if (isHttps) {
    const proxy = toBlobProxyUrl(trimmed, lowercase);
    if (proxy) {
      return proxy;
    }
  }

  // Rewrite relative image paths to absolute API URLs
  if (isRelative) {
    return rewriteRelativeImagePath(trimmed) ?? trimmed;
  }

  return trimmed;
}

/**
 * Escape HTML special characters to prevent XSS
 * @param text - Text to escape
 * @returns Escaped text safe for HTML insertion
 */
export function escapeHtml(text: string | undefined | null): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const htmlEscapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replaceAll(/[&<>"'/]/g, char => htmlEscapes[char] ?? char);
}

export const Sanitize = {
  sanitizeUrl,
  sanitizeImageUrl,
  escapeHtml,
};
