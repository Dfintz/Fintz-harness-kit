import { URL } from 'url';
export interface UrlValidationOptions {
    allowPrivateIps?: boolean;
    allowLocalhost?: boolean;
    allowedHosts?: string[];
    requireHttps?: boolean;
}
export declare class UrlValidationError extends Error {
    constructor(message: string);
}
export declare function validateUrl(urlString: string, options?: UrlValidationOptions): URL;
export declare function validateWebhookUrl(urlString: string): URL;
export declare function validateExternalIntegrationUrl(urlString: string, allowedHosts?: string[]): URL;
//# sourceMappingURL=urlValidator.d.ts.map