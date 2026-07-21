/**
 * Secure Validators
 * Enhanced validation functions to prevent bypass attacks and security vulnerabilities
 * 
 * These validators use Joi-based validation with additional security checks to prevent:
 * - URL validation bypasses
 * - SSRF attacks
 * - XSS attacks
 * - Email validation bypasses
 * - Protocol confusion attacks
 */

import { URL } from 'url';

import { 
    secureUrlSchema,
    secureEmailSchema,
    discordIdSchema,
    discordUsernameSchema,
    secureFilenameSchema,
    phoneNumberSchema,
    sanitizeURL as joiSanitizeURL,
    sanitizeFilename as joiSanitizeFilename,
    isPrivateIP as joiIsPrivateIP,
    isLocalhost as joiIsLocalhost
} from './joiValidators';

/**
 * Enhanced URL validation that prevents bypass attacks
 * Uses Joi-based validation with custom security rules
 * 
 * @param url - URL string to validate
 * @param options - Validation options
 * @returns true if URL is valid and secure, false otherwise
 */
export const isSecureURL = (url: string, options?: {
    protocols?: string[];
    require_protocol?: boolean;
    require_host?: boolean;
    allow_fragments?: boolean;
    allow_query_components?: boolean;
    allow_credentials?: boolean;
}): boolean => {
    // Empty or too long
    if (!url || url.length > 2000) {
        return false;
    }

    // Use Joi schema for basic validation
    const { error } = secureUrlSchema.validate(url);
    if (error) {
        return false;
    }

    try {
        const parsedUrl = new URL(url);
        const defaultOptions = {
            protocols: ['http', 'https'],
            allow_credentials: false,
            ...options
        };

        // Verify protocol is in allowed list
        const protocol = parsedUrl.protocol.replace(':', '');
        if (!defaultOptions.protocols.includes(protocol)) {
            return false;
        }

        // Prevent credentials in URL if not allowed
        if (!defaultOptions.allow_credentials && (parsedUrl.username || parsedUrl.password)) {
            return false;
        }

        return true;
    } catch (_error) {
        return false;
    }
};

/**
 * Check if hostname is a private IP address or internal network
 * Re-exported from joiValidators for compatibility
 * 
 * @param hostname - Hostname or IP address to check
 * @returns true if private/internal, false otherwise
 */
export const isPrivateIP = joiIsPrivateIP;

/**
 * Check if hostname is localhost
 * Re-exported from joiValidators for compatibility
 * 
 * @param hostname - Hostname to check
 * @returns true if localhost, false otherwise
 */
export const isLocalhost = joiIsLocalhost;

/**
 * Sanitize URL to prevent XSS and other attacks
 * Uses Joi-based sanitization
 * 
 * @param url - URL to sanitize
 * @returns Sanitized URL or empty string if invalid
 */
export const sanitizeURL = joiSanitizeURL;

/**
 * Validate email with enhanced security checks
 * Uses Joi-based validation with custom security rules
 * 
 * @param email - Email address to validate
 * @returns true if valid and secure, false otherwise
 */
export const isSecureEmail = (email: string): boolean => {
    const { error } = secureEmailSchema.validate(email);
    return !error;
};

/**
 * Validate Discord ID format with security checks
 * Uses Joi-based validation
 * 
 * @param discordId - Discord ID to validate
 * @returns true if valid, false otherwise
 */
export const isSecureDiscordId = (discordId: string): boolean => {
    const { error } = discordIdSchema.validate(discordId);
    return !error;
};

/**
 * Validate Discord username format with security checks
 * Uses Joi-based validation
 * 
 * @param username - Discord username to validate
 * @returns true if valid, false otherwise
 */
export const isSecureDiscordUsername = (username: string): boolean => {
    const { error } = discordUsernameSchema.validate(username);
    return !error;
};

/**
 * Validate filename for security issues
 * Uses Joi-based validation
 * 
 * @param filename - Filename to validate
 * @returns true if secure, false otherwise
 */
export const isSecureFilename = (filename: string): boolean => {
    const { error } = secureFilenameSchema.validate(filename);
    return !error;
};

/**
 * Sanitize filename to prevent security issues
 * Uses Joi-based sanitization
 * 
 * @param filename - Filename to sanitize
 * @returns Sanitized filename
 */
export const sanitizeFilename = joiSanitizeFilename;

/**
 * Validate phone number with security checks
 * Uses Joi-based validation
 * 
 * @param phone - Phone number to validate
 * @returns true if valid, false otherwise
 */
export const isSecurePhoneNumber = (phone: string): boolean => {
    const { error } = phoneNumberSchema.validate(phone);
    return !error;
};

/**
 * Export all secure validators
 */
export const secureValidators = {
    isSecureURL,
    sanitizeURL,
    isSecureEmail,
    isSecureDiscordId,
    isSecureDiscordUsername,
    isSecureFilename,
    sanitizeFilename,
    isSecurePhoneNumber,
    isPrivateIP,
    isLocalhost
};

