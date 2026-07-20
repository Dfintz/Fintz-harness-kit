import { NextFunction, Request, Response } from 'express';
export interface ServiceIdentity {
    serviceId: string;
    serviceName: string;
    allowedEndpoints: string[];
    secret: string;
}
export declare function initializeServiceRegistry(services: ServiceIdentity[]): void;
export declare function loadServiceRegistryFromEnv(): void;
export declare function getService(serviceId: string): ServiceIdentity | null;
export interface InternalServiceValidationResult {
    isValid: boolean;
    serviceId?: string;
    serviceName?: string;
    error?: string;
}
export declare function generateInternalServiceSignature(serviceId: string, method: string, path: string, timestamp: string, body: string, secret: string): string;
export declare function validateInternalServiceRequest(req: Request): Promise<InternalServiceValidationResult>;
export interface InternalServiceRequest extends Request {
    internalService?: {
        serviceId: string;
        serviceName: string;
    };
}
export declare function requireInternalServiceAuth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function optionalInternalServiceAuth(): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function generateServiceNonce(): string;
export declare function signInternalServiceRequest(serviceId: string, method: string, path: string, body: object | null | undefined, secret: string): Record<string, string>;
export declare function isInternalServiceRequest(req: Request): boolean;
export declare function getInternalServiceIdentity(req: Request): {
    serviceId: string;
    serviceName: string;
} | null;
export declare const internalServiceAuthRequired: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const internalServiceAuthOptional: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=internalServiceAuth.d.ts.map