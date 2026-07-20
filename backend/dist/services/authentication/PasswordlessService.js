"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PasswordlessService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const typeorm_1 = require("typeorm");
const urls_1 = require("../../config/urls");
const data_source_1 = require("../../data-source");
const PasswordlessToken_1 = require("../../models/PasswordlessToken");
const User_1 = require("../../models/User");
const apiErrors_1 = require("../../utils/apiErrors");
const auditLogger_1 = require("../../utils/auditLogger");
const errorHandler_1 = require("../../utils/errorHandler");
const logger_1 = require("../../utils/logger");
const email_1 = require("../communication/email");
class PasswordlessService {
    tokenRepository;
    userRepository;
    config;
    constructor() {
        this.tokenRepository = data_source_1.AppDataSource.getRepository(PasswordlessToken_1.PasswordlessToken);
        this.userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
        this.config = {
            tokenExpirationMinutes: parseInt(process.env.PASSWORDLESS_TOKEN_EXPIRY || '15'),
            codeExpirationMinutes: parseInt(process.env.PASSWORDLESS_CODE_EXPIRY || '10'),
            maxAttempts: parseInt(process.env.PASSWORDLESS_MAX_ATTEMPTS || '5'),
            frontendUrl: (0, urls_1.getFrontendUrl)(),
            rateLimitPerHour: parseInt(process.env.PASSWORDLESS_RATE_LIMIT || '5'),
        };
        logger_1.logger.info('PasswordlessService initialized', {
            tokenExpirationMinutes: this.config.tokenExpirationMinutes,
            codeExpirationMinutes: this.config.codeExpirationMinutes,
            maxAttempts: this.config.maxAttempts,
        });
    }
    async sendMagicLink(email, purpose = 'login', metadata) {
        await this.checkRateLimit(email);
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email })
            .getOne();
        const token = crypto_1.default.randomBytes(32).toString('hex');
        const tokenHash = this.hashToken(token);
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.config.tokenExpirationMinutes);
        await this.invalidateTokens(email, purpose);
        const passwordlessToken = this.tokenRepository.create({
            id: crypto_1.default.randomUUID(),
            userId: user?.id,
            email,
            tokenHash,
            tokenType: 'magic_link',
            purpose,
            expiresAt,
            requestIp: metadata?.ipAddress,
            requestUserAgent: metadata?.userAgent,
            maxAttempts: this.config.maxAttempts,
        });
        await this.tokenRepository.save(passwordlessToken);
        await this.sendMagicLinkEmail(email, token, purpose, user?.username);
        logger_1.logger.info('Magic link sent', {
            email,
            purpose,
            tokenId: passwordlessToken.id,
            isNewUser: !user,
        });
        return {
            success: true,
            message: 'Magic link sent to your email address',
            expiresAt,
            tokenId: passwordlessToken.id,
        };
    }
    async verifyMagicLink(token, metadata) {
        const tokenHash = this.hashToken(token);
        const passwordlessToken = await this.tokenRepository.findOne({
            where: { tokenHash, tokenType: 'magic_link' },
        });
        if (!passwordlessToken) {
            throw new apiErrors_1.ValidationError('Invalid or expired magic link');
        }
        if (!passwordlessToken.isValid()) {
            if (passwordlessToken.used) {
                throw new apiErrors_1.ValidationError('This magic link has already been used');
            }
            if (passwordlessToken.isExpired()) {
                throw new apiErrors_1.ValidationError('This magic link has expired');
            }
            if (passwordlessToken.isLocked()) {
                throw new apiErrors_1.ForbiddenError('Too many verification attempts');
            }
        }
        passwordlessToken.used = true;
        passwordlessToken.usedAt = new Date();
        passwordlessToken.verifyIp = metadata?.ipAddress;
        passwordlessToken.verifyUserAgent = metadata?.userAgent;
        await this.tokenRepository.save(passwordlessToken);
        logger_1.logger.info('Magic link verified', {
            tokenId: passwordlessToken.id,
            email: passwordlessToken.email,
            purpose: passwordlessToken.purpose,
        });
        (0, auditLogger_1.logAuditEvent)({
            eventType: auditLogger_1.AuditEventType.AUTH_SUCCESS,
            userId: passwordlessToken.userId ?? undefined,
            resource: 'auth.passwordless',
            action: 'magic_link_verified',
            message: `Magic link verified for ${passwordlessToken.email} (purpose: ${passwordlessToken.purpose})`,
            metadata: {
                email: passwordlessToken.email,
                purpose: passwordlessToken.purpose,
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent,
            },
        });
        return {
            valid: true,
            userId: passwordlessToken.userId,
            email: passwordlessToken.email,
            purpose: passwordlessToken.purpose,
            isNewUser: !passwordlessToken.userId,
        };
    }
    async sendLoginCode(email, purpose = 'login', metadata) {
        await this.checkRateLimit(email);
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.email = :email', { email })
            .getOne();
        const code = this.generateCode();
        const tokenHash = this.hashToken(code);
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.config.codeExpirationMinutes);
        await this.invalidateTokens(email, purpose);
        const passwordlessToken = this.tokenRepository.create({
            id: crypto_1.default.randomUUID(),
            userId: user?.id,
            email,
            tokenHash,
            tokenType: 'code',
            purpose,
            expiresAt,
            requestIp: metadata?.ipAddress,
            requestUserAgent: metadata?.userAgent,
            maxAttempts: this.config.maxAttempts,
        });
        await this.tokenRepository.save(passwordlessToken);
        await this.sendCodeEmail(email, code, purpose, user?.username);
        logger_1.logger.info('Login code sent', {
            email,
            purpose,
            tokenId: passwordlessToken.id,
            isNewUser: !user,
        });
        return {
            success: true,
            message: 'Verification code sent to your email address',
            expiresAt,
            tokenId: passwordlessToken.id,
        };
    }
    async verifyCode(email, code, metadata) {
        const passwordlessToken = await this.tokenRepository.findOne({
            where: { email, tokenType: 'code', used: false },
            order: { createdAt: 'DESC' },
        });
        if (!passwordlessToken) {
            throw new apiErrors_1.NotFoundError('Pending verification code');
        }
        if (passwordlessToken.isLocked()) {
            throw new apiErrors_1.ForbiddenError('Too many failed attempts. Please request a new code.');
        }
        if (passwordlessToken.isExpired()) {
            throw new apiErrors_1.ValidationError('Verification code has expired. Please request a new code.');
        }
        const codeHash = this.hashToken(code);
        if (passwordlessToken.tokenHash !== codeHash) {
            passwordlessToken.attempts += 1;
            await this.tokenRepository.save(passwordlessToken);
            const remainingAttempts = passwordlessToken.maxAttempts - passwordlessToken.attempts;
            if (remainingAttempts <= 0) {
                throw new apiErrors_1.ForbiddenError('Too many failed attempts. Please request a new code.');
            }
            throw new apiErrors_1.ValidationError(`Invalid code. ${remainingAttempts} attempts remaining.`);
        }
        passwordlessToken.used = true;
        passwordlessToken.usedAt = new Date();
        passwordlessToken.verifyIp = metadata?.ipAddress;
        passwordlessToken.verifyUserAgent = metadata?.userAgent;
        await this.tokenRepository.save(passwordlessToken);
        logger_1.logger.info('Login code verified', {
            tokenId: passwordlessToken.id,
            email: passwordlessToken.email,
            purpose: passwordlessToken.purpose,
        });
        return {
            valid: true,
            userId: passwordlessToken.userId,
            email: passwordlessToken.email,
            purpose: passwordlessToken.purpose,
            isNewUser: !passwordlessToken.userId,
        };
    }
    async invalidateTokens(email, purpose) {
        await this.tokenRepository.update({ email, purpose, used: false }, { used: true, usedAt: new Date() });
    }
    async cleanupExpiredTokens() {
        const result = await this.tokenRepository.delete({
            expiresAt: (0, typeorm_1.LessThan)(new Date()),
        });
        const cleaned = result.affected || 0;
        if (cleaned > 0) {
            logger_1.logger.info('Cleaned up expired passwordless tokens', { count: cleaned });
        }
        return cleaned;
    }
    async checkRateLimit(email) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const count = await this.tokenRepository
            .createQueryBuilder('token')
            .where('token.email = :email', { email })
            .andWhere('token.createdAt > :oneHourAgo', { oneHourAgo })
            .getCount();
        if (count >= this.config.rateLimitPerHour) {
            throw new apiErrors_1.ForbiddenError('Too many requests. Please try again later.');
        }
    }
    async sendMagicLinkEmail(email, token, purpose, username) {
        if (!email_1.emailService.isConfigured()) {
            logger_1.logger.warn('Email not configured. Skipping magic link email.');
            return;
        }
        const magicLinkUrl = `${this.config.frontendUrl}/auth/verify?token=${token}&type=magic_link`;
        const expirationMinutes = this.config.tokenExpirationMinutes;
        const purposeText = {
            login: 'sign in to your account',
            register: 'create your account',
            link_account: 'link your account',
            verify_email: 'verify your email address',
        }[purpose] || 'authenticate';
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 25px; margin: 20px 0; font-weight: bold; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    .icon { font-size: 48px; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="icon">🔐</div>
                        <h1>Passwordless Login</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${username || 'there'},</p>
                        <p>Click the button below to ${purposeText} at Star Citizen Fleet Manager:</p>
                        <div style="text-align: center;">
                            <a href="${magicLinkUrl}" class="button">Sign In Securely</a>
                        </div>
                        <p style="word-break: break-all; font-size: 12px; color: #666;">
                            Or copy this link: ${magicLinkUrl}
                        </p>
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li>This link expires in ${expirationMinutes} minutes</li>
                                <li>Can only be used once</li>
                                <li>If you didn't request this, ignore this email</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Star Citizen Fleet Manager - Secure Passwordless Login</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        try {
            const result = await email_1.emailService.send({
                to: email,
                subject: `Your Secure Login Link - Star Citizen Fleet Manager`,
                html: emailHtml,
            });
            if (!result.success) {
                throw new Error(result.error);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send magic link email', { email, error: (0, errorHandler_1.getErrorMessage)(error) });
            throw new apiErrors_1.BadRequestError('Failed to send magic link email');
        }
    }
    async sendCodeEmail(email, code, purpose, username) {
        if (!email_1.emailService.isConfigured()) {
            logger_1.logger.warn('Email not configured. Skipping code email.');
            return;
        }
        const expirationMinutes = this.config.codeExpirationMinutes;
        const purposeText = {
            login: 'sign in',
            register: 'register',
            link_account: 'link your account',
            verify_email: 'verify your email',
        }[purpose] || 'authenticate';
        const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .code-box { background-color: #fff; border: 2px dashed #667eea; padding: 25px; text-align: center; margin: 25px 0; border-radius: 10px; }
                    .code { font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #667eea; font-family: monospace; }
                    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px; }
                    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
                    .icon { font-size: 48px; margin-bottom: 10px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="icon">🔢</div>
                        <h1>Your Verification Code</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${username || 'there'},</p>
                        <p>Use this code to ${purposeText} at Star Citizen Fleet Manager:</p>
                        <div class="code-box">
                            <div class="code">${code}</div>
                        </div>
                        <div class="warning">
                            <strong>⚠️ Security Notice:</strong>
                            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                                <li>This code expires in ${expirationMinutes} minutes</li>
                                <li>Never share this code with anyone</li>
                                <li>If you didn't request this, ignore this email</li>
                            </ul>
                        </div>
                    </div>
                    <div class="footer">
                        <p>Star Citizen Fleet Manager - Secure Passwordless Login</p>
                        <p>Please do not reply to this email.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
        try {
            const result = await email_1.emailService.send({
                to: email,
                subject: `Your Verification Code: ${code} - Star Citizen Fleet Manager`,
                html: emailHtml,
            });
            if (!result.success) {
                throw new Error(result.error);
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to send code email', { email, error: (0, errorHandler_1.getErrorMessage)(error) });
            throw new apiErrors_1.BadRequestError('Failed to send verification code email');
        }
    }
    generateCode() {
        return crypto_1.default.randomInt(100000, 999999).toString();
    }
    hashToken(token) {
        return crypto_1.default.createHash('sha256').update(token).digest('hex');
    }
    async getStats() {
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const activeTokens = await this.tokenRepository.count({
            where: { used: false },
        });
        const usedTokens24h = await this.tokenRepository
            .createQueryBuilder('token')
            .where('token.usedAt > :yesterday', { yesterday })
            .getCount();
        const expiredTokens = await this.tokenRepository.count({
            where: { expiresAt: (0, typeorm_1.LessThan)(now), used: false },
        });
        return {
            activeTokens,
            usedTokens24h,
            expiredTokens,
        };
    }
}
exports.PasswordlessService = PasswordlessService;
//# sourceMappingURL=PasswordlessService.js.map