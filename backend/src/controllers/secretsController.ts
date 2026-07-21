import { Response } from 'express';

import { AuthRequest } from '../middleware/auth';
import { SecretsManagerService } from '../services/infrastructure';
import { UnauthorizedError, ValidationError } from '../utils/apiErrors';
import { AuditEventType, logAuditEvent } from '../utils/auditLogger';
import { logger } from '../utils/logger';


import { BaseController } from './BaseController';

export interface SecretsStatus {
    isConfigured: boolean;
    secretsLoaded: string[];
    lastRotation?: Record<string, Date>;
}

/**
 * Controller for managing AWS Secrets Manager operations
 * Handles secret rotation for JWT, encryption keys, and database passwords
 */
export class SecretsController extends BaseController {
    private secretsManager: SecretsManagerService;

    constructor() {
        super();
        this.secretsManager = SecretsManagerService.getInstance();
    }

    /**
     * Get secrets management status
     * Admin only endpoint
     */
    getSecretsStatus = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const status = this.secretsManager.getStatus();

            logAuditEvent({
                eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
                userId: req.user?.id,
                message: 'Secrets status accessed'
            });

            res.json({
                message: 'Secrets status retrieved successfully',
                data: status
            });
        });
    };

    /**
     * Check which secrets need rotation
     * Admin only endpoint
     */
    checkSecretsRotation = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            const maxAgeInDays = req.query.maxAge ? parseInt(req.query.maxAge as string, 10) : 90;

            if (isNaN(maxAgeInDays) || maxAgeInDays <= 0) {
                throw new ValidationError('maxAge must be a positive number');
            }

            const rotationStatus = await this.secretsManager.checkSecretsRotation(maxAgeInDays);

            logAuditEvent({
                eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
                userId: req.user?.id,
                message: 'Secrets rotation status checked'
            });

            res.json({
                message: 'Secrets rotation status retrieved successfully',
                data: {
                    maxAgeInDays,
                    ...rotationStatus
                }
            });
        });
    };

    /**
     * Rotate JWT secret
     * Admin only endpoint - requires confirmation
     */
    rotateJwtSecret = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new UnauthorizedError('User ID required');
            }

            // Validate request body exists
            if (!req.body || typeof req.body !== 'object') {
                throw new ValidationError('Invalid request body');
            }

            const { confirm } = req.body;

            // Validate confirm is a boolean
            if (typeof confirm !== 'boolean') {
                throw new ValidationError('Invalid confirmation value - must be a boolean');
            }

            if (confirm !== true) {
                res.status(400).json({
                    message: 'Rotation confirmation required',
                    warning: 'Rotating JWT secret will invalidate all existing tokens. Users will need to log in again.',
                    instruction: 'Send { "confirm": true } to proceed'
                });
                return;
            }

            const success = await this.secretsManager.rotateJwtSecret(req.user.id);

            if (success) {
                logger.warn(`JWT secret rotated by user ${req.user.id}`);
                res.json({
                    message: 'JWT secret rotated successfully',
                    warning: 'All existing tokens are now invalid. Users must log in again.'
                });
            } else {
                throw new Error('Failed to rotate JWT secret - see server logs for details');
            }
        });
    };

    /**
     * Rotate encryption key
     * Admin only endpoint - requires confirmation
     */
    rotateEncryptionKey = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new UnauthorizedError('User ID required');
            }

            // Validate request body exists
            if (!req.body || typeof req.body !== 'object') {
                throw new ValidationError('Invalid request body');
            }

            const { confirm } = req.body;

            // Validate confirm is a boolean
            if (typeof confirm !== 'boolean') {
                throw new ValidationError('Invalid confirmation value - must be a boolean');
            }

            if (confirm !== true) {
                res.status(400).json({
                    message: 'Rotation confirmation required',
                    warning: 'Rotating encryption key requires re-encryption of existing data.',
                    instruction: 'Send { "confirm": true } to proceed'
                });
                return;
            }

            const success = await this.secretsManager.rotateEncryptionKey(req.user.id);

            if (success) {
                logger.warn(`Encryption key rotated by user ${req.user.id}`);
                res.json({
                    message: 'Encryption key rotated successfully',
                    warning: 'Existing encrypted data must be re-encrypted with the new key.'
                });
            } else {
                throw new Error('Failed to rotate encryption key - see server logs for details');
            }
        });
    };

    /**
     * Rotate database password
     * Admin only endpoint - requires confirmation and new password
     */
    rotateDbPassword = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new UnauthorizedError('User ID required');
            }

            // Validate request body exists
            if (!req.body || typeof req.body !== 'object') {
                throw new ValidationError('Invalid request body');
            }

            const { newPassword, confirm } = req.body;

            // Validate newPassword
            if (!newPassword || typeof newPassword !== 'string') {
                throw new ValidationError('New password required (must be a string)');
            }

            // Validate password strength (minimum requirements)
            if (newPassword.length < 12) {
                throw new ValidationError('Password must be at least 12 characters long');
            }

            // Validate confirm is a boolean
            if (typeof confirm !== 'boolean') {
                throw new ValidationError('Invalid confirmation value - must be a boolean');
            }

            if (confirm !== true) {
                res.status(400).json({
                    message: 'Rotation confirmation required',
                    warning: 'You must change the database password separately before rotating the secret.',
                    instruction: 'Send { "newPassword": "new-password", "confirm": true } to proceed'
                });
                return;
            }

            const success = await this.secretsManager.rotateDbPassword(newPassword, req.user.id);

            if (success) {
                logger.warn(`Database password secret rotated by user ${req.user.id}`);
                res.json({
                    message: 'Database password secret rotated successfully',
                    warning: 'Ensure the database password was changed separately first.'
                });
            } else {
                throw new Error('Failed to rotate database password - see server logs for details');
            }
        });
    };

    /**
     * Reload secrets from Key Vault
     * Admin only endpoint
     */
    reloadSecrets = async (req: AuthRequest, res: Response): Promise<void> => {
        await this.execute(req, res, async () => {
            await this.secretsManager.reloadSecrets();

            logAuditEvent({
                eventType: AuditEventType.SENSITIVE_DATA_ACCESS,
                userId: req.user?.id,
                message: 'Secrets reloaded from Key Vault'
            });

            res.json({
                message: 'Secrets reloaded successfully',
                data: this.secretsManager.getStatus()
            });
        });
    };
}