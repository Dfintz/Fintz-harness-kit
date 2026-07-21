import { Response, NextFunction } from 'express';

import { logAuthorizationFailure } from '../utils/auditLogger';

import { AuthRequest } from './auth';

export const requireRole = (roles: string[]) => (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ message: 'Authentication required' });
            return;
        }

        if (!roles.includes(req.user.role)) {
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];
            
            // Log authorization failure
            logAuthorizationFailure(
                req.user.id,
                req.user.username,
                req.user.role,
                req.path,
                req.method,
                ipAddress,
                userAgent
            );
            
            res.status(403).json({ message: 'Insufficient permissions' });
            return;
        }

        next();
    };

export const requireAdmin = requireRole(['admin']);
export const requireModerator = requireRole(['admin', 'moderator']);
