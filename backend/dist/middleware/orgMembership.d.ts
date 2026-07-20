import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
export interface OrgMembershipContext {
    organizationId: string;
    role?: string;
    securityLevel?: number;
}
declare global {
    namespace Express {
        interface Request {
            orgMembership?: OrgMembershipContext;
        }
    }
}
export declare const requireOrgMembership: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=orgMembership.d.ts.map