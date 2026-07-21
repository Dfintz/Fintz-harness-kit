import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
export declare const requireAdmin: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const logAdminMutation: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export declare const adminRateLimit: (maxRequests?: number, windowMs?: number) => (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=adminAuth.d.ts.map