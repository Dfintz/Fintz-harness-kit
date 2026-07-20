"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalSignatureDistributed = exports.criticalOperationSignatureDistributed = exports.optionalSignature = exports.criticalOperationSignature = void 0;
exports.generateRequestSignature = generateRequestSignature;
exports.validateRequestSignature = validateRequestSignature;
exports.requireSignedRequest = requireSignedRequest;
exports.generateNonce = generateNonce;
exports.signRequest = signRequest;
exports.validateRequestSignatureAsync = validateRequestSignatureAsync;
exports.requireSignedRequestDistributed = requireSignedRequestDistributed;
const crypto_1 = __importDefault(require("crypto"));
const NonceStorage_1 = require("../services/security/core/NonceStorage");
const logger_1 = require("../utils/logger");
const SIGNATURE_HEADER = 'x-request-signature';
const TIMESTAMP_HEADER = 'x-request-timestamp';
const NONCE_HEADER = 'x-request-nonce';
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;
const usedNonces = new Map();
const NONCE_CACHE_SIZE = 10000;
function cleanupNonces() {
    const now = Date.now();
    const expiredThreshold = now - MAX_TIMESTAMP_DRIFT_MS * 2;
    for (const [nonce, timestamp] of usedNonces.entries()) {
        if (timestamp < expiredThreshold) {
            usedNonces.delete(nonce);
        }
    }
}
setInterval(cleanupNonces, 5 * 60 * 1000).unref();
function generateRequestSignature(method, path, timestamp, body, secret) {
    const payload = `${timestamp}.${method.toUpperCase()}.${path}.${body}`;
    return crypto_1.default.createHmac('sha256', secret).update(payload).digest('hex');
}
function validateSignatureHeaders(signature, timestamp) {
    if (!signature) {
        return { isValid: false, error: 'Missing request signature' };
    }
    if (!timestamp) {
        return { isValid: false, error: 'Missing request timestamp' };
    }
    const requestTime = Number.parseInt(timestamp, 10);
    if (Number.isNaN(requestTime)) {
        return { isValid: false, error: 'Invalid timestamp format' };
    }
    const now = Date.now();
    const drift = Math.abs(now - requestTime);
    if (drift > MAX_TIMESTAMP_DRIFT_MS) {
        return { isValid: false, error: 'Request timestamp expired or too far in future' };
    }
    return { isValid: true, requestTime };
}
function compareSignatures(signature, expectedSignature) {
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    if (signatureBuffer.length !== expectedBuffer.length) {
        return { isValid: false, error: 'Invalid signature' };
    }
    if (!crypto_1.default.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return { isValid: false, error: 'Invalid signature' };
    }
    return { isValid: true };
}
function validateRequestSignature(req, secret) {
    const signature = req.get(SIGNATURE_HEADER) || undefined;
    const timestamp = req.get(TIMESTAMP_HEADER) || undefined;
    const nonce = req.get(NONCE_HEADER) || undefined;
    const headerCheck = validateSignatureHeaders(signature, timestamp);
    if (!headerCheck.isValid) {
        return headerCheck;
    }
    const validSignature = signature;
    const validTimestamp = timestamp;
    if (nonce) {
        if (usedNonces.has(nonce)) {
            return { isValid: false, error: 'Request nonce already used (replay attack prevented)' };
        }
        if (usedNonces.size >= NONCE_CACHE_SIZE) {
            cleanupNonces();
        }
        usedNonces.set(nonce, headerCheck.requestTime);
    }
    const body = req.body ? JSON.stringify(req.body) : '';
    const expectedSignature = generateRequestSignature(req.method, req.path, validTimestamp, body, secret);
    return compareSignatures(validSignature, expectedSignature);
}
function requireSignedRequest(options) {
    const secret = options?.secret || process.env.REQUEST_SIGNING_SECRET;
    const optional = options?.optional || false;
    if (!secret && process.env.NODE_ENV === 'production') {
        logger_1.logger.error('REQUEST_SIGNING_SECRET not configured in production environment. ' +
            'Requests to endpoints using this middleware will fail with 500 error. ' +
            'Set REQUEST_SIGNING_SECRET environment variable to enable request signing.');
    }
    return (req, res, next) => {
        if (!secret) {
            if (process.env.NODE_ENV === 'production') {
                logger_1.logger.error('Request signing failed - REQUEST_SIGNING_SECRET not configured');
                res.status(500).json({ error: 'Request signing not configured' });
                return;
            }
            logger_1.logger.debug('Request signing skipped - no secret configured');
            next();
            return;
        }
        const hasSignature = !!req.headers[SIGNATURE_HEADER];
        if (optional && !hasSignature) {
            next();
            return;
        }
        const result = validateRequestSignature(req, secret);
        if (!result.isValid) {
            const authReq = req;
            logger_1.logger.warn(`Request signature validation failed: ${result.error}`, {
                method: req.method,
                path: req.path,
                ip: req.ip,
                userId: authReq.user?.id,
            });
            res.status(401).json({
                error: 'Request signature validation failed',
                details: result.error,
            });
            return;
        }
        logger_1.logger.debug(`Request signature validated for ${req.method} ${req.path}`);
        next();
    };
}
exports.criticalOperationSignature = requireSignedRequest({ optional: false });
exports.optionalSignature = requireSignedRequest({ optional: true });
function generateNonce() {
    return crypto_1.default.randomBytes(16).toString('hex');
}
function signRequest(method, path, body, secret) {
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const bodyStr = body ? JSON.stringify(body) : '';
    const signature = generateRequestSignature(method, path, timestamp, bodyStr, secret);
    return {
        [SIGNATURE_HEADER]: signature,
        [TIMESTAMP_HEADER]: timestamp,
        [NONCE_HEADER]: nonce,
    };
}
async function validateRequestSignatureAsync(req, secret) {
    const signature = req.get(SIGNATURE_HEADER) || undefined;
    const timestamp = req.get(TIMESTAMP_HEADER) || undefined;
    const nonce = req.get(NONCE_HEADER) || undefined;
    const headerCheck = validateSignatureHeaders(signature, timestamp);
    if (!headerCheck.isValid) {
        return headerCheck;
    }
    const validSignature = signature;
    const validTimestamp = timestamp;
    if (nonce) {
        const nonceStorage = (0, NonceStorage_1.getNonceStorage)();
        const isReplay = await nonceStorage.checkAndMark(nonce, headerCheck.requestTime);
        if (isReplay) {
            return { isValid: false, error: 'Request nonce already used (replay attack prevented)' };
        }
    }
    const body = req.body ? JSON.stringify(req.body) : '';
    const expectedSignature = generateRequestSignature(req.method, req.path, validTimestamp, body, secret);
    return compareSignatures(validSignature, expectedSignature);
}
function requireSignedRequestDistributed(options) {
    const secret = options?.secret || process.env.REQUEST_SIGNING_SECRET;
    const optional = options?.optional || false;
    if (!secret && process.env.NODE_ENV === 'production') {
        logger_1.logger.error('REQUEST_SIGNING_SECRET not configured in production environment. ' +
            'Requests to endpoints using this middleware will fail with 500 error.');
    }
    return async (req, res, next) => {
        if (!secret) {
            if (process.env.NODE_ENV === 'production') {
                logger_1.logger.error('Request signing failed - REQUEST_SIGNING_SECRET not configured');
                res.status(500).json({ error: 'Request signing not configured' });
                return;
            }
            logger_1.logger.debug('Request signing skipped - no secret configured');
            next();
            return;
        }
        const hasSignature = !!req.headers[SIGNATURE_HEADER];
        if (optional && !hasSignature) {
            next();
            return;
        }
        const result = await validateRequestSignatureAsync(req, secret);
        if (!result.isValid) {
            const authReq = req;
            logger_1.logger.warn(`Request signature validation failed: ${result.error}`, {
                method: req.method,
                path: req.path,
                ip: req.ip,
                userId: authReq.user?.id,
            });
            res.status(401).json({
                error: 'Request signature validation failed',
                details: result.error,
            });
            return;
        }
        logger_1.logger.debug(`Request signature validated for ${req.method} ${req.path}`);
        next();
    };
}
exports.criticalOperationSignatureDistributed = requireSignedRequestDistributed({
    optional: false,
});
exports.optionalSignatureDistributed = requireSignedRequestDistributed({ optional: true });
//# sourceMappingURL=requestSigning.js.map