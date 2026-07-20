export declare function normalizeIP(ip: string | undefined): string;
export declare function matchesIPPattern(ip: string, pattern: string): boolean;
export declare function isIPAllowed(ip: string | undefined, allowedIPs?: string[], blockedIPs?: string[]): {
    allowed: boolean;
    reason?: string;
};
export declare function isValidIPFormat(ip: string): boolean;
export declare function isValidCIDRFormat(cidr: string): boolean;
export declare function validateIPPatterns(patterns: string[]): {
    valid: boolean;
    errors: string[];
};
//# sourceMappingURL=ipWhitelist.d.ts.map