"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERACTION_ERROR_CLASSES = void 0;
exports.classifyInteractionError = classifyInteractionError;
exports.isUserCorrectable = isUserCorrectable;
const apiErrors_1 = require("../../utils/apiErrors");
exports.INTERACTION_ERROR_CLASSES = [
    'user_input',
    'permission',
    'not_found',
    'conflict',
    'rate_limit',
    'timeout',
    'dependency',
    'internal',
];
function classifyByStatus(statusCode) {
    if (statusCode === 400) {
        return 'user_input';
    }
    if (statusCode === 401 || statusCode === 403) {
        return 'permission';
    }
    if (statusCode === 404) {
        return 'not_found';
    }
    if (statusCode === 409) {
        return 'conflict';
    }
    if (statusCode === 429) {
        return 'rate_limit';
    }
    if (statusCode === 503) {
        return 'dependency';
    }
    return 'internal';
}
function classifyDiscordError(error) {
    const candidate = error;
    const name = error.name;
    if (name === 'RateLimitError') {
        return 'rate_limit';
    }
    const looksLikeDiscordHttp = name.startsWith('DiscordAPIError') ||
        name === 'HTTPError' ||
        (typeof candidate.status === 'number' &&
            ('rawError' in candidate || 'url' in candidate || 'requestBody' in candidate));
    if (!looksLikeDiscordHttp) {
        return null;
    }
    if (candidate.status === 429 || candidate.code === 429) {
        return 'rate_limit';
    }
    return 'dependency';
}
function isTimeoutError(error) {
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
        return true;
    }
    return /\btimed?\s?-?\s?out\b|\btimeout\b/i.test(error.message);
}
function classifyInteractionError(error) {
    if (error instanceof apiErrors_1.ApiError) {
        return classifyByStatus(error.statusCode);
    }
    const maybeStatus = error.statusCode;
    if (typeof maybeStatus === 'number') {
        return classifyByStatus(maybeStatus);
    }
    const discordClass = classifyDiscordError(error);
    if (discordClass) {
        return discordClass;
    }
    if (isTimeoutError(error)) {
        return 'timeout';
    }
    return 'internal';
}
function isUserCorrectable(errorClass) {
    return (errorClass === 'user_input' ||
        errorClass === 'permission' ||
        errorClass === 'not_found' ||
        errorClass === 'conflict');
}
//# sourceMappingURL=interactionErrorTaxonomy.js.map