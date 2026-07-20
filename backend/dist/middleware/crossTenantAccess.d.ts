import { NextFunction, Request, Response } from 'express';
export interface CrossTenantAccessOptions {
    resourceType: string;
    action: 'read' | 'write' | 'delete';
    getResourceOrgId: (req: Request) => Promise<string | null>;
    requireSharing?: boolean;
    allowSameOrg?: boolean;
}
export declare const validateCrossTenantAccess: (options: CrossTenantAccessOptions) => (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const getActivityOrgId: (req: Request) => Promise<string | null>;
export declare const getShipLoadoutOrgId: (req: Request) => Promise<string | null>;
export declare const auditCrossTenantAccess: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=crossTenantAccess.d.ts.map