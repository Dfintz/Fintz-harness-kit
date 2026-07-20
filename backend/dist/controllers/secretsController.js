"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsController = void 0;
const infrastructure_1 = require("../services/infrastructure");
const apiErrors_1 = require("../utils/apiErrors");
const auditLogger_1 = require("../utils/auditLogger");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
class SecretsController extends BaseController_1.BaseController {
    secretsManager;
    constructor() {
        super();
        this.secretsManager = infrastructure_1.SecretsManagerService.getInstance();
    }
    getSecretsStatus = async (req, res) => {
        await this.execute(req, res, async () => {
            const status = this.secretsManager.getStatus();
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
                userId: req.user?.id,
                message: 'Secrets status accessed'
            });
            res.json({
                message: 'Secrets status retrieved successfully',
                data: status
            });
        });
    };
    checkSecretsRotation = async (req, res) => {
        await this.execute(req, res, async () => {
            const maxAgeInDays = req.query.maxAge ? parseInt(req.query.maxAge, 10) : 90;
            if (isNaN(maxAgeInDays) || maxAgeInDays <= 0) {
                throw new apiErrors_1.ValidationError('maxAge must be a positive number');
            }
            const rotationStatus = await this.secretsManager.checkSecretsRotation(maxAgeInDays);
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
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
    rotateJwtSecret = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('User ID required');
            }
            if (!req.body || typeof req.body !== 'object') {
                throw new apiErrors_1.ValidationError('Invalid request body');
            }
            const { confirm } = req.body;
            if (typeof confirm !== 'boolean') {
                throw new apiErrors_1.ValidationError('Invalid confirmation value - must be a boolean');
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
                logger_1.logger.warn(`JWT secret rotated by user ${req.user.id}`);
                res.json({
                    message: 'JWT secret rotated successfully',
                    warning: 'All existing tokens are now invalid. Users must log in again.'
                });
            }
            else {
                throw new Error('Failed to rotate JWT secret - see server logs for details');
            }
        });
    };
    rotateEncryptionKey = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('User ID required');
            }
            if (!req.body || typeof req.body !== 'object') {
                throw new apiErrors_1.ValidationError('Invalid request body');
            }
            const { confirm } = req.body;
            if (typeof confirm !== 'boolean') {
                throw new apiErrors_1.ValidationError('Invalid confirmation value - must be a boolean');
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
                logger_1.logger.warn(`Encryption key rotated by user ${req.user.id}`);
                res.json({
                    message: 'Encryption key rotated successfully',
                    warning: 'Existing encrypted data must be re-encrypted with the new key.'
                });
            }
            else {
                throw new Error('Failed to rotate encryption key - see server logs for details');
            }
        });
    };
    rotateDbPassword = async (req, res) => {
        await this.execute(req, res, async () => {
            if (!req.user?.id) {
                throw new apiErrors_1.UnauthorizedError('User ID required');
            }
            if (!req.body || typeof req.body !== 'object') {
                throw new apiErrors_1.ValidationError('Invalid request body');
            }
            const { newPassword, confirm } = req.body;
            if (!newPassword || typeof newPassword !== 'string') {
                throw new apiErrors_1.ValidationError('New password required (must be a string)');
            }
            if (newPassword.length < 12) {
                throw new apiErrors_1.ValidationError('Password must be at least 12 characters long');
            }
            if (typeof confirm !== 'boolean') {
                throw new apiErrors_1.ValidationError('Invalid confirmation value - must be a boolean');
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
                logger_1.logger.warn(`Database password secret rotated by user ${req.user.id}`);
                res.json({
                    message: 'Database password secret rotated successfully',
                    warning: 'Ensure the database password was changed separately first.'
                });
            }
            else {
                throw new Error('Failed to rotate database password - see server logs for details');
            }
        });
    };
    reloadSecrets = async (req, res) => {
        await this.execute(req, res, async () => {
            await this.secretsManager.reloadSecrets();
            (0, auditLogger_1.logAuditEvent)({
                eventType: auditLogger_1.AuditEventType.SENSITIVE_DATA_ACCESS,
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
exports.SecretsController = SecretsController;
//# sourceMappingURL=secretsController.js.map