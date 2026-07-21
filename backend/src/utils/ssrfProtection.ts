/**
 * SSRF Protection — DNS rebinding and private network guards.
 *
 * Validates hostnames and resolved IPs against private/internal ranges
 * before making outbound requests. Guards against:
 * - Direct private IP access (127.x, 10.x, 192.168.x, etc.)
 * - Cloud metadata endpoints (169.254.169.254, Azure IMDS)
 * - DNS rebinding attacks (attacker domain → private IP at resolution time)
 */

import { logger } from './logger';

/** Private/internal IPv4 range patterns */
const PRIVATE_IP_RANGES = [
  /^127\./, // Loopback
  /^10\./, // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./, // Class B private
  /^192\.168\./, // Class C private
  /^169\.254\./, // Link-local
];

/**
 * Check if a hostname or IP is private/internal.
 * String-level check — does NOT resolve DNS.
 */
export function isPrivateHost(host: string): boolean {
  const lower = host.toLowerCase();
  if (lower === 'localhost' || lower === '0.0.0.0' || lower === '::1') {
    return true;
  }
  // Cloud metadata endpoints
  if (
    lower === '169.254.169.254' ||
    lower === '168.63.129.16' ||
    lower === 'metadata.google.internal'
  ) {
    return true;
  }
  return PRIVATE_IP_RANGES.some(r => r.test(host));
}

/**
 * Resolve a hostname to IPs and verify none are private.
 * Guards against DNS rebinding attacks where a domain resolves to
 * an internal IP after passing the string-level isPrivateHost check.
 *
 * Returns `true` if the host is private or resolution fails (fail-closed).
 */
export async function isPrivateHostResolved(host: string): Promise<boolean> {
  if (isPrivateHost(host)) {
    return true;
  }

  // If it looks like a bare IPv4 already, the string check above covers it
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return false;
  }

  try {
    const dns = await import('node:dns/promises');
    const addresses = await dns.resolve4(host);
    return addresses.some(ip => isPrivateHost(ip));
  } catch {
    // DNS resolution failed — block to be safe (fail-closed)
    logger.warn('DNS resolution failed for outbound host, blocking as precaution', { host });
    return true;
  }
}
