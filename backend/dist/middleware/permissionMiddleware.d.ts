import { NextFunction, Response } from 'express';
import { AuthRequest } from './auth';
export declare const requirePermission: (resource: string, action: string) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireSecurityLevel: (minLevel: number) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requireInterOrgAccess: (resourceType: string, accessLevel: string, requiredSecurityLevel?: number) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=permissionMiddleware.d.ts.map