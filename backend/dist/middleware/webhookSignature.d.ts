import { Request, RequestHandler } from 'express';
export interface WebhookSignatureConfig {
    signatureHeader?: string;
    timestampHeader?: string;
    maxAge?: number;
    getSecret: (req: Request) => string | Promise<string>;
    signaturePrefix?: string;
    algorithm?: string;
}
export declare function verifyWebhookSignature(config: WebhookSignatureConfig): RequestHandler;
export declare function generateWebhookSignature(payload: string | object, secret: string, options?: {
    prefix?: string;
    algorithm?: string;
}): string;
export declare function createSignedWebhookHeaders(payload: string | object, secret: string, options?: {
    signatureHeader?: string;
    timestampHeader?: string;
    includeTimestamp?: boolean;
}): Record<string, string>;
//# sourceMappingURL=webhookSignature.d.ts.map