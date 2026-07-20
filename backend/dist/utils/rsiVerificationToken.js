"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRsiVerificationUrl = buildRsiVerificationUrl;
exports.extractRsiVerificationTokens = extractRsiVerificationTokens;
exports.containsRsiVerificationToken = containsRsiVerificationToken;
exports.someRsiVerificationTokenMatches = someRsiVerificationTokenMatches;
const urls_1 = require("../config/urls");
const RSI_VERIFICATION_TOKEN_PATTERN = /SCFM-[A-Z0-9]{8,24}/gi;
const RSI_VERIFICATION_LINK_PATH = '/verify/rsi';
function buildRsiVerificationUrl(token) {
    const normalizedToken = token.trim().toUpperCase();
    const base = (0, urls_1.getFrontendUrl)().replace(/\/+$/, '');
    return `${base}${RSI_VERIFICATION_LINK_PATH}/${normalizedToken}`;
}
function extractRsiVerificationTokens(text) {
    if (!text) {
        return [];
    }
    const matches = text.match(RSI_VERIFICATION_TOKEN_PATTERN) ?? [];
    const normalized = matches.map(match => match.toUpperCase());
    return [...new Set(normalized)];
}
function containsRsiVerificationToken(text, expectedToken) {
    const normalizedToken = expectedToken.trim().toUpperCase();
    if (!normalizedToken) {
        return false;
    }
    return extractRsiVerificationTokens(text).includes(normalizedToken);
}
function someRsiVerificationTokenMatches(text, matcher) {
    for (const token of extractRsiVerificationTokens(text)) {
        if (matcher(token)) {
            return true;
        }
    }
    return false;
}
//# sourceMappingURL=rsiVerificationToken.js.map