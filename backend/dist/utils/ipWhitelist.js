"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIP = normalizeIP;
exports.matchesIPPattern = matchesIPPattern;
exports.isIPAllowed = isIPAllowed;
exports.isValidIPFormat = isValidIPFormat;
exports.isValidCIDRFormat = isValidCIDRFormat;
exports.validateIPPatterns = validateIPPatterns;
const logger_1 = require("./logger");
function normalizeIP(ip) {
    if (!ip) {
        return '';
    }
    const cleaned = ip.trim();
    const ipv6MappedPattern = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;
    const match = cleaned.match(ipv6MappedPattern);
    if (match) {
        return match[1];
    }
    if (cleaned === '::1' || cleaned === '0:0:0:0:0:0:0:1') {
        return '127.0.0.1';
    }
    return cleaned;
}
function parseCIDR(cidr) {
    const parts = cidr.split('/');
    if (parts.length !== 2) {
        return null;
    }
    const network = parts[0].trim();
    const prefixLength = parseInt(parts[1], 10);
    const isIPv6 = network.includes(':');
    const maxPrefix = isIPv6 ? 128 : 32;
    if (isNaN(prefixLength) || prefixLength < 0 || prefixLength > maxPrefix) {
        return null;
    }
    return { network, prefixLength, isIPv6 };
}
function ipv4ToInt(ip) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        throw new Error(`Invalid IPv4 address: ${ip}`);
    }
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}
function matchesIPv4CIDR(ip, network, prefixLength) {
    try {
        const ipInt = ipv4ToInt(ip);
        const networkInt = ipv4ToInt(network);
        const mask = (0xFFFFFFFF << (32 - prefixLength)) >>> 0;
        return (ipInt & mask) === (networkInt & mask);
    }
    catch (error) {
        logger_1.logger.warn('IPv4 CIDR matching error:', error);
        return false;
    }
}
function ipv6ToBigInt(ip) {
    const expandIPv6 = (addr) => {
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
    }
    catch (_error) {
        throw new Error(`Invalid IPv6 address: ${ip}`);
    }
}
function matchesIPv6CIDR(ip, network, prefixLength) {
    try {
        const ipBigInt = ipv6ToBigInt(ip);
        const networkBigInt = ipv6ToBigInt(network);
        const mask = (BigInt(1) << BigInt(128 - prefixLength)) - BigInt(1);
        const networkMask = ~mask;
        return (ipBigInt & networkMask) === (networkBigInt & networkMask);
    }
    catch (error) {
        logger_1.logger.warn('IPv6 CIDR matching error:', error);
        return false;
    }
}
function matchesIPPattern(ip, pattern) {
    const normalizedIP = normalizeIP(ip);
    const normalizedPattern = pattern.trim();
    if (normalizedIP === normalizedPattern) {
        return true;
    }
    const cidr = parseCIDR(normalizedPattern);
    if (!cidr) {
        return false;
    }
    const isIPv6 = normalizedIP.includes(':');
    if (isIPv6 !== cidr.isIPv6) {
        return false;
    }
    if (cidr.isIPv6) {
        return matchesIPv6CIDR(normalizedIP, cidr.network, cidr.prefixLength);
    }
    else {
        return matchesIPv4CIDR(normalizedIP, cidr.network, cidr.prefixLength);
    }
}
function isIPAllowed(ip, allowedIPs, blockedIPs) {
    const normalizedIP = normalizeIP(ip);
    if (!normalizedIP) {
        return { allowed: false, reason: 'No IP address provided' };
    }
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
    if (!allowedIPs || allowedIPs.length === 0) {
        return { allowed: true };
    }
    for (const pattern of allowedIPs) {
        if (matchesIPPattern(normalizedIP, pattern)) {
            return { allowed: true };
        }
    }
    return {
        allowed: false,
        reason: `IP ${normalizedIP} is not in the allowed list`
    };
}
function isValidIPFormat(ip) {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Pattern.test(ip)) {
        const parts = ip.split('.').map(Number);
        return parts.every(p => p >= 0 && p <= 255);
    }
    const ipv6Pattern = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv6Pattern.test(ip);
}
function isValidCIDRFormat(cidr) {
    const parsed = parseCIDR(cidr);
    if (!parsed) {
        return false;
    }
    return isValidIPFormat(parsed.network);
}
function validateIPPatterns(patterns) {
    const errors = [];
    for (const pattern of patterns) {
        const trimmed = pattern.trim();
        if (trimmed.includes('/')) {
            if (!isValidCIDRFormat(trimmed)) {
                errors.push(`Invalid CIDR notation: ${trimmed}`);
            }
        }
        else {
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
//# sourceMappingURL=ipWhitelist.js.map