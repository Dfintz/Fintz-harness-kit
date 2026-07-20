import { NextFunction, Response } from 'express';
import { IPWhitelistSettings } from '../models/Organization';
import { AuthRequest } from './auth';
export declare const requireOrgIPWhitelist: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const requirePermissionIPCheck: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare function validateIPWhitelistConfig(config: IPWhitelistSettings): string[];
//# sourceMappingURL=ipWhitelist.d.ts.map