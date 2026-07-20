"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.secureValidators = exports.isSecurePhoneNumber = exports.sanitizeFilename = exports.isSecureFilename = exports.isSecureDiscordUsername = exports.isSecureDiscordId = exports.isSecureEmail = exports.sanitizeURL = exports.isLocalhost = exports.isPrivateIP = exports.isSecureURL = void 0;
const url_1 = require("url");
const joiValidators_1 = require("./joiValidators");
const isSecureURL = (url, options) => {
    if (!url || url.length > 2000) {
        return false;
    }
    const { error } = joiValidators_1.secureUrlSchema.validate(url);
    if (error) {
        return false;
    }
    try {
        const parsedUrl = new url_1.URL(url);
        const defaultOptions = {
            protocols: ['http', 'https'],
            allow_credentials: false,
            ...options
        };
        const protocol = parsedUrl.protocol.replace(':', '');
        if (!defaultOptions.protocols.includes(protocol)) {
            return false;
        }
        if (!defaultOptions.allow_credentials && (parsedUrl.username || parsedUrl.password)) {
            return false;
        }
        return true;
    }
    catch (_error) {
        return false;
    }
};
exports.isSecureURL = isSecureURL;
exports.isPrivateIP = joiValidators_1.isPrivateIP;
exports.isLocalhost = joiValidators_1.isLocalhost;
exports.sanitizeURL = joiValidators_1.sanitizeURL;
const isSecureEmail = (email) => {
    const { error } = joiValidators_1.secureEmailSchema.validate(email);
    return !error;
};
exports.isSecureEmail = isSecureEmail;
const isSecureDiscordId = (discordId) => {
    const { error } = joiValidators_1.discordIdSchema.validate(discordId);
    return !error;
};
exports.isSecureDiscordId = isSecureDiscordId;
const isSecureDiscordUsername = (username) => {
    const { error } = joiValidators_1.discordUsernameSchema.validate(username);
    return !error;
};
exports.isSecureDiscordUsername = isSecureDiscordUsername;
const isSecureFilename = (filename) => {
    const { error } = joiValidators_1.secureFilenameSchema.validate(filename);
    return !error;
};
exports.isSecureFilename = isSecureFilename;
exports.sanitizeFilename = joiValidators_1.sanitizeFilename;
const isSecurePhoneNumber = (phone) => {
    const { error } = joiValidators_1.phoneNumberSchema.validate(phone);
    return !error;
};
exports.isSecurePhoneNumber = isSecurePhoneNumber;
exports.secureValidators = {
    isSecureURL: exports.isSecureURL,
    sanitizeURL: exports.sanitizeURL,
    isSecureEmail: exports.isSecureEmail,
    isSecureDiscordId: exports.isSecureDiscordId,
    isSecureDiscordUsername: exports.isSecureDiscordUsername,
    isSecureFilename: exports.isSecureFilename,
    sanitizeFilename: exports.sanitizeFilename,
    isSecurePhoneNumber: exports.isSecurePhoneNumber,
    isPrivateIP: exports.isPrivateIP,
    isLocalhost: exports.isLocalhost
};
//# sourceMappingURL=secureValidators.js.map