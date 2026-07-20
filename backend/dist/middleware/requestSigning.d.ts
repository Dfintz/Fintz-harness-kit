import { NextFunction, Request, Response } from 'express';
export interface SignatureValidationResult {
    isValid: boolean;
    error?: string;
}
export declare function generateRequestSignature(method: string, path: string, timestamp: string, body: string, secret: string): string;
export declare function validateRequestSignature(req: Request, secret: string): SignatureValidationResult;
export declare function requireSignedRequest(options?: {
    secret?: string;
    optional?: boolean;
}): (req: Request, res: Response, next: NextFunction) => void;
export declare const criticalOperationSignature: (req: Request, res: Response, next: NextFunction) => void;
export declare const optionalSignature: (req: Request, res: Response, next: NextFunction) => void;
export declare function generateNonce(): string;
export declare function signRequest(method: string, path: string, body: object | undefined, secret: string): {
    [key: string]: string;
};
export declare function validateRequestSignatureAsync(req: Request, secret: string): Promise<SignatureValidationResult>;
export declare function requireSignedRequestDistributed(options?: {
    secret?: string;
    optional?: boolean;
}): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const criticalOperationSignatureDistributed: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const optionalSignatureDistributed: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=requestSigning.d.ts.map