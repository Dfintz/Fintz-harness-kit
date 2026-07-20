"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFrontendUrl = getFrontendUrl;
exports.getBackendUrl = getBackendUrl;
function getFrontendUrl() {
    if (process.env.FRONTEND_URL) {
        return process.env.FRONTEND_URL;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    return isProduction ? 'https://fringecore.space' : 'http://localhost:3001';
}
function getBackendUrl() {
    if (process.env.BACKEND_URL) {
        return process.env.BACKEND_URL;
    }
    const isProduction = process.env.NODE_ENV === 'production';
    const port = process.env.PORT || '3000';
    return isProduction ? 'https://api.fringecore.space' : `http://localhost:${port}`;
}
//# sourceMappingURL=urls.js.map