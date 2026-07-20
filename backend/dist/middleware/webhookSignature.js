"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWebhookSignature = verifyWebhookSignature;
exports.generateWebhookSignature = generateWebhookSignature;
exports.createSignedWebhookHeaders = createSignedWebhookHeaders;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../utils/logger");
const DEFAULT_CONFIG = {
    signatureHeader: 'x-webhook-signature',
    timestampHeader: 'x-webhook-timestamp',
    maxAge: 5 * 60 * 1000,
    signaturePrefix: 'sha256=',
    algorithm: 'sha256',
};
function verifySignature(payload, signature, secret, algorithm = 'sha256', signaturePrefix = 'sha256=') {
    const cleanSignature = signature.startsWith(signaturePrefix)
        ? signature.slice(signaturePrefix.length)
        : signature;
    const expectedSignature = crypto_1.default
        .createHmac(algorithm, secret)
        .update(payload, 'utf8')
        .digest('hex');
    if (cleanSignature.length !== expectedSignature.length) {
        return false;
    }
    try {
        return crypto_1.default.timingSafeEqual(Buffer.from(cleanSignature, 'hex'), Buffer.from(expectedSignature, 'hex'));
    }
    catch {
        return false;
    }
}
function verifyTimestamp(timestamp, maxAge) {
    const webhookTime = typeof timestamp === 'string'
        ? new Date(timestamp).getTime()
        : timestamp;
    if (isNaN(webhookTime)) {
        return false;
    }
    const now = Date.now();
    const age = Math.abs(now - webhookTime);
    return age <= maxAge;
}
function verifyWebhookSignature(config) {
    const options = { ...DEFAULT_CONFIG, ...config };
    return async (req, res, next) => {
        try {
            const signature = req.get(options.signatureHeader || 'x-webhook-signature');
            if (!signature) {
                logger_1.logger.warn('Webhook request missing signature header', {
                    path: req.path,
                    ip: req.ip,
                    header: options.signatureHeader,
                });
                res.status(401).json({
                    error: 'Missing webhook signature',
                    code: 'WEBHOOK_SIGNATURE_MISSING',
                });
                return;
            }
            const timestampHeader = req.get(options.timestampHeader || 'x-webhook-timestamp');
            if (timestampHeader && options.maxAge) {
                if (!verifyTimestamp(timestampHeader, options.maxAge)) {
                    logger_1.logger.warn('Webhook request has expired or invalid timestamp', {
                        path: req.path,
                        ip: req.ip,
                        timestamp: timestampHeader,
                    });
                    res.status(401).json({
                        error: 'Webhook timestamp expired or invalid',
                        code: 'WEBHOOK_TIMESTAMP_INVALID',
                    });
                    return;
                }
            }
            let rawBody;
            const rawBodyFromParser = req.rawBody;
            if (rawBodyFromParser) {
                rawBody = rawBodyFromParser.toString('utf8');
            }
            else if (typeof req.body === 'string') {
                rawBody = req.body;
            }
            else {
                rawBody = JSON.stringify(req.body, Object.keys(req.body).sort());
                logger_1.logger.debug('Using sorted JSON stringify for webhook signature verification');
            }
            const secret = await Promise.resolve(options.getSecret(req));
            if (!secret) {
                logger_1.logger.error('No webhook secret configured', {
                    path: req.path,
                });
                res.status(500).json({
                    error: 'Webhook verification not configured',
                    code: 'WEBHOOK_SECRET_MISSING',
                });
                return;
            }
            const isValid = verifySignature(rawBody, signature, secret, options.algorithm, options.signaturePrefix);
            if (!isValid) {
                logger_1.logger.warn('Webhook signature verification failed', {
                    path: req.path,
                    ip: req.ip,
                });
                res.status(401).json({
                    error: 'Invalid webhook signature',
                    code: 'WEBHOOK_SIGNATURE_INVALID',
                });
                return;
            }
            logger_1.logger.debug('Webhook signature verified successfully', {
                path: req.path,
            });
            next();
        }
        catch (error) {
            logger_1.logger.error('Error verifying webhook signature:', error);
            res.status(500).json({
                error: 'Internal error verifying webhook',
                code: 'WEBHOOK_VERIFICATION_ERROR',
            });
        }
    };
}
function generateWebhookSignature(payload, secret, options = {}) {
    const { prefix = 'sha256=', algorithm = 'sha256' } = options;
    const payloadString = typeof payload === 'string'
        ? payload
        : JSON.stringify(payload);
    const signature = crypto_1.default
        .createHmac(algorithm, secret)
        .update(payloadString, 'utf8')
        .digest('hex');
    return `${prefix}${signature}`;
}
function createSignedWebhookHeaders(payload, secret, options = {}) {
    const { signatureHeader = 'x-webhook-signature', timestampHeader = 'x-webhook-timestamp', includeTimestamp = true, } = options;
    const headers = {
        [signatureHeader]: generateWebhookSignature(payload, secret),
    };
    if (includeTimestamp) {
        headers[timestampHeader] = new Date().toISOString();
    }
    return headers;
}
//# sourceMappingURL=webhookSignature.js.map