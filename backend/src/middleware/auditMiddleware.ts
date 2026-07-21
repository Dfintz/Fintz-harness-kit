import { Response, NextFunction } from 'express';

import { logSensitiveDataAccess } from '../utils/auditLogger';

import { AuthRequest } from './auth';

// Resources that are considered sensitive
const SENSITIVE_RESOURCES = [
    '/api/users',
    '/api/organizations',
    '/api/fleets',
    '/api/events',
    '/api/discord',
    '/api/orgRelationships',
    '/api/userShips',
];

/**
 * Middleware to log access to sensitive data
 * Should be applied after authentication middleware
 */
export const auditSensitiveDataAccess = (req: AuthRequest, res: Response, next: NextFunction): void => {
    // Only log if user is authenticated
    if (!req.user) {
        next();
        return;
    }

    const path = req.path;
    const isSensitiveResource = SENSITIVE_RESOURCES.some(resource => path.startsWith(resource));

    // Only log for sensitive resources and non-GET methods (modifications)
    // or GET methods that access specific user data
    if (isSensitiveResource) {
        const shouldLog = 
            req.method !== 'GET' || // All modifications (POST, PUT, DELETE)
            path.match(/\/users\/[^/]+$/) || // Specific user access
            path.match(/\/organizations\/[^/]+$/) || // Specific org access
            path.match(/\/fleets\/[^/]+$/); // Specific fleet access

        if (shouldLog) {
            const ipAddress = req.ip || req.socket.remoteAddress;
            const userAgent = req.headers['user-agent'];

            // Determine action based on HTTP method
            let action = req.method;
            if (req.method === 'GET') {action = 'READ';}
            if (req.method === 'POST') {action = 'CREATE';}
            if (req.method === 'PUT' || req.method === 'PATCH') {action = 'UPDATE';}
            if (req.method === 'DELETE') {action = 'DELETE';}

            logSensitiveDataAccess(
                req.user.id,
                req.user.username,
                path,
                action,
                ipAddress,
                userAgent,
                {
                    method: req.method,
                    params: req.params,
                    // Don't log body to avoid logging sensitive data like passwords
                }
            );
        }
    }

    next();
};
