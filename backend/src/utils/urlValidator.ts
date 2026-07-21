import { URL } from 'url';

import { logger } from './logger';

/**
 * SSRF Protection Utilities
 *
 * Prevents Server-Side Request Forgery attacks by validating URLs
 * and blocking requests to internal network resources.
 */

/**
 * Private IP ranges (RFC 1918, RFC 4193, etc.)
 */
const PRIVATE_IP_RANGES = [
  /^10\./, // 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
  /^192\.168\./, // 192.168.0.0/16
  /^127\./, // 127.0.0.0/8 (localhost)
  /^169\.254\./, // 169.254.0.0/16 (link-local)
  /^::1$/, // IPv6 localhost
  /^fe80:/i, // IPv6 link-local
  /^fc00:/i, // IPv6 unique local
  /^fd00:/i, // IPv6 unique local
];

/**
 * Blocked hostnames
 */
const BLOCKED_HOSTNAMES = [
  'localhost',
  'metadata.google.internal', // GCP metadata
  '169.254.169.254', // AWS/Azure metadata
];

/**
 * Allowed protocols
 */
const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export interface UrlValidationOptions {
  /**
   * Allow private IP addresses (default: false)
   */
  allowPrivateIps?: boolean;

  /**
   * Allow localhost (default: false)
   */
  allowLocalhost?: boolean;

  /**
   * Additional allowed hostnames (optional allowlist)
   */
  allowedHosts?: string[];

  /**
   * Require HTTPS only (default: false)
   */
  requireHttps?: boolean;
}

export class UrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

/**
 * Validate if a hostname is a private IP address
 */
function isPrivateIp(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some(range => range.test(hostname));
}

/**
 * Validate if a hostname is blocked
 */
function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return BLOCKED_HOSTNAMES.some(blocked => lower === blocked || lower.endsWith(`.${blocked}`));
}

/**
 * Validate a URL for SSRF protection
 *
 * @param urlString - URL string to validate
 * @param options - Validation options
 * @returns Parsed and validated URL object
 * @throws UrlValidationError if URL is invalid or blocked
 */
export function validateUrl(urlString: string, options: UrlValidationOptions = {}): URL {
  const {
    allowPrivateIps = false,
    allowLocalhost = false,
    allowedHosts = [],
    requireHttps = false,
  } = options;

  // Parse URL
  let url: URL;
  try {
    url = new URL(urlString);
  } catch (error) {
    logger.warn('Invalid URL format:', { url: urlString, error });
    throw new UrlValidationError('Invalid URL format');
  }

  // Validate protocol
  if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
    logger.warn('Blocked protocol:', { url: urlString, protocol: url.protocol });
    throw new UrlValidationError(`Protocol ${url.protocol} is not allowed`);
  }

  // Require HTTPS if specified
  if (requireHttps && url.protocol !== 'https:') {
    logger.warn('HTTPS required:', { url: urlString });
    throw new UrlValidationError('HTTPS is required');
  }

  const hostname = url.hostname.toLowerCase();

  // Check allowlist first (if provided)
  if (allowedHosts.length > 0) {
    const isAllowed = allowedHosts.some(allowed => {
      const lowerAllowed = allowed.toLowerCase();
      return hostname === lowerAllowed || hostname.endsWith(`.${lowerAllowed}`);
    });

    if (!isAllowed) {
      logger.warn('Hostname not in allowlist:', { url: urlString, hostname });
      throw new UrlValidationError('Hostname is not allowed');
    }

    // If in allowlist, skip other checks
    return url;
  }

  // Check for blocked hostnames
  if (isBlockedHostname(hostname)) {
    logger.warn('Blocked hostname detected:', { url: urlString, hostname });
    throw new UrlValidationError('Hostname is blocked');
  }

  // Check for localhost
  if (!allowLocalhost && (hostname === 'localhost' || hostname.startsWith('127.'))) {
    logger.warn('Localhost access blocked:', { url: urlString, hostname });
    throw new UrlValidationError('Localhost access is not allowed');
  }

  // Check for private IPs
  if (!allowPrivateIps && isPrivateIp(hostname)) {
    logger.warn('Private IP address blocked:', { url: urlString, hostname });
    throw new UrlValidationError('Private IP addresses are not allowed');
  }

  // Check for URL encoding attempts to bypass validation
  if (urlString.includes('%') || urlString.includes('\\')) {
    const decodedUrl = decodeURIComponent(urlString);
    if (decodedUrl !== urlString) {
      // Recursively validate decoded URL
      try {
        return validateUrl(decodedUrl, options);
      } catch (_error) {
        logger.warn('URL encoding bypass attempt:', { url: urlString, decoded: decodedUrl });
        throw new UrlValidationError('URL encoding bypass detected');
      }
    }
  }

  logger.info('URL validated successfully:', { url: urlString, hostname });
  return url;
}

/**
 * Validate a URL for webhook destinations
 *
 * Webhooks should only target external, public endpoints.
 * This is a convenience wrapper with stricter defaults.
 */
export function validateWebhookUrl(urlString: string): URL {
  return validateUrl(urlString, {
    allowPrivateIps: false,
    allowLocalhost: false,
    requireHttps: process.env.NODE_ENV === 'production',
  });
}

/**
 * Validate a URL for external integrations
 *
 * External integrations may need to connect to various endpoints
 * but should still block internal network access.
 */
export function validateExternalIntegrationUrl(urlString: string, allowedHosts?: string[]): URL {
  return validateUrl(urlString, {
    allowPrivateIps: false,
    allowLocalhost: false,
    allowedHosts,
    requireHttps: false, // Some integrations may use HTTP
  });
}
