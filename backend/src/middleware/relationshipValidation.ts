import { Request, Response, NextFunction } from 'express';

import { RelationshipType, RelationshipStatus } from '../models/OrganizationRelationship';
import { InteractionSentiment } from '../models/RelationshipHistory';

/**
 * Validate relationship creation data
 */
export const validateCreateRelationship = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { organizationId, targetOrganizationId, type } = req.body;

    const errors: string[] = [];

    if (!organizationId || typeof organizationId !== 'string') {
        errors.push('organizationId is required and must be a string');
    }

    if (!targetOrganizationId || typeof targetOrganizationId !== 'string') {
        errors.push('targetOrganizationId is required and must be a string');
    }

    if (organizationId === targetOrganizationId) {
        errors.push('Cannot create relationship with self');
    }

    if (!type || !Object.values(RelationshipType).includes(type)) {
        errors.push(`type must be one of: ${Object.values(RelationshipType).join(', ')}`);
    }

    if (req.body.status && !Object.values(RelationshipStatus).includes(req.body.status)) {
        errors.push(`status must be one of: ${Object.values(RelationshipStatus).join(', ')}`);
    }

    if (req.body.contactEmail && !isValidEmail(req.body.contactEmail)) {
        errors.push('contactEmail must be a valid email address');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }

    next();
};

/**
 * Validate relationship update data
 */
export const validateUpdateRelationship = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const errors: string[] = [];

    if (req.body.type && !Object.values(RelationshipType).includes(req.body.type)) {
        errors.push(`type must be one of: ${Object.values(RelationshipType).join(', ')}`);
    }

    if (req.body.status && !Object.values(RelationshipStatus).includes(req.body.status)) {
        errors.push(`status must be one of: ${Object.values(RelationshipStatus).join(', ')}`);
    }

    if (req.body.contactEmail && !isValidEmail(req.body.contactEmail)) {
        errors.push('contactEmail must be a valid email address');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }

    next();
};

/**
 * Validate interaction recording data
 */
export const validateRecordInteraction = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { sentiment, description } = req.body;
    const errors: string[] = [];

    if (!sentiment || !Object.values(InteractionSentiment).includes(sentiment)) {
        errors.push(`sentiment must be one of: ${Object.values(InteractionSentiment).join(', ')}`);
    }

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        errors.push('description is required and must be a non-empty string');
    }

    if (description && description.length > 1000) {
        errors.push('description must not exceed 1000 characters');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }

    next();
};

/**
 * Validate trust score update data
 */
export const validateUpdateTrustScore = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { delta, reason } = req.body;
    const errors: string[] = [];

    if (delta === undefined || typeof delta !== 'number') {
        errors.push('delta is required and must be a number');
    }

    if (delta && (delta < -100 || delta > 100)) {
        errors.push('delta must be between -100 and 100');
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        errors.push('reason is required and must be a non-empty string');
    }

    if (reason && reason.length > 500) {
        errors.push('reason must not exceed 500 characters');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }

    next();
};

/**
 * Validate UUID format
 */
export const validateUUID = (paramName: string) => (req: Request, res: Response, next: NextFunction) => {
        const uuid = req.params[paramName];
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuid || !uuidRegex.test(uuid)) {
            return res.status(400).json({
                success: false,
                error: `Invalid ${paramName} format. Must be a valid UUID.`
            });
        }

        next();
    };

/**
 * Validate terminate relationship data
 */
export const validateTerminateRelationship = (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    const { reason } = req.body;
    const errors: string[] = [];

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        errors.push('reason is required for terminating a relationship');
    }

    if (reason && reason.length > 500) {
        errors.push('reason must not exceed 500 characters');
    }

    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }

    next();
};

/**
 * Helper function to validate email format
 */
function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
