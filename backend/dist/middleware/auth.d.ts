import { NextFunction, Request, Response } from 'express';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
        discordId?: string;
        jti?: string;
        currentOrganizationId?: string;
        currentOrganizationName?: string;
        organizationIds?: string[];
        apiKeyId?: string;
        apiKeyScopes?: string[];
    };
    startTime?: number;
}
export declare const __resetSessionBindingWarnStateForTests: () => void;
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const generateToken: (payload: {
    id: string;
    username: string;
    role: string;
}) => string;
export declare const authenticate: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const authenticateWithTenant: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=auth.d.ts.map