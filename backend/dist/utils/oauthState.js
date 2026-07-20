"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOAuthSecret = getOAuthSecret;
exports.generateOAuthState = generateOAuthState;
exports.validateOAuthState = validateOAuthState;
const node_crypto_1 = __importDefault(require("node:crypto"));
const logger_1 = require("./logger");
const STATE_MAX_AGE_MS = 10 * 60 * 1000;
const PROCESS_FALLBACK_SECRET = node_crypto_1.default.randomBytes(32).toString('hex');
function getOAuthSecret() {
    const secret = process.env.JWT_SECRET ?? process.env.COOKIE_SECRET;
    if (!secret) {
        logger_1.logger.warn('Neither JWT_SECRET nor COOKIE_SECRET is set — using per-process random secret for OAuth state. ' +
            'Set one of these environment variables for production use.');
        return PROCESS_FALLBACK_SECRET;
    }
    return secret;
}
function generateOAuthState(linkUserId) {
    const nonce = node_crypto_1.default.randomBytes(16).toString('hex');
    const timestamp = Date.now().toString(36);
    const parts = [nonce, timestamp];
    if (linkUserId) {
        parts.push(Buffer.from(linkUserId).toString('base64url'));
    }
    const payload = parts.join('.');
    const secret = getOAuthSecret();
    const signature = node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
    return `${payload}.${signature}`;
}
function validateOAuthState(state) {
    if (!state) {
        logger_1.logger.warn('OAuth state is missing');
        return { valid: false };
    }
    const parts = state.split('.');
    if (parts.length !== 3 && parts.length !== 4) {
        logger_1.logger.warn('OAuth state malformed', { partCount: parts.length });
        return { valid: false };
    }
    const signature = parts.at(-1) ?? '';
    const payload = parts.slice(0, -1).join('.');
    const timestamp = parts[1];
    const secret = getOAuthSecret();
    const expectedSignature = node_crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
    const sigValid = signature.length === expectedSignature.length &&
        node_crypto_1.default.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    if (!sigValid) {
        logger_1.logger.warn('OAuth state signature invalid');
        return { valid: false };
    }
    const stateTime = Number.parseInt(timestamp, 36);
    if (Number.isNaN(stateTime) || Date.now() - stateTime > STATE_MAX_AGE_MS) {
        logger_1.logger.warn('OAuth state expired', { ageMs: Date.now() - stateTime });
        return { valid: false };
    }
    let linkUserId;
    if (parts.length === 4) {
        try {
            linkUserId = Buffer.from(parts[2], 'base64url').toString('utf8');
        }
        catch {
            logger_1.logger.warn('OAuth state linkUserId decode failed');
            return { valid: false };
        }
    }
    return { valid: true, linkUserId };
}
//# sourceMappingURL=oauthState.js.map