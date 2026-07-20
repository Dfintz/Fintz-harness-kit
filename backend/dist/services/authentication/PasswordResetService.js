"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordResetService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const typeorm_1 = require("typeorm");
const urls_1 = require("../../config/urls");
const data_source_1 = require("../../data-source");
const PasswordResetToken_1 = require("../../models/PasswordResetToken");
const User_1 = require("../../models/User");
const api_1 = require("../../types/api");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const logger_1 = require("../../utils/logger");
const email_1 = require("../communication/email");
const AccountSecurityService_1 = require("../security/core/AccountSecurityService");
class PasswordResetService {
    tokenRepository = data_source_1.AppDataSource.getRepository(PasswordResetToken_1.PasswordResetToken);
    userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
    TOKEN_EXPIRATION_HOURS = 1;
    MAX_ACTIVE_TOKENS = 3;
    async requestPasswordReset(email) {
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email })
            .getOne();
        if (!user) {
            return { message: 'If the email exists in our system, a password reset link has been sent.' };
        }
        await this.invalidateUserTokens(user.id);
        const token = this.generateSecureToken();
        const tokenHash = this.hashToken(token);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRATION_HOURS);
        const resetToken = this.tokenRepository.create({
            userId: user.id,
            token: tokenHash,
            expiresAt,
            used: false,
        });
        await this.tokenRepository.save(resetToken);
        await this.sendPasswordResetEmail(user, token);
        return { message: 'If the email exists in our system, a password reset link has been sent.' };
    }
    async verifyResetToken(token) {
        const tokenHash = this.hashToken(token);
        const resetToken = await this.tokenRepository.findOne({
            where: { token: tokenHash },
            relations: ['user'],
        });
        if (!resetToken) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.TOKEN_EXPIRED, 'Invalid or expired reset token', 400);
        }
        if (resetToken.used) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.TOKEN_EXPIRED, 'This reset token has already been used', 400);
        }
        if (resetToken.isExpired()) {
            throw new apiErrors_1.ApiError(api_1.ApiErrorCode.TOKEN_EXPIRED, 'This reset token has expired', 400);
        }
        return {
            valid: true,
            userId: resetToken.userId,
        };
    }
    async resetPassword(token, newPassword) {
        const { userId } = await this.verifyResetToken(token);
        const user = await this.userRepository.findOne({ where: { id: userId } });
        if (!user) {
            throw new apiErrors_1.NotFoundError('User');
        }
        const securityService = AccountSecurityService_1.AccountSecurityService.getInstance();
        const isPasswordAllowed = await securityService.checkPasswordHistory(userId, newPassword);
        if (!isPasswordAllowed) {
            throw new apiErrors_1.ValidationError(AccountSecurityService_1.AccountSecurityService.PASSWORD_REUSE_ERROR);
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        user.password = hashedPassword;
        await this.userRepository.save(user);
        await securityService.addPasswordToHistory(userId, hashedPassword);
        const resetToken = await this.tokenRepository.findOne({
            where: { token: this.hashToken(token) },
        });
        if (resetToken) {
            resetToken.markAsUsed();
            await this.tokenRepository.save(resetToken);
        }
        await this.sendPasswordResetConfirmationEmail(user);
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.SECURITY_LEVEL_CHANGED,
            userId,
            resource: 'auth.password',
            action: 'reset',
            message: `Password successfully reset for user ${userId}`,
            metadata: { userId },
        });
        return { message: 'Password has been successfully reset' };
    }
    generateSecureToken() {
        return node_crypto_1.default.randomBytes(32).toString('hex');
    }
    hashToken(token) {
        return node_crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
    async invalidateUserTokens(userId) {
        await this.tokenRepository
            .createQueryBuilder()
            .update(PasswordResetToken_1.PasswordResetToken)
            .set({ used: true })
            .where('userId = :userId AND used = false AND expiresAt > :now', {
            userId,
            now: new Date(),
        })
            .execute();
    }
    async cleanupExpiredTokens() {
        const result = await this.tokenRepository.delete({
            expiresAt: (0, typeorm_1.LessThan)(new Date()),
        });
        return result.affected || 0;
    }
    async getActiveTokenCount(userId) {
        return this.tokenRepository.count({
            where: {
                userId,
                used: false,
                expiresAt: (0, typeorm_1.LessThan)(new Date()),
            },
        });
    }
    async sendPasswordResetEmail(user, token) {
        if (!email_1.emailService.isConfigured()) {
            logger_1.logger.warn('Email not configured. Skipping password reset email.');
            return;
        }
        const resetUrl = `${(0, urls_1.getFrontendUrl)()}/reset-password?token=${token}`;
        const expirationMinutes = this.TOKEN_EXPIRATION_HOURS * 60;
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4a90e2; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
                    .button { display: inline-block; padding: 12px 30px; background-color: #4a90e2; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${user.username},</p>
                        <p>We received a request to reset your password for your Star Citizen Fleet Manager account.</p>
                        <p>Click the button below to reset your password:</p>
                        <div style="text-align: center;">
                            <a href="${resetUrl}" class="button">Reset Password</a>
                        </div>
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #4a90e2;">${resetUrl}</p>
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul>
                                <li>This link will expire in ${expirationMinutes} minutes</li>
                                <li>If you didn't request this reset, please ignore this email</li>
                                <li>Never share this link with anyone</li>
                            </ul>
                        </div>
                        <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from Star Citizen Fleet Manager.</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        try {
            const result = await email_1.emailService.send({
                to: user.email,
                subject: 'Password Reset Request - Star Citizen Fleet Manager',
                html: emailHtml,
            });
            if (!result.success) {
                throw new Error(result.error);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send password reset email:', error);
            throw new Error('Failed to send password reset email');
        }
    }
    async sendPasswordResetConfirmationEmail(user) {
        if (!email_1.emailService.isConfigured()) {
            return;
        }
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9f9f9; padding: 20px; margin-top: 20px; }
                    .warning { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 10px; margin: 20px 0; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>✓ Password Reset Successful</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${user.username},</p>
                        <p>Your password has been successfully reset for your Star Citizen Fleet Manager account.</p>
                        <p>You can now log in using your new password.</p>
                        <div class="warning">
                            <strong>⚠️ Didn't reset your password?</strong>
                            <p>If you didn't perform this action, your account may be compromised. Please contact support immediately.</p>
                        </div>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from Star Citizen Fleet Manager.</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        try {
            await email_1.emailService.send({
                to: user.email,
                subject: 'Password Reset Successful - Star Citizen Fleet Manager',
                html: emailHtml,
            });
        }
        catch (error) {
            logger_1.logger.error('Failed to send password reset confirmation email:', error);
        }
    }
}
exports.PasswordResetService = PasswordResetService;
//# sourceMappingURL=PasswordResetService.js.map