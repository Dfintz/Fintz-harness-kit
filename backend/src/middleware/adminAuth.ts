/**
 * Admin Authentication Middleware
 * Ensures only admin users can access admin endpoints
 * Logs all admin actions for audit trail
 */

import { Response, NextFunction } from 'express';

import { AdminSecurityLogService, SecurityEventType } from '../services/admin/AdminSecurityLogService';
import { logger } from '../utils/logger';

import { AuthRequest } from './auth';

/**
 * Require system-level admin role
 *
 * NOTE: This checks the user's SYSTEM-LEVEL role (User.role field), not organization roles.
 * For organization-level permission checks, use requirePermission() middleware instead.
 *
 * System roles:
 * - 'admin': Platform administrator with full system access
 * - 'user': Standard user with organization membership access
 */
export const requireAdmin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    if (!req.user) {
        res.status(401).json({ message: 'Authentication required' });
        return;
    }

    // Check if user has system-level admin role (User.role field)
    // This is separate from organization-level roles (OrganizationMembership.roleId)
    if (req.user.role !== 'admin') {
        const ipAddress = req.ip || req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];
        
        // Log unauthorized admin access attempt
        AdminSecurityLogService.logEvent(
            SecurityEventType.PERMISSION_DENIED,
            req.user.id,
            'Attempted admin access without admin role',
            'failure',
            {
                resource: 'admin_portal',
                ipAddress,
                userAgent
            }
        );
        
        logger.warn('Non-admin user attempted admin access', {
            userId: req.user.id,
            role: req.user.role,
            path: req.path
        });
        
        res.status(403).json({
            message: 'Admin access required',
            code: 'ADMIN_ACCESS_DENIED'
        });
        return;
    }
    
    // Log admin access
    AdminSecurityLogService.logEvent(
        SecurityEventType.ADMIN_ACTION,
        req.user.id,
        `Admin accessed: ${req.method} ${req.path}`,
        'success',
        {
            resource: 'admin_portal',
            ipAddress: req.ip,
            userAgent: req.headers['user-agent']
        }
    );
    
    next();
};

/**
 * Log admin mutation (write operations)
 * Use this middleware for POST, PUT, PATCH, DELETE operations
 */
export const logAdminMutation = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    // Store original send function
    const originalSend = res.send;

    // Override send to capture response
    res.send = function(data: unknown): Response {
        // Log the mutation after response
        if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
            AdminSecurityLogService.logEvent(
                SecurityEventType.ADMIN_ACTION,
                req.user.id,
                `Admin mutation: ${req.method} ${req.path}`,
                'success',
                {
                    resource: req.params.id || req.body.id || 'unknown',
                    details: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode
                    }
                }
            );
        } else if (req.user && res.statusCode >= 400) {
            AdminSecurityLogService.logEvent(
                SecurityEventType.ADMIN_ACTION,
                req.user.id,
                `Admin mutation failed: ${req.method} ${req.path}`,
                'failure',
                {
                    resource: req.params.id || req.body.id || 'unknown',
                    details: {
                        method: req.method,
                        path: req.path,
                        statusCode: res.statusCode
                    }
                }
            );
        }
        
        // Call original send
        return originalSend.call(this, data);
    };
    
    next();
};

/**
 * Rate limiting for admin endpoints
 * Prevents abuse even from admin accounts
 */
const adminRateLimitStore = new Map<string, { count: number; resetAt: number }>();

export const adminRateLimit = (maxRequests: number = 100, windowMs: number = 60000) => async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            next();
            return;
        }
        
        const key = `admin:${req.user.id}`;
        const now = Date.now();
        
        let record = adminRateLimitStore.get(key);
        
        // Clean up or initialize
        if (!record || record.resetAt < now) {
            record = { count: 0, resetAt: now + windowMs };
            adminRateLimitStore.set(key, record);
        }
        
        record.count++;
        
        if (record.count > maxRequests) {
            // Log rate limit exceeded
            AdminSecurityLogService.logEvent(
                SecurityEventType.API_RATE_LIMIT_EXCEEDED,
                req.user.id,
                'Admin API rate limit exceeded',
                'failure',
                {
                    resource: 'admin_api',
                    details: {
                        limit: maxRequests,
                        window: `${windowMs}ms`
                    }
                }
            );
            
            res.status(429).json({
                message: 'Too many requests',
                retryAfter: Math.ceil((record.resetAt - now) / 1000)
            });
            return;
        }
        
        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', maxRequests.toString());
        res.setHeader('X-RateLimit-Remaining', (maxRequests - record.count).toString());
        res.setHeader('X-RateLimit-Reset', record.resetAt.toString());
        
        next();
    };
