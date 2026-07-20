import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
export interface TenantContext {
    organizationId: string;
    userId: string;
    userRole: string;
    securityLevel?: number;
    organizationRole?: string;
}
export interface TenantAuthRequest extends AuthRequest {
    tenantContext?: TenantContext;
}
declare global {
    namespace Express {
        interface Request {
            tenantContext?: TenantContext;
            crossTenantAccess?: {
                resourceOrgId: string;
                accessLevel: string;
                granted: boolean;
            };
        }
    }
}
export declare const tenantContext: (req: TenantAuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireTenantContext: (req: TenantAuthRequest, res: Response, next: NextFunction) => void;
export declare const requireOrganizationRole: (allowedRoles: string[]) => (req: TenantAuthRequest, res: Response, next: NextFunction) => void;
export declare const requireSecurityLevel: (minLevel: number) => (req: TenantAuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const getTenantContext: (req: TenantAuthRequest) => TenantContext | null;
export declare const getOrganizationId: (req: TenantAuthRequest) => string | null;
export declare const tenantContextMiddleware: (req: TenantAuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=tenantContext.d.ts.map