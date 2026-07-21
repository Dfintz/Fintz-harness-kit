/**
 * IP Whitelisting Utility
 * Provides IP address validation and CIDR range checking for organization access control
 */

import { logger } from './logger';

/**
 * Normalize IPv4 and IPv6 addresses for comparison
 * - Converts IPv6-mapped IPv4 addresses (::ffff:192.168.1.1) to IPv4 (192.168.1.1)
 * - Handles localhost variations
 */
export function normalizeIP(ip: string | undefined): string {
    if (!ip) {return '';}

    // Remove leading/trailing whitespace
    const cleaned = ip.trim();

    // Handle IPv6-mapped IPv4 addresses (::ffff:192.168.1.1)
    const ipv6MappedPattern = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
    const match = cleaned.match(ipv6MappedPattern);
    if (match) {
        return match[1];
    }

    // Normalize localhost
    if (cleaned === '::1' || cleaned === '0:0:0:0:0:0:0:1') {
        return '127.0.0.1';
    }

    return cleaned;
}

/**
 * Parse CIDR notation into network address and prefix length
 * Examples: "192.168.1.0/24", "2001:db8::/32"
 */
function parseCIDR(cidr: string): { network: string; prefixLength: number; isIPv6: boolean } | null {
    const parts = cidr.split('/');
    if (parts.length !== 2) {
        return null;
    }

    const network = parts[0].trim();
    const prefixLength = parseInt(parts[1], 10);

    const isIPv6 = network.includes(':');

    // Validate prefix length
    const maxPrefix = isIPv6 ? 128 : 32;
    if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > maxPrefix) {
        return null;
    }

    return { network, prefixLength, isIPv6 };
}

/**
 * Convert IPv4 address to 32-bit integer
 */
function ipv4ToInt(ip: string): number {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Check if IPv4 address matches CIDR range
 */
function matchesIPv4CIDR(ip: string, network: string, prefixLength: number): boolean {
    try {
        const ipInt = ipv4ToInt(ip);
        const networkInt = ipv4ToInt(network);
        const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;

        return (ipInt & mask) === (networkInt & mask);
    } catch (error) {
        logger.warn('IPv4 CIDR matching error:', error);
        return false;
    }
}

/**
 * Convert IPv6 address to BigInt for comparison
 * Simplified implementation - handles standard notation
 */
function ipv6ToBigInt(ip: string): bigint {
    // Expand abbreviated IPv6 (e.g., "2001:db8::1" -> "2001:0db8:0000:0000:0000:0000:0000:0001")
    const expandIPv6 = (addr: string): string => {
        // Handle :: expansion
        if (addr.includes('::')) {
            const parts = addr.split('::');
            const left = parts[0] ? parts[0].split(':') : [];
            const right = parts[1] ? parts[1].split(':') : [];
            const missing = 8 - left.length - right.length;
            const zeros = Array(missing).fill('0000');
            const expanded = [...left, ...zeros, ...right];
            return expanded.map(p => p.padStart(4, '0')).join(':');
        }
        return addr.split(':').map(p => p.padStart(4, '0')).join(':');
    };

    try {
        const expanded = expandIPv6(ip);
        const parts = expanded.split(':');
        
        if (parts.length !== 8) {
            throw new Error('Invalid IPv6 format');
        }

        let result = BigInt(0);
        for (const part of parts) {
            result = (result << BigInt(16)) | BigInt(parseInt(part, 16));
        }
        return result;
    } catch (_error) {
        throw new Error(`Invalid IPv6 address: ${ip}`);
    }
}

/**
 * Check if IPv6 address matches CIDR range
 */
function matchesIPv6CIDR(ip: string, network: string, prefixLength: number): boolean {
    try {
        const ipBigInt = ipv6ToBigInt(ip);
        const networkBigInt = ipv6ToBigInt(network);
        const mask = (BigInt(1) << BigInt(128 - prefixLength)) - BigInt(1);
        const networkMask = ~mask;

        return (ipBigInt & networkMask) === (networkBigInt & networkMask);
    } catch (error) {
        logger.warn('IPv6 CIDR matching error:', error);
        return false;
    }
}

/**
 * Check if IP address matches a pattern (single IP or CIDR range)
 */
export function matchesIPPattern(ip: string, pattern: string): boolean {
    const normalizedIP = normalizeIP(ip);
    const normalizedPattern = pattern.trim();

    // Exact match
    if (normalizedIP === normalizedPattern) {
        return true;
    }

    // Check if pattern is CIDR notation
    const cidr = parseCIDR(normalizedPattern);
    if (!cidr) {
        return false;
    }

    // Determine if IP is IPv6
    const isIPv6 = normalizedIP.includes(':');

    // Type mismatch
    if (isIPv6 !== cidr.isIPv6) {
        return false;
    }

    // Match CIDR range
    if (cidr.isIPv6) {
        return matchesIPv6CIDR(normalizedIP, cidr.network, cidr.prefixLength);
    } else {
        return matchesIPv4CIDR(normalizedIP, cidr.network, cidr.prefixLength);
    }
}

/**
 * Check if IP address is allowed based on whitelist and blacklist
 * @param ip IP address to check
 * @param allowedIPs Array of allowed IP addresses or CIDR ranges (whitelist)
 * @param blockedIPs Array of blocked IP addresses or CIDR ranges (blacklist)
 * @returns true if IP is allowed, false otherwise
 * 
 * Rules:
 * 1. If allowedIPs is empty or undefined, all IPs are allowed (unless blocked)
 * 2. If allowedIPs is specified, IP must match at least one pattern
 * 3. If IP matches blockedIPs, access is denied regardless of allowedIPs
 */
export function isIPAllowed(
    ip: string | undefined,
    allowedIPs?: string[],
    blockedIPs?: string[]
): { allowed: boolean; reason?: string } {
    const normalizedIP = normalizeIP(ip);

    // No IP address provided
    if (!normalizedIP) {
        return { allowed: false, reason: 'No IP address provided' };
    }

    // Check blacklist first (highest priority)
    if (blockedIPs && blockedIPs.length > 0) {
        for (const pattern of blockedIPs) {
            if (matchesIPPattern(normalizedIP, pattern)) {
                return { 
                    allowed: false, 
                    reason: `IP ${normalizedIP} is blocked (matches pattern: ${pattern})` 
                };
            }
        }
    }

    // If no whitelist specified, allow by default (after blacklist check)
    if (!allowedIPs || allowedIPs.length === 0) {
        return { allowed: true };
    }

    // Check whitelist
    for (const pattern of allowedIPs) {
        if (matchesIPPattern(normalizedIP, pattern)) {
            return { allowed: true };
        }
    }

    // Not in whitelist
    return { 
        allowed: false, 
        reason: `IP ${normalizedIP} is not in the allowed list` 
    };
}

/**
 * Validate IP address format (IPv4 or IPv6)
 */
export function isValidIPFormat(ip: string): boolean {
    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Pattern.test(ip)) {
        const parts = ip.split('.').map(Number);
        return parts.every(p => p >= 0 && p <= 255);
    }

    // IPv6 pattern (simplified - accepts standard and compressed notation)
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv6Pattern.test(ip);
}

/**
 * Validate CIDR notation format
 */
export function isValidCIDRFormat(cidr: string): boolean {
    const parsed = parseCIDR(cidr);
    if (!parsed) {
        return false;
    }

    return isValidIPFormat(parsed.network);
}

/**
 * Validate an array of IP patterns (individual IPs or CIDR ranges)
 */
export function validateIPPatterns(patterns: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const pattern of patterns) {
        const trimmed = pattern.trim();
        
        // Check if it's CIDR notation
        if (trimmed.includes('/')) {
            if (!isValidCIDRFormat(trimmed)) {
                errors.push(`Invalid CIDR notation: ${trimmed}`);
            }
        } else {
            // Individual IP address
            if (!isValidIPFormat(trimmed)) {
                errors.push(`Invalid IP address: ${trimmed}`);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
