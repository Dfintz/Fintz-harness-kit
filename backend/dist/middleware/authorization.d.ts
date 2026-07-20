import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
export declare const requireRole: (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireAdmin: (req: AuthRequest, res: Response, next: NextFunction) => void;
export declare const requireModerator: (req: AuthRequest, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authorization.d.ts.map