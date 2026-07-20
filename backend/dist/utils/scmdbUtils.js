"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseScmdbMissionUrl = parseScmdbMissionUrl;
exports.isValidScmdbUrl = isValidScmdbUrl;
exports.normalizeScmdbUrl = normalizeScmdbUrl;
function parseScmdbMissionUrl(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }
    const trimmed = input.trim();
    const urlPattern = /^https?:\/\/scmdb\.net(?:\/[a-z]{2})?\/contracts\/([a-zA-Z0-9_-]+)$/i;
    const urlMatch = trimmed.match(urlPattern);
    if (urlMatch && urlMatch[1]) {
        return urlMatch[1];
    }
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 0) {
        return trimmed;
    }
    return null;
}
function isValidScmdbUrl(input) {
    return parseScmdbMissionUrl(input) !== null;
}
function normalizeScmdbUrl(id) {
    const missionId = parseScmdbMissionUrl(id);
    if (!missionId) {
        return null;
    }
    return `https://scmdb.net/contracts/${missionId}`;
}
//# sourceMappingURL=scmdbUtils.js.map