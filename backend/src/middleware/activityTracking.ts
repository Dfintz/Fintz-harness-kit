import { Request, Response, NextFunction } from 'express';

import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { logger } from '../utils/logger';

import { AuthRequest } from './auth';

/**
 * Middleware to track user activity
 * Updates the lastActiveAt timestamp for authenticated users
 * This runs after authentication and updates activity on every authenticated request
 */
export const trackUserActivity = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const authReq = req as AuthRequest;
    
    // Only track if user is authenticated
    if (!authReq.user?.id) {
        next();
        return;
    }

    try {
        const userRepo = AppDataSource.getRepository(User);
        
        // Update lastActiveAt asynchronously (don't block request)
        // Use void to explicitly ignore the promise
        void userRepo.update(
            { id: authReq.user.id },
            { lastActiveAt: new Date() }
        ).catch((error) => {
            // Log error but don't fail the request
            logger.warn('Failed to update user lastActiveAt', {
                userId: authReq.user?.id,
                error: error instanceof Error ? error.message : String(error)
            });
        });

        next();
    } catch (error) {
        // Log error but don't block the request
        logger.warn('Error in trackUserActivity middleware', {
            userId: authReq.user?.id,
            error: error instanceof Error ? error.message : String(error)
        });
        next();
    }
};
