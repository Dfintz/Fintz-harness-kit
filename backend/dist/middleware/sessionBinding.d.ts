import { NextFunction, Request, Response } from 'express';
import { AuthRequest } from './auth';
export interface SessionBinding {
    ipHash: string;
    uaHash: string;
    deviceHash?: string;
}
export declare const generateBindingHash: (value: string) => string;
export declare const createSessionBinding: (req: Request) => SessionBinding;
export interface SessionBindingConfig {
    validateIp: boolean;
    validateUserAgent: boolean;
    validateDeviceFingerprint: boolean;
    allowSubnetChange: boolean;
    warnOnly: boolean;
}
export declare const validateSessionBinding: (stored: SessionBinding, current: SessionBinding, config?: SessionBindingConfig) => {
    valid: boolean;
    mismatches: string[];
};
export declare const sessionBindingMiddleware: (config?: Partial<SessionBindingConfig>) => (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const addSessionBindingToPayload: (payload: Record<string, unknown>, req: Request) => Record<string, unknown>;
declare module 'express' {
    interface Request {
        sessionBinding?: SessionBinding;
    }
}
//# sourceMappingURL=sessionBinding.d.ts.map