/**
 * IP Whitelisting Utility Tests
 */

import {
    normalizeIP,
    matchesIPPattern,
    isIPAllowed,
    isValidIPFormat,
    isValidCIDRFormat,
    validateIPPatterns
} from '../../utils/ipWhitelist';

describe('IP Whitelisting Utility', () => {
    describe('normalizeIP', () => {
        it('should normalize IPv6-mapped IPv4 addresses', () => {
            expect(normalizeIP('::ffff:192.168.1.1')).toBe('192.168.1.1');
            expect(normalizeIP('::FFFF:10.0.0.1')).toBe('10.0.0.1');
        });

        it('should normalize localhost', () => {
            expect(normalizeIP('::1')).toBe('127.0.0.1');
            expect(normalizeIP('0:0:0:0:0:0:0:1')).toBe('127.0.0.1');
        });

        it('should handle regular IPv4', () => {
            expect(normalizeIP('192.168.1.1')).toBe('192.168.1.1');
            expect(normalizeIP('10.0.0.1')).toBe('10.0.0.1');
        });

        it('should handle regular IPv6', () => {
            expect(normalizeIP('2001:db8::1')).toBe('2001:db8::1');
        });

        it('should handle undefined', () => {
            expect(normalizeIP(undefined)).toBe('');
        });

        it('should trim whitespace', () => {
            expect(normalizeIP('  192.168.1.1  ')).toBe('192.168.1.1');
        });
    });

    describe('isValidIPFormat', () => {
        it('should validate IPv4 addresses', () => {
            expect(isValidIPFormat('192.168.1.1')).toBe(true);
            expect(isValidIPFormat('10.0.0.1')).toBe(true);
            expect(isValidIPFormat('255.255.255.255')).toBe(true);
            expect(isValidIPFormat('0.0.0.0')).toBe(true);
        });

        it('should reject invalid IPv4', () => {
            expect(isValidIPFormat('256.1.1.1')).toBe(false);
            expect(isValidIPFormat('192.168.1')).toBe(false);
            expect(isValidIPFormat('192.168.1.1.1')).toBe(false);
            expect(isValidIPFormat('abc.def.ghi.jkl')).toBe(false);
        });

        it('should validate IPv6 addresses', () => {
            expect(isValidIPFormat('2001:db8::1')).toBe(true);
            expect(isValidIPFormat('::1')).toBe(true);
            expect(isValidIPFormat('fe80::1')).toBe(true);
            expect(isValidIPFormat('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(true);
        });

        it('should reject invalid IPv6', () => {
            expect(isValidIPFormat('gggg::1')).toBe(false);
            expect(isValidIPFormat('12345::1')).toBe(false); // Invalid hex digits
        });
    });

    describe('isValidCIDRFormat', () => {
        it('should validate IPv4 CIDR', () => {
            expect(isValidCIDRFormat('192.168.1.0/24')).toBe(true);
            expect(isValidCIDRFormat('10.0.0.0/8')).toBe(true);
            expect(isValidCIDRFormat('172.16.0.0/12')).toBe(true);
            expect(isValidCIDRFormat('192.168.1.1/32')).toBe(true);
        });

        it('should validate IPv6 CIDR', () => {
            expect(isValidCIDRFormat('2001:db8::/32')).toBe(true);
            expect(isValidCIDRFormat('fe80::/10')).toBe(true);
            expect(isValidCIDRFormat('::1/128')).toBe(true);
        });

        it('should reject invalid CIDR', () => {
            expect(isValidCIDRFormat('192.168.1.0/33')).toBe(false); // Invalid prefix
            expect(isValidCIDRFormat('192.168.1.0/abc')).toBe(false); // Non-numeric prefix
            expect(isValidCIDRFormat('192.168.1.0')).toBe(false); // Missing prefix
            expect(isValidCIDRFormat('2001:db8::/129')).toBe(false); // IPv6 prefix too large
        });
    });

    describe('matchesIPPattern', () => {
        describe('exact IP matching', () => {
            it('should match exact IPv4', () => {
                expect(matchesIPPattern('192.168.1.1', '192.168.1.1')).toBe(true);
                expect(matchesIPPattern('10.0.0.1', '10.0.0.1')).toBe(true);
            });

            it('should not match different IPv4', () => {
                expect(matchesIPPattern('192.168.1.1', '192.168.1.2')).toBe(false);
                expect(matchesIPPattern('10.0.0.1', '192.168.1.1')).toBe(false);
            });

            it('should match normalized IPs', () => {
                expect(matchesIPPattern('::ffff:192.168.1.1', '192.168.1.1')).toBe(true);
            });
        });

        describe('IPv4 CIDR matching', () => {
            it('should match IPv4 in /24 range', () => {
                expect(matchesIPPattern('192.168.1.1', '192.168.1.0/24')).toBe(true);
                expect(matchesIPPattern('192.168.1.100', '192.168.1.0/24')).toBe(true);
                expect(matchesIPPattern('192.168.1.255', '192.168.1.0/24')).toBe(true);
            });

            it('should not match IPv4 outside /24 range', () => {
                expect(matchesIPPattern('192.168.2.1', '192.168.1.0/24')).toBe(false);
                expect(matchesIPPattern('192.168.0.1', '192.168.1.0/24')).toBe(false);
            });

            it('should match IPv4 in /16 range', () => {
                expect(matchesIPPattern('10.0.1.1', '10.0.0.0/16')).toBe(true);
                expect(matchesIPPattern('10.0.255.255', '10.0.0.0/16')).toBe(true);
            });

            it('should not match IPv4 outside /16 range', () => {
                expect(matchesIPPattern('10.1.0.1', '10.0.0.0/16')).toBe(false);
            });

            it('should match IPv4 in /8 range', () => {
                expect(matchesIPPattern('10.1.1.1', '10.0.0.0/8')).toBe(true);
                expect(matchesIPPattern('10.255.255.255', '10.0.0.0/8')).toBe(true);
            });

            it('should match single IP with /32', () => {
                expect(matchesIPPattern('192.168.1.1', '192.168.1.1/32')).toBe(true);
                expect(matchesIPPattern('192.168.1.2', '192.168.1.1/32')).toBe(false);
            });
        });

        describe('IPv6 CIDR matching', () => {
            it('should match IPv6 in range', () => {
                expect(matchesIPPattern('2001:db8::1', '2001:db8::/32')).toBe(true);
                expect(matchesIPPattern('2001:db8:1234::1', '2001:db8::/32')).toBe(true);
            });

            it('should not match IPv6 outside range', () => {
                expect(matchesIPPattern('2001:db9::1', '2001:db8::/32')).toBe(false);
            });
        });

        describe('type mismatch', () => {
            it('should not match IPv4 against IPv6 CIDR', () => {
                expect(matchesIPPattern('192.168.1.1', '2001:db8::/32')).toBe(false);
            });

            it('should not match IPv6 against IPv4 CIDR', () => {
                expect(matchesIPPattern('2001:db8::1', '192.168.1.0/24')).toBe(false);
            });
        });
    });

    describe('isIPAllowed', () => {
        describe('no restrictions', () => {
            it('should allow all IPs when no whitelist/blacklist', () => {
                const result = isIPAllowed('192.168.1.1');
                expect(result.allowed).toBe(true);
            });

            it('should allow all IPs with empty arrays', () => {
                const result = isIPAllowed('192.168.1.1', [], []);
                expect(result.allowed).toBe(true);
            });
        });

        describe('whitelist only', () => {
            it('should allow IP in whitelist', () => {
                const result = isIPAllowed('192.168.1.1', ['192.168.1.1']);
                expect(result.allowed).toBe(true);
            });

            it('should allow IP in CIDR whitelist', () => {
                const result = isIPAllowed('192.168.1.100', ['192.168.1.0/24']);
                expect(result.allowed).toBe(true);
            });

            it('should deny IP not in whitelist', () => {
                const result = isIPAllowed('192.168.2.1', ['192.168.1.1']);
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('not in the allowed list');
            });

            it('should allow IP matching any whitelist entry', () => {
                const result = isIPAllowed('192.168.1.100', [
                    '10.0.0.0/8',
                    '192.168.1.0/24',
                    '172.16.0.0/12'
                ]);
                expect(result.allowed).toBe(true);
            });
        });

        describe('blacklist only', () => {
            it('should block IP in blacklist', () => {
                const result = isIPAllowed('192.168.1.100', undefined, ['192.168.1.100']);
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('is blocked');
            });

            it('should block IP in CIDR blacklist', () => {
                const result = isIPAllowed('192.168.1.100', undefined, ['192.168.1.0/24']);
                expect(result.allowed).toBe(false);
            });

            it('should allow IP not in blacklist', () => {
                const result = isIPAllowed('192.168.2.1', undefined, ['192.168.1.100']);
                expect(result.allowed).toBe(true);
            });
        });

        describe('whitelist and blacklist', () => {
            it('should deny blacklisted IP even if whitelisted', () => {
                const result = isIPAllowed(
                    '192.168.1.100',
                    ['192.168.1.0/24'],
                    ['192.168.1.100']
                );
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('is blocked');
            });

            it('should allow whitelisted IP not in blacklist', () => {
                const result = isIPAllowed(
                    '192.168.1.50',
                    ['192.168.1.0/24'],
                    ['192.168.1.100']
                );
                expect(result.allowed).toBe(true);
            });

            it('should deny IP not in whitelist', () => {
                const result = isIPAllowed(
                    '192.168.2.1',
                    ['192.168.1.0/24'],
                    ['192.168.1.100']
                );
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('not in the allowed list');
            });
        });

        describe('edge cases', () => {
            it('should deny undefined IP', () => {
                const result = isIPAllowed(undefined, ['192.168.1.0/24']);
                expect(result.allowed).toBe(false);
                expect(result.reason).toContain('No IP address');
            });

            it('should deny empty IP', () => {
                const result = isIPAllowed('', ['192.168.1.0/24']);
                expect(result.allowed).toBe(false);
            });

            it('should handle normalized IPv6-mapped IPv4', () => {
                const result = isIPAllowed('::ffff:192.168.1.1', ['192.168.1.0/24']);
                expect(result.allowed).toBe(true);
            });
        });
    });

    describe('validateIPPatterns', () => {
        it('should validate correct patterns', () => {
            const result = validateIPPatterns([
                '192.168.1.1',
                '10.0.0.0/8',
                '2001:db8::1',
                '2001:db8::/32'
            ]);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect invalid IPv4', () => {
            const result = validateIPPatterns(['256.1.1.1']);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid IP address: 256.1.1.1');
        });

        it('should detect invalid CIDR', () => {
            const result = validateIPPatterns(['192.168.1.0/33']);
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Invalid CIDR notation: 192.168.1.0/33');
        });

        it('should detect multiple errors', () => {
            const result = validateIPPatterns([
                '192.168.1.1',      // Valid
                '256.1.1.1',        // Invalid IPv4
                '192.168.1.0/33',   // Invalid CIDR
                '10.0.0.0/8'        // Valid
            ]);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(2);
        });

        it('should handle empty array', () => {
            const result = validateIPPatterns([]);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

afterAll(() => {
  jest.restoreAllMocks();
});
});
