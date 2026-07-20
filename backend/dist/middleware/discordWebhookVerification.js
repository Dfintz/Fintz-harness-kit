"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordWebhookVerification = discordWebhookVerification;
const node_crypto_1 = __importDefault(require("node:crypto"));
const logger_1 = require("../utils/logger");
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000;
function verifyDiscordSignature(publicKey, signature, timestamp, rawBody) {
    try {
        const message = Buffer.concat([Buffer.from(timestamp, 'utf-8'), rawBody]);
        const signatureBuffer = Buffer.from(signature, 'hex');
        const ed25519SpkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
        const rawKey = Buffer.from(publicKey, 'hex');
        const derKey = Buffer.concat([ed25519SpkiPrefix, rawKey]);
        const keyObject = node_crypto_1.default.createPublicKey({
            key: derKey,
            format: 'der',
            type: 'spki',
        });
        return node_crypto_1.default.verify(null, message, keyObject, signatureBuffer);
    }
    catch (error) {
        logger_1.logger.warn('Discord webhook Ed25519 signature verification failed', {
            error: error instanceof Error ? error.message : String(error),
        });
        return false;
    }
}
function discordWebhookVerification() {
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (!publicKey) {
        logger_1.logger.warn('DISCORD_PUBLIC_KEY not set — Discord webhook event endpoint will reject all requests');
    }
    return (req, res, next) => {
        if (!publicKey) {
            logger_1.logger.error('DISCORD_PUBLIC_KEY not configured — rejecting webhook event');
            res.status(500).json({ error: 'Webhook verification not configured' });
            return;
        }
        const signature = req.headers['x-signature-ed25519'];
        const timestamp = req.headers['x-signature-timestamp'];
        if (!signature || !timestamp) {
            logger_1.logger.warn('Discord webhook missing signature headers');
            res.status(401).json({ error: 'Missing signature headers' });
            return;
        }
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        if (!verifyDiscordSignature(publicKey, signature, timestamp, rawBody)) {
            logger_1.logger.warn('Discord webhook signature verification failed');
            res.status(401).json({ error: 'Invalid signature' });
            return;
        }
        const timestampMs = Number(timestamp) * 1000;
        const now = Date.now();
        if (Number.isNaN(timestampMs) || Math.abs(now - timestampMs) > MAX_TIMESTAMP_AGE_MS) {
            logger_1.logger.warn('Discord webhook timestamp out of range', {
                timestamp,
                ageMs: now - timestampMs,
            });
            res.status(401).json({ error: 'Timestamp out of range' });
            return;
        }
        let parsedBody;
        try {
            parsedBody = JSON.parse(rawBody.toString('utf-8'));
        }
        catch {
            logger_1.logger.warn('Discord webhook body is not valid JSON');
            res.status(400).json({ error: 'Invalid JSON body' });
            return;
        }
        if (parsedBody.type === 0) {
            logger_1.logger.info('Discord webhook PING received — acknowledging');
            res.setHeader('Content-Type', 'application/json');
            res.status(204).end();
            return;
        }
        req.body = parsedBody;
        next();
    };
}
//# sourceMappingURL=discordWebhookVerification.js.map