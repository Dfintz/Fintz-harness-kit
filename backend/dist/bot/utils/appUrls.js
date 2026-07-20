"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAppBaseUrl = getAppBaseUrl;
exports.buildAppUrl = buildAppUrl;
const PUBLIC_APP_FALLBACK = 'https://fringecore.space';
function getAppBaseUrl() {
    const base = process.env.APP_URL ?? process.env.FRONTEND_URL ?? PUBLIC_APP_FALLBACK;
    return base.replace(/\/$/, '');
}
function buildAppUrl(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${getAppBaseUrl()}${normalizedPath}`;
}
//# sourceMappingURL=appUrls.js.map