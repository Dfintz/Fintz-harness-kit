import crypto from 'crypto';

import { Request, Response, NextFunction, RequestHandler } from 'express';

import { logger } from '../utils/logger';

/**
 * Webhook Signature Verification Middleware
 * 
 * Implements HMAC-SHA256 signature verification for incoming webhook payloads.
 * This middleware validates that webhook payloads come from trusted sources
 * by verifying the cryptographic signature.
 * 
 * Security Features:
 * - HMAC-SHA256 signature validation
 * - Constant-time comparison to prevent timing attacks
 * - Request body preservation for downstream handlers
 * - Configurable header names for different webhook providers
 */

export interface WebhookSignatureConfig {
    /** Header name containing the signature (default: 'x-webhook-signature') */
    signatureHeader?: string;
    /** Header name containing the timestamp (default: 'x-webhook-timestamp') */
    timestampHeader?: string;
    /** Maximum age of webhook in milliseconds (default: 5 minutes) */
    maxAge?: number;
    /** Function to get the secret for a given request */
    getSecret: (req: Request) => string | Promise<string>;
    /** Optional prefix for signature (e.g., 'sha256=') */
    signaturePrefix?: string;
    /** Algorithm to use for HMAC (default: 'sha256') */
    algorithm?: string;
}

const DEFAULT_CONFIG: Partial<WebhookSignatureConfig> = {
    signatureHeader: 'x-webhook-signature',
    timestampHeader: 'x-webhook-timestamp',
    maxAge: 5 * 60 * 1000, // 5 minutes
    signaturePrefix: 'sha256=',
    algorithm: 'sha256',
};

/**
 * Verify webhook signature using HMAC-SHA256
 * Uses constant-time comparison to prevent timing attacks
 */
function verifySignature(
    payload: string,
    signature: string,
    secret: string,
    algorithm: string = 'sha256',
    signaturePrefix: string = 'sha256='
): boolean {
    // Remove prefix if present
    const cleanSignature = signature.startsWith(signaturePrefix)
        ? signature.slice(signaturePrefix.length)
        : signature;

    // Generate expected signature
    const expectedSignature = crypto
        .createHmac(algorithm, secret)
        .update(payload, 'utf8')
        .digest('hex');

    // Check length first to prevent timing attacks from length differences
    if (cleanSignature.length !== expectedSignature.length) {
        return false;
    }

    // Use constant-time comparison
    try {
        return crypto.timingSafeEqual(
            Buffer.from(cleanSignature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    } catch {
        // timingSafeEqual can throw if buffers have different lengths
        // (shouldn't happen after length check, but defensive coding)
        return false;
    }
}

/**
 * Verify webhook timestamp is within acceptable range
 */
function verifyTimestamp(timestamp: string | number, maxAge: number): boolean {
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

/**
 * Create webhook signature verification middleware
 * 
 * @param config Configuration options for signature verification
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * // Basic usage with static secret
 * app.use('/webhook', verifyWebhookSignature({
 *   getSecret: () => process.env.WEBHOOK_SECRET
 * }));
 * 
 * // Advanced usage with per-webhook secret lookup
 * app.use('/webhook/:id', verifyWebhookSignature({
 *   getSecret: async (req) => {
 *     const webhook = await getWebhook(req.params.id);
 *     return webhook.secret;
 *   }
 * }));
 * ```
 */
export function verifyWebhookSignature(config: WebhookSignatureConfig): RequestHandler {
    const options = { ...DEFAULT_CONFIG, ...config };

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Get signature from header
            const signature = req.get(options.signatureHeader || 'x-webhook-signature');
            
            if (!signature) {
                logger.warn('Webhook request missing signature header', {
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

            // Get timestamp from header (if configured)
            const timestampHeader = req.get(options.timestampHeader || 'x-webhook-timestamp');
            
            if (timestampHeader && options.maxAge) {
                if (!verifyTimestamp(timestampHeader, options.maxAge)) {
                    logger.warn('Webhook request has expired or invalid timestamp', {
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

            // Get the raw body for signature verification
            // Note: For consistent signature verification, the sending party
            // should include the raw body in a custom header or the body parser
            // should preserve the raw body. This implementation handles both cases.
            let rawBody: string;
            
            // Check for raw body preserved by body-parser (if configured with verify)
            const rawBodyFromParser = (req as Request & { rawBody?: Buffer }).rawBody;
            if (rawBodyFromParser) {
                rawBody = rawBodyFromParser.toString('utf8');
            } else if (typeof req.body === 'string') {
                rawBody = req.body;
            } else {
                // Fallback: Use stringified body with sorted keys for consistency
                // Note: This may not match the original payload exactly.
                // For production use, configure body-parser to preserve raw body.
                rawBody = JSON.stringify(req.body, Object.keys(req.body).sort());
                logger.debug('Using sorted JSON stringify for webhook signature verification');
            }

            // Get the secret
            const secret = await Promise.resolve(options.getSecret(req));
            
            if (!secret) {
                logger.error('No webhook secret configured', {
                    path: req.path,
                });
                res.status(500).json({
                    error: 'Webhook verification not configured',
                    code: 'WEBHOOK_SECRET_MISSING',
                });
                return;
            }

            // Verify the signature
            const isValid = verifySignature(
                rawBody,
                signature,
                secret,
                options.algorithm,
                options.signaturePrefix
            );

            if (!isValid) {
                logger.warn('Webhook signature verification failed', {
                    path: req.path,
                    ip: req.ip,
                });
                res.status(401).json({
                    error: 'Invalid webhook signature',
                    code: 'WEBHOOK_SIGNATURE_INVALID',
                });
                return;
            }

            // Signature verified, continue
            logger.debug('Webhook signature verified successfully', {
                path: req.path,
            });
            
            next();
        } catch (error) {
            logger.error('Error verifying webhook signature:', error);
            res.status(500).json({
                error: 'Internal error verifying webhook',
                code: 'WEBHOOK_VERIFICATION_ERROR',
            });
        }
    };
}

/**
 * Generate HMAC-SHA256 signature for a payload
 * This can be used by the sender to sign outgoing webhooks
 * 
 * @param payload The payload to sign (string or object)
 * @param secret The secret key
 * @param options Signature options
 * @returns The signature with optional prefix
 */
export function generateWebhookSignature(
    payload: string | object,
    secret: string,
    options: { prefix?: string; algorithm?: string } = {}
): string {
    const { prefix = 'sha256=', algorithm = 'sha256' } = options;
    
    const payloadString = typeof payload === 'string' 
        ? payload 
        : JSON.stringify(payload);

    const signature = crypto
        .createHmac(algorithm, secret)
        .update(payloadString, 'utf8')
        .digest('hex');

    return `${prefix}${signature}`;
}

/**
 * Utility to create signed webhook headers
 * Useful for testing or sending webhooks to external services
 */
export function createSignedWebhookHeaders(
    payload: string | object,
    secret: string,
    options: { 
        signatureHeader?: string; 
        timestampHeader?: string;
        includeTimestamp?: boolean;
    } = {}
): Record<string, string> {
    const {
        signatureHeader = 'x-webhook-signature',
        timestampHeader = 'x-webhook-timestamp',
        includeTimestamp = true,
    } = options;

    const headers: Record<string, string> = {
        [signatureHeader]: generateWebhookSignature(payload, secret),
    };

    if (includeTimestamp) {
        headers[timestampHeader] = new Date().toISOString();
    }

    return headers;
}

