import { Request, Response, NextFunction } from 'express';

import { UserActivityService, ActivityLogPayload } from '../services/user';
import { logger } from '../utils/logger';

/**
 * Extended request interface with user info
 */
interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: string;
    };
    startTime?: number;
}

/**
 * Activity Logger Middleware
 * Automatically logs user actions on protected routes
 */
export class ActivityLoggerMiddleware {
    private activityService: UserActivityService;
    private excludedPaths: Set<string>;
    private excludedMethods: Set<string>;

    constructor() {
        this.activityService = new UserActivityService();
        
        // Paths to exclude from activity logging (to reduce noise)
        this.excludedPaths = new Set([
            '/api/health',
            '/api/ping',
            '/api/status',
            '/api/users/me/activity', // Don't log activity history requests
        ]);

        // Methods to exclude (typically GET requests for read-only operations)
        this.excludedMethods = new Set([
            // Uncomment to exclude GET requests from logging
            // 'GET'
        ]);
    }

    /**
     * Determine action name from request
     * @param req Request object
     * @returns Action string
     */
    private determineAction(req: Request): string {
        const { method, path } = req;
        
        // Map common patterns to action names
        if (path.includes('/login')) {return 'auth.login';}
        if (path.includes('/logout')) {return 'auth.logout';}
        if (path.includes('/forgot-password')) {return 'auth.password_reset_requested';}
        if (path.includes('/reset-password')) {return 'auth.password_reset_completed';}
        if (path.includes('/change-password')) {return 'user.password_changed';}
        
        // Generic actions based on HTTP method
        switch (method) {
            case 'POST':
                return 'resource.created';
            case 'PATCH':
            case 'PUT':
                return 'resource.updated';
            case 'DELETE':
                return 'resource.deleted';
            case 'GET':
                return 'resource.viewed';
            default:
                return 'resource.accessed';
        }
    }

    /**
     * Check if request should be logged
     * @param req Request object
     * @returns True if should log, false otherwise
     */
    private shouldLog(req: AuthRequest): boolean {
        // Don't log if no authenticated user
        if (!req.user?.id) {
            return false;
        }

        // Check if path is excluded
        if (this.excludedPaths.has(req.path)) {
            return false;
        }

        // Check if method is excluded
        if (this.excludedMethods.has(req.method)) {
            return false;
        }

        return true;
    }

    /**
     * Log activity middleware
     * Captures request start time and sets up response logging
     */
    public logActivity = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        // Mark request start time
        req.startTime = Date.now();

        // Skip if shouldn't log
        if (!this.shouldLog(req)) {
            next();
            return;
        }

        const userId = req.user?.id;
        
        // Skip if no user (shouldn't happen on authenticated routes, but be safe)
        if (!userId) {
            next();
            return;
        }
        
        const action = this.determineAction(req);
        const resource = req.path;
        const method = req.method;
        const ipAddress = req.ip;
        const userAgent = req.get('user-agent');

        // Hook into response finish event to log after request completes
        const originalSend = res.send;
        let logged = false;
        const activityService = this.activityService;

        res.send = (function (this: Response, body: unknown): Response {
            if (!logged) {
                logged = true;
                const statusCode = res.statusCode;
                const duration = req.startTime ? Date.now() - req.startTime : undefined;

                // Log activity asynchronously (don't block response)
                setImmediate(async () => {
                    try {
                        const payload: ActivityLogPayload = {
                            userId,
                            action,
                            resource,
                            method,
                            ipAddress,
                            userAgent,
                            statusCode,
                            duration,
                            metadata: {
                                query: req.query,
                                params: req.params
                            }
                        };

                        await activityService?.logActivity(payload);
                    } catch (error) {
                        logger.error('Failed to log user activity:', error);
                        // Don't throw error - logging failure shouldn't affect request
                    }
                });
            }

            return originalSend.call(this, body);
        }).bind(res);

        next();
    };

    /**
     * Log specific action (for manual logging in controllers)
     * @param req Request object
     * @param action Action name
     * @param metadata Additional metadata
     */
    public static async logSpecificAction(
        req: AuthRequest,
        action: string,
        metadata?: Record<string, unknown>
    ): Promise<void> {
        if (!req.user?.id) {
            return;
        }

        const activityService = new UserActivityService();
        const payload: ActivityLogPayload = {
            userId: req.user.id,
            action,
            resource: req.path,
            method: req.method,
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            metadata
        };

        try {
            await activityService.logActivity(payload);
        } catch (error) {
            logger.error('Failed to log specific action:', error);
        }
    }
}

// Export singleton instance
export const activityLogger = new ActivityLoggerMiddleware().logActivity;

// Export static method for manual logging
export const logSpecificAction = ActivityLoggerMiddleware.logSpecificAction;
