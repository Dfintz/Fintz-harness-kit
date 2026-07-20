"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJoiValidators = exports.sanitizeURL = exports.sanitizeFilename = exports.removeSQLPatterns = exports.sanitizedStringSchema = exports.sanitizeString = exports.phoneNumberSchema = exports.secureFilenameSchema = exports.discordUsernameSchema = exports.discordIdSchema = exports.secureEmailSchema = exports.secureUrlSchema = exports.JoiExtended = exports.isLocalhost = exports.isPrivateIP = void 0;
const node_url_1 = require("node:url");
const joi_1 = __importDefault(require("joi"));
const _urlExtension = (joi) => ({
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
            method(value, helpers, args) {
                const options = args.options ?? {
                    protocols: ['http', 'https'],
                    requireProtocol: true,
                    allowCredentials: false
                };
                try {
                    const parsedUrl = new node_url_1.URL(value);
                    const protocol = parsedUrl.protocol.replace(':', '');
                    if (!options.protocols.includes(protocol)) {
                        return helpers.error('secureUrl.dangerousProtocol');
                    }
                    if (!options.allowCredentials && (parsedUrl.username || parsedUrl.password)) {
                        return helpers.error('secureUrl.invalid');
                    }
                    if ((0, exports.isPrivateIP)(parsedUrl.hostname)) {
                        return helpers.error('secureUrl.privateIP');
                    }
                    if ((0, exports.isLocalhost)(parsedUrl.hostname)) {
                        return helpers.error('secureUrl.localhost');
                    }
                    const dangerousProtocols = ['file:', 'javascript:', 'data:', 'vbscript:'];
                    if (dangerousProtocols.includes(parsedUrl.protocol)) {
                        return helpers.error('secureUrl.dangerousProtocol');
                    }
                    const suspiciousPatterns = [
                        /\s/,
                        /[<>]/,
                        /javascript:/i,
                        /data:/i,
                        /vbscript:/i,
                        /\x00/,
                        /[\r\n]/
                    ];
                    for (const pattern of suspiciousPatterns) {
                        if (pattern.test(value)) {
                            return helpers.error('secureUrl.suspicious');
                        }
                    }
                    return value;
                }
                catch {
                    return helpers.error('secureUrl.invalid');
                }
            }
        }
    }
});
const isPrivateIP = (hostname) => {
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
exports.isPrivateIP = isPrivateIP;
const isLocalhost = (hostname) => {
    const localhostPatterns = [
        'localhost',
        '127.0.0.1',
        '::1',
        '0.0.0.0',
        /^127\./,
        /^::ffff:127\./
    ];
    return localhostPatterns.some(pattern => typeof pattern === 'string' ? hostname === pattern : pattern.test(hostname));
};
exports.isLocalhost = isLocalhost;
const _joiExtendedInstance = joi_1.default;
exports.JoiExtended = _joiExtendedInstance;
exports.secureUrlSchema = joi_1.default.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2000)
    .custom((value, helpers) => {
    try {
        const parsedUrl = new node_url_1.URL(value);
        const hostname = parsedUrl.hostname.toLowerCase();
        if (parsedUrl.username || parsedUrl.password) {
            return helpers.error('string.uri');
        }
        if ((0, exports.isLocalhost)(hostname) || (0, exports.isPrivateIP)(hostname)) {
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
    }
    catch {
        return helpers.error('string.uri');
    }
}, 'secure URL validation')
    .required();
exports.secureEmailSchema = joi_1.default.string()
    .email({
    tlds: { allow: true },
    minDomainSegments: 2
})
    .max(254)
    .pattern(/^[^\s<>'"]+$/, 'no suspicious characters')
    .custom((value, helpers) => {
    const [localPart] = value.split('@');
    if (localPart.length > 64) {
        return helpers.error('string.email');
    }
    const suspiciousPatterns = [
        /javascript:/i,
        /\.\./,
        /\x00/,
        /[\r\n]/
    ];
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(value)) {
            return helpers.error('string.email');
        }
    }
    return value;
})
    .required();
exports.discordIdSchema = joi_1.default.string()
    .pattern(/^\d{17,19}$/, 'Discord ID format')
    .required()
    .messages({
    'string.pattern.name': 'Discord ID must be 17-19 digits'
});
exports.discordUsernameSchema = joi_1.default.string()
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
exports.secureFilenameSchema = joi_1.default.string()
    .max(255)
    .pattern(/^[^<>:"|?*\x00-\x1f\/\\]+$/, 'valid filename')
    .custom((value, helpers) => {
    if (value.includes('..')) {
        return helpers.error('string.pattern.name');
    }
    if (value.startsWith('.')) {
        return helpers.error('string.pattern.name');
    }
    if (/\.(exe|bat|cmd|sh|ps1|vbs|js|jar)$/i.test(value)) {
        return helpers.error('string.pattern.name');
    }
    return value;
})
    .required()
    .messages({
    'string.pattern.name': 'Filename contains invalid characters or patterns'
});
exports.phoneNumberSchema = joi_1.default.string()
    .pattern(/^\+?\(?\d{1,4}\)?[-\s.]?\(?\d{1,4}\)?[-\s.]?\d{1,9}$/, 'phone number')
    .custom((value, helpers) => {
    if (/[a-zA-Z]/.test(value)) {
        return helpers.error('string.pattern.name');
    }
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
const sanitizeString = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    const decoded = value
        .replaceAll('&#x27;', "'")
        .replaceAll('&quot;', '"')
        .replaceAll('&gt;', '>')
        .replaceAll('&lt;', '<')
        .replaceAll('&amp;', '&');
    return decoded
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#x27;');
};
exports.sanitizeString = sanitizeString;
exports.sanitizedStringSchema = joi_1.default.string()
    .custom((value, _helpers) => (0, exports.sanitizeString)(value));
const removeSQLPatterns = (value) => {
    if (typeof value !== 'string') {
        return value;
    }
    let sanitized = value;
    sanitized = sanitized.replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|DECLARE)\b)/gi, '');
    sanitized = sanitized.replace(/\$\w+/g, '');
    sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    sanitized = sanitized.replace(/javascript:/gi, '');
    return sanitized;
};
exports.removeSQLPatterns = removeSQLPatterns;
const sanitizeFilename = (filename) => {
    let sanitized = filename.replace(/^.*[\/\\]/, '');
    sanitized = sanitized.replace(/[<>:"|?*\x00-\x1f]/g, '');
    sanitized = sanitized.replace(/^[\s.]+/, '');
    if (sanitized.length > 255) {
        const ext = sanitized.split('.').pop() || '';
        const base = sanitized.substring(0, 255 - ext.length - 1);
        sanitized = `${base}.${ext}`;
    }
    return sanitized || 'unnamed';
};
exports.sanitizeFilename = sanitizeFilename;
const sanitizeURL = (url) => {
    try {
        const parsedUrl = new node_url_1.URL(url);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return '';
        }
        let sanitized = `${parsedUrl.protocol}//${parsedUrl.host}${parsedUrl.pathname}`;
        if (parsedUrl.search) {
            sanitized += parsedUrl.search;
        }
        if (parsedUrl.hash) {
            sanitized += parsedUrl.hash;
        }
        return sanitized;
    }
    catch {
        return '';
    }
};
exports.sanitizeURL = sanitizeURL;
const joiValidators = {
    secureUrlSchema: exports.secureUrlSchema,
    secureEmailSchema: exports.secureEmailSchema,
    discordIdSchema: exports.discordIdSchema,
    discordUsernameSchema: exports.discordUsernameSchema,
    secureFilenameSchema: exports.secureFilenameSchema,
    phoneNumberSchema: exports.phoneNumberSchema,
    sanitizedStringSchema: exports.sanitizedStringSchema,
    sanitizeString: exports.sanitizeString,
    removeSQLPatterns: exports.removeSQLPatterns,
    sanitizeFilename: exports.sanitizeFilename,
    sanitizeURL: exports.sanitizeURL,
    isPrivateIP: exports.isPrivateIP,
    isLocalhost: exports.isLocalhost
};
let _joiValidatorsInstance = null;
const getJoiValidators = () => {
    _joiValidatorsInstance ??= joiValidators;
    return _joiValidatorsInstance;
};
exports.getJoiValidators = getJoiValidators;
//# sourceMappingURL=joiValidators.js.map