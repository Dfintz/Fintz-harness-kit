"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UrlValidationError = void 0;
exports.validateUrl = validateUrl;
exports.validateWebhookUrl = validateWebhookUrl;
exports.validateExternalIntegrationUrl = validateExternalIntegrationUrl;
const url_1 = require("url");
const logger_1 = require("./logger");
const PRIVATE_IP_RANGES = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fe80:/i,
    /^fc00:/i,
    /^fd00:/i,
];
const BLOCKED_HOSTNAMES = [
    'localhost',
    'metadata.google.internal',
    '169.254.169.254',
];
const ALLOWED_PROTOCOLS = ['http:', 'https:'];
class UrlValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'UrlValidationError';
    }
}
exports.UrlValidationError = UrlValidationError;
function isPrivateIp(hostname) {
    return PRIVATE_IP_RANGES.some(range => range.test(hostname));
}
function isBlockedHostname(hostname) {
    const lower = hostname.toLowerCase();
    return BLOCKED_HOSTNAMES.some(blocked => lower === blocked || lower.endsWith(`.${blocked}`));
}
function validateUrl(urlString, options = {}) {
    const { allowPrivateIps = false, allowLocalhost = false, allowedHosts = [], requireHttps = false, } = options;
    let url;
    try {
        url = new url_1.URL(urlString);
    }
    catch (error) {
        logger_1.logger.warn('Invalid URL format:', { url: urlString, error });
        throw new UrlValidationError('Invalid URL format');
    }
    if (!ALLOWED_PROTOCOLS.includes(url.protocol)) {
        logger_1.logger.warn('Blocked protocol:', { url: urlString, protocol: url.protocol });
        throw new UrlValidationError(`Protocol ${url.protocol} is not allowed`);
    }
    if (requireHttps && url.protocol !== 'https:') {
        logger_1.logger.warn('HTTPS required:', { url: urlString });
        throw new UrlValidationError('HTTPS is required');
    }
    const hostname = url.hostname.toLowerCase();
    if (allowedHosts.length > 0) {
        const isAllowed = allowedHosts.some(allowed => {
            const lowerAllowed = allowed.toLowerCase();
            return hostname === lowerAllowed || hostname.endsWith(`.${lowerAllowed}`);
        });
        if (!isAllowed) {
            logger_1.logger.warn('Hostname not in allowlist:', { url: urlString, hostname });
            throw new UrlValidationError('Hostname is not allowed');
        }
        return url;
    }
    if (isBlockedHostname(hostname)) {
        logger_1.logger.warn('Blocked hostname detected:', { url: urlString, hostname });
        throw new UrlValidationError('Hostname is blocked');
    }
    if (!allowLocalhost && (hostname === 'localhost' || hostname.startsWith('127.'))) {
        logger_1.logger.warn('Localhost access blocked:', { url: urlString, hostname });
        throw new UrlValidationError('Localhost access is not allowed');
    }
    if (!allowPrivateIps && isPrivateIp(hostname)) {
        logger_1.logger.warn('Private IP address blocked:', { url: urlString, hostname });
        throw new UrlValidationError('Private IP addresses are not allowed');
    }
    if (urlString.includes('%') || urlString.includes('\\')) {
        const decodedUrl = decodeURIComponent(urlString);
        if (decodedUrl !== urlString) {
            try {
                return validateUrl(decodedUrl, options);
            }
            catch (_error) {
                logger_1.logger.warn('URL encoding bypass attempt:', { url: urlString, decoded: decodedUrl });
                throw new UrlValidationError('URL encoding bypass detected');
            }
        }
    }
    logger_1.logger.info('URL validated successfully:', { url: urlString, hostname });
    return url;
}
function validateWebhookUrl(urlString) {
    return validateUrl(urlString, {
        allowPrivateIps: false,
        allowLocalhost: false,
        requireHttps: process.env.NODE_ENV === 'production',
    });
}
function validateExternalIntegrationUrl(urlString, allowedHosts) {
    return validateUrl(urlString, {
        allowPrivateIps: false,
        allowLocalhost: false,
        allowedHosts,
        requireHttps: false,
    });
}
//# sourceMappingURL=urlValidator.js.map