/**
 * Joi-based Validators with Singleton Pattern
 * 
 * Enhanced validation using Joi to replace validator.js
 * 
 * SINGLETON PATTERN IMPLEMENTATION:
 * This module uses the singleton pattern to ensure consistent validator
 * instances across the application and prevent Joi extension conflicts.
 * 
 * WHY SINGLETON IS IMPORTANT:
 * - Joi extensions can only be applied once per type
 * - Multiple module imports in testing can cause "Rule conflict" errors
 * - Ensures validation consistency across the entire application
 * - Reduces memory footprint by reusing validator instances
 * 
 * USAGE:
 * ```typescript
 * // Recommended: Use getJoiValidators() for explicit singleton access
 * import { getJoiValidators } from './utils/joiValidators';
 * const validators = getJoiValidators();
 * validators.secureEmailSchema.validate('test@example.com');
 * 
 * // Also works: Default import (uses same singleton instance)
 * import joiValidators from './utils/joiValidators';
 * joiValidators.secureEmailSchema.validate('test@example.com');
 * 
 * // Individual exports also available
 * import { secureEmailSchema } from './utils/joiValidators';
 * secureEmailSchema.validate('test@example.com');
 * ```
 * 
 * CREATING NEW VALIDATORS:
 * When adding new validators to this module:
 * 1. Define schemas as module-level exports (they're automatically singletons)
 * 2. Add to the joiValidators object
 * 3. Export via getJoiValidators() for consistency
 * 4. Add comprehensive tests in __tests__/utils/joiValidators.test.ts
 * 
 * SECURITY FEATURES:
 * These validators provide comprehensive security checks to prevent:
 * - URL validation bypasses
 * - SSRF attacks
 * - XSS attacks
 * - Email validation bypasses
 * - Protocol confusion attacks
 * - SQL/NoSQL injection
 * 
 * @module joiValidators
 * @singleton
 */

import { URL } from 'node:url';

import Joi from 'joi';

/**
 * Joi custom extension for secure URL validation
 */
const _urlExtension = (joi: typeof Joi): Joi.Extension => ({
    type: 'secureUrl',
    base: joi.string(),
    messages: {
        'secureUrl.invalid': '{{#label}} must be a valid and secure URL',
        'secureUrl.privateIP': '{{#label}} cannot point to private IP addresses',
        'secureUrl.localhost': '{{#label}} cannot point to localhost',
        'secureUrl.dangerousProtocol': '{{#label}} has a dangerous protocol',
        'secureUrl.suspicious': '{{#label}} contains suspicious patterns'
    },
    rules: {
        validate: {
            method(value: string, helpers: { error: (code: string) => unknown }, args: { options?: { protocols: string[]; requireProtocol: boolean; allowCredentials: boolean } }) {
                const options = args.options ?? {
                    protocols: ['http', 'https'],
                    requireProtocol: true,
                    allowCredentials: false
                };

                try {
                    // Parse URL
                    const parsedUrl = new URL(value);

                    // Verify protocol
                    const protocol = parsedUrl.protocol.replace(':', '');
                    if (!options.protocols.includes(protocol)) {
                        return helpers.error('secureUrl.dangerousProtocol');
                    }

                    // Prevent credentials in URL if not allowed
                    if (!options.allowCredentials && (parsedUrl.username || parsedUrl.password)) {
                        return helpers.error('secureUrl.invalid');
                    }

                    // Prevent SSRF - block private IP ranges
                    if (isPrivateIP(parsedUrl.hostname)) {
                        return helpers.error('secureUrl.privateIP');
                    }

                    // Prevent localhost access
                    if (isLocalhost(parsedUrl.hostname)) {
                        return helpers.error('secureUrl.localhost');
                    }

                    // Prevent dangerous protocols
                    const dangerousProtocols = ['file:', 'javascript:', 'data:', 'vbscript:'];
                    if (dangerousProtocols.includes(parsedUrl.protocol)) {
                        return helpers.error('secureUrl.dangerousProtocol');
                    }

                    // Check for suspicious patterns
                    const suspiciousPatterns = [
                        /\s/,  // Whitespace
                        /[<>]/,  // HTML tags
                        /javascript:/i,
                        /data:/i,
                        /vbscript:/i,
                         
                        /\x00/,  // Null byte
                        /[\r\n]/  // Line breaks
                    ];

                    for (const pattern of suspiciousPatterns) {
                        if (pattern.test(value)) {
                            return helpers.error('secureUrl.suspicious');
                        }
                    }

                    return value;
                } catch {
                    return helpers.error('secureUrl.invalid');
                }
            }
        }
    }
});

/**
 * Check if hostname is a private IP address or internal network
 */
export const isPrivateIP = (hostname: string): boolean => {
    const privateIPv4Patterns = [
        /^10\./,
        /^172\.(1[6-9]|2\d|3[0-1])\./,
        /^192\.168\./,
        /^169\.254\./,
        /^0\.0\.0\.0$/,
        /^255\.255\.255\.255$/
    ];

    const privateIPv6Patterns = [
        /^fe80:/i,
        /^fc00:/i,
        /^fd00:/i
    ];

    return [...privateIPv4Patterns, ...privateIPv6Patterns].some(pattern => pattern.test(hostname));
};

/**
 * Check if hostname is localhost
 */
export const isLocalhost = (hostname: string): boolean => {
    const localhostPatterns = [
        'localhost',
        '127.0.0.1',
        '::1',
        '0.0.0.0',
        /^127\./,
        /^::ffff:127\./
    ];

    return localhostPatterns.some(pattern => 
        typeof pattern === 'string' ? hostname === pattern : pattern.test(hostname)
    );
};

/**
 * Singleton instance of extended Joi
 * This ensures Joi is only extended once, preventing "Rule conflict" errors
 * 
 * NOTE: The custom secureUrl extension is currently disabled to prevent
 * "Rule conflict" errors in testing environments where modules may be
 * reloaded. Future improvement: investigate using Joi's built-in caching
 * mechanism or alternative extension approach.
 * 
 * For now, we use base Joi without extension to prevent conflicts.
 * The extension can be re-enabled after testing framework improvements.
 */
const _joiExtendedInstance: typeof Joi = Joi;

/**
 * Extended Joi with custom validators
 * Uses singleton pattern to prevent multiple extensions
 * Currently returns base Joi to prevent conflicts
 */
export const JoiExtended = _joiExtendedInstance;

/**
 * Joi schema for secure URL validation
 * Uses standard Joi validation with comprehensive checks
 */
export const secureUrlSchema = Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2000)
    .custom((value: string, helpers) => {
        try {
            const parsedUrl = new URL(value);
            const hostname = parsedUrl.hostname.toLowerCase();

            // Prevent credential-based URL obfuscation
            if (parsedUrl.username || parsedUrl.password) {
                return helpers.error('string.uri');
            }

            // Prevent SSRF by rejecting local and private targets
            if (isLocalhost(hostname) || isPrivateIP(hostname)) {
                return helpers.error('string.uri');
            }

            const dangerousProtocols = ['file:', 'javascript:', 'data:', 'vbscript:'];
            if (dangerousProtocols.includes(parsedUrl.protocol.toLowerCase())) {
                return helpers.error('string.uri');
            }

            const suspiciousPatterns = [
                /\s/,
                /[<>]/,
                 
                /\x00/,
                /[\r\n]/
            ];
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(value)) {
                    return helpers.error('string.uri');
                }
            }

            return value;
        } catch {
            return helpers.error('string.uri');
        }
    }, 'secure URL validation')
    .required();

/**
 * Joi schema for secure email validation
 */
export const secureEmailSchema = Joi.string()
    .email({ 
        tlds: { allow: true },
        minDomainSegments: 2
    })
    .max(254)
    .pattern(/^[^\s<>'"]+$/, 'no suspicious characters')
    .custom((value, helpers) => {
        // Check local part length
        const [localPart] = value.split('@');
        if (localPart.length > 64) {
            return helpers.error('string.email');
        }
        
        // Additional security checks
        const suspiciousPatterns = [
            /javascript:/i,
            /\.\./,  // Double dots
             
            /\x00/,  // Null byte
            /[\r\n]/  // Line breaks
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
                return helpers.error('string.email');
            }
        }

        return value;
    })
    .required();

/**
 * Joi schema for Discord ID validation
 */
export const discordIdSchema = Joi.string()
    .pattern(/^\d{17,19}$/, 'Discord ID format')
    .required()
    .messages({
        'string.pattern.name': 'Discord ID must be 17-19 digits'
    });

/**
 * Joi schema for Discord username validation
 */
export const discordUsernameSchema = Joi.string()
    .min(2)
    .max(32)
    .pattern(/^[^<>@]{2,32}$/, 'valid Discord username')
    .custom((value, helpers) => {
        const suspiciousPatterns = [
            /javascript:/i,
             
            /\x00/,
            /@{2,}/
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
                return helpers.error('string.pattern.name');
            }
        }

        return value;
    })
    .required();

/**
 * Joi schema for secure filename validation
 */
export const secureFilenameSchema = Joi.string()
    .max(255)
     
    .pattern(/^[^<>:"|?*\x00-\x1f\/\\]+$/, 'valid filename')
    .custom((value, helpers) => {
        // Check for path traversal
        if (value.includes('..')) {
            return helpers.error('string.pattern.name');
        }

        // Check for hidden files
        if (value.startsWith('.')) {
            return helpers.error('string.pattern.name');
        }

        // Check for executable extensions
        if (/\.(exe|bat|cmd|sh|ps1|vbs|js|jar)$/i.test(value)) {
            return helpers.error('string.pattern.name');
        }

        return value;
    })
    .required()
    .messages({
        'string.pattern.name': 'Filename contains invalid characters or patterns'
    });

/**
 * Joi schema for phone number validation
 */
export const phoneNumberSchema = Joi.string()
    .pattern(/^\+?\(?\d{1,4}\)?[-\s.]?\(?\d{1,4}\)?[-\s.]?\d{1,9}$/, 'phone number')
    .custom((value, helpers) => {
        // No letters allowed
        if (/[a-zA-Z]/.test(value)) {
            return helpers.error('string.pattern.name');
        }

        // Check for suspicious patterns
        const suspiciousPatterns = [
            /[<>]/,
            /javascript:/i
        ];

        for (const pattern of suspiciousPatterns) {
            if (pattern.test(value)) {
                return helpers.error('string.pattern.name');
            }
        }

        return value;
    })
    .required()
    .messages({
        'string.pattern.name': 'Invalid phone number format'
    });

/**
 * Sanitize string for XSS prevention (idempotent — safe to call multiple times)
 */
export const sanitizeString = (value: string): string => {
    if (typeof value !== 'string') {
        return value;
    }

    // First, decode any existing HTML entities to avoid multi-encoding
    // (e.g. &amp; → &, &lt; → <, etc.)
    // This makes the function idempotent so repeated sanitization doesn't produce
    // &amp;amp;amp;... chains.
    const decoded = value
        .replaceAll('&#x27;', "'")
        .replaceAll('&quot;', '"')
        .replaceAll('&gt;', '>')
        .replaceAll('&lt;', '<')
        .replaceAll('&amp;', '&');

    // HTML encode special characters to prevent XSS
    // Note: Forward slash (/) encoding removed — it breaks URLs and is redundant
    // when < and > are already encoded (prevents </script> injection).
    return decoded
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#x27;');
};

/**
 * Joi schema for sanitized string
 */
export const sanitizedStringSchema = Joi.string()
    .custom((value, _helpers) => sanitizeString(value));

/**
 * Remove SQL/NoSQL injection patterns
 */
export const removeSQLPatterns = (value: string): string => {
    if (typeof value !== 'string') {
        return value;
    }

    let sanitized = value;
    
    // Remove SQL keywords
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi, '');
    
    // Remove MongoDB operators
    sanitized = sanitized.replace(/\$\w+/g, '');
    
    // Remove script tags
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    return sanitized;
};

/**
 * Sanitize filename
 */
export const sanitizeFilename = (filename: string): string => {
    // Remove path components
     
    let sanitized = filename.replace(/^.*[\/\\]/, '');
    
    // Remove invalid characters
     
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
    
    // Remove leading dots and spaces
    sanitized = sanitized.replace(/^[\s.]+/, '');
    
    // Limit length
    if (sanitized.length > 255) {
        const ext = sanitized.split('.').pop() || '';
        const base = sanitized.substring(0, 255 - ext.length - 1);
        sanitized = `${base}.${ext}`;
    }
    
    return sanitized || 'unnamed';
};

/**
 * Sanitize URL
 */
export const sanitizeURL = (url: string): string => {
    try {
        const parsedUrl = new URL(url);
        
        // Only allow http and https
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return '';
        }
        
        // Reconstruct URL with only safe components
        let sanitized = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
        
        // Add query string if present
        if (parsedUrl.search) {
            sanitized += parsedUrl.search;
        }
        
        // Add fragment if present
        if (parsedUrl.hash) {
            sanitized += parsedUrl.hash;
        }
        
        return sanitized;
    } catch {
        return '';
    }
};

/**
 * Validation helper functions object
 * @internal - Internal object. Use getJoiValidators() to access the singleton instance
 * or import individual validators directly (e.g., secureEmailSchema, isPrivateIP)
 */
const joiValidators = {
    secureUrlSchema,
    secureEmailSchema,
    discordIdSchema,
    discordUsernameSchema,
    secureFilenameSchema,
    phoneNumberSchema,
    sanitizedStringSchema,
    sanitizeString,
    removeSQLPatterns,
    sanitizeFilename,
    sanitizeURL,
    isPrivateIP,
    isLocalhost
};

/**
 * Validation helper functions singleton instance
 * Initialized after joiValidators object is defined
 */
let _joiValidatorsInstance: typeof joiValidators | null = null;

/**
 * Get the singleton instance of joiValidators
 * This ensures consistent validation behavior across the application
 * 
 * @returns The singleton joiValidators instance
 * 
 * @example
 * // Recommended: Use singleton getter for multiple validators
 * import { getJoiValidators } from './joiValidators';
 * const validators = getJoiValidators();
 * validators.secureEmailSchema.validate('test@example.com');
 * 
 * @example
 * // Alternative: Import individual validators (also uses singleton)
 * import { secureEmailSchema, isPrivateIP } from './joiValidators';
 * secureEmailSchema.validate('test@example.com');
 */
export const getJoiValidators = () => {
    _joiValidatorsInstance ??= joiValidators;
    return _joiValidatorsInstance;
};

// Export the singleton instance as default
// This maintains backward compatibility while ensuring singleton behavior
