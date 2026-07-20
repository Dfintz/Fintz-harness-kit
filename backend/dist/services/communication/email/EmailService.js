"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailService = exports.EmailService = void 0;
const communication_email_1 = require("@azure/communication-email");
const core_auth_1 = require("@azure/core-auth");
const nodemailer_1 = __importDefault(require("nodemailer"));
const logger_1 = require("../../../utils/logger");
class EmailService {
    static instance;
    acsClient = null;
    smtpTransporter = null;
    senderAddress;
    transport = 'none';
    isTransportOptional;
    constructor() {
        this.senderAddress =
            process.env.ACS_EMAIL_SENDER_ADDRESS ??
                process.env.EMAIL_FROM ??
                process.env.EMAIL_USER ??
                'noreply@fringecore.space';
        this.isTransportOptional = process.env.EMAIL_TRANSPORT_OPTIONAL === 'true';
        this.initializeTransport();
    }
    static getInstance() {
        if (!EmailService.instance) {
            EmailService.instance = new EmailService();
        }
        return EmailService.instance;
    }
    static resetInstance() {
        EmailService.instance = undefined;
    }
    parseAcsConnectionString(connectionString) {
        const parts = connectionString.split(';');
        let endpoint = null;
        let accessKey = null;
        for (const part of parts) {
            if (!part) {
                continue;
            }
            const [rawKey, ...rawValueParts] = part.split('=');
            if (!rawKey || rawValueParts.length === 0) {
                continue;
            }
            const key = rawKey.trim().toLowerCase();
            const value = rawValueParts.join('=').trim();
            if (key === 'endpoint') {
                endpoint = value.replace(/\/+$/, '');
            }
            else if (key === 'accesskey') {
                accessKey = value;
            }
        }
        if (!endpoint || !accessKey) {
            return null;
        }
        return { endpoint, accessKey };
    }
    initializeTransport() {
        const acsConnectionString = process.env.ACS_CONNECTION_STRING;
        if (acsConnectionString) {
            try {
                const acsConfig = this.parseAcsConnectionString(acsConnectionString);
                if (!acsConfig) {
                    throw new Error('ACS_CONNECTION_STRING must contain endpoint and accesskey entries');
                }
                this.acsClient = new communication_email_1.EmailClient(acsConfig.endpoint, new core_auth_1.AzureKeyCredential(acsConfig.accessKey));
                this.transport = 'acs';
                logger_1.logger.info('EmailService: using Azure Communication Services transport', {
                    sender: this.senderAddress,
                });
                return;
            }
            catch (error) {
                logger_1.logger.error('EmailService: failed to initialise ACS client, falling back to SMTP', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                });
            }
        }
        const smtpHost = process.env.EMAIL_SMTP_HOST;
        const smtpUser = process.env.EMAIL_USER;
        const smtpPass = process.env.EMAIL_PASS;
        if (smtpUser && smtpPass) {
            this.smtpTransporter = nodemailer_1.default.createTransport({
                host: smtpHost ?? 'smtp.gmail.com',
                port: Number.parseInt(process.env.EMAIL_SMTP_PORT ?? '587'),
                secure: process.env.EMAIL_SMTP_SECURE === 'true',
                auth: { user: smtpUser, pass: smtpPass },
            });
            this.transport = 'smtp';
            logger_1.logger.info('EmailService: using SMTP transport', {
                host: smtpHost,
                sender: this.senderAddress,
            });
            return;
        }
        const logMessage = 'EmailService: no email transport configured. Emails will be disabled.';
        if (this.isTransportOptional) {
            logger_1.logger.info(logMessage, {
                transportOptional: true,
            });
            return;
        }
        logger_1.logger.warn(logMessage);
    }
    isConfigured() {
        return this.transport !== 'none';
    }
    getTransport() {
        return this.transport;
    }
    getSenderAddress() {
        return this.senderAddress;
    }
    async send(options) {
        if (this.transport === 'none') {
            logger_1.logger.warn('EmailService: email not configured, skipping send', {
                to: options.to,
                subject: options.subject,
            });
            return { success: false, error: 'Email transport not configured' };
        }
        try {
            if (this.transport === 'acs') {
                return await this.sendViaAcs(options);
            }
            return await this.sendViaSmtp(options);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error';
            logger_1.logger.error('EmailService: failed to send email', {
                to: options.to,
                subject: options.subject,
                transport: this.transport,
                error: message,
            });
            return { success: false, error: message };
        }
    }
    async sendViaAcs(options) {
        const message = {
            senderAddress: this.senderAddress,
            recipients: {
                to: [{ address: options.to }],
            },
            content: {
                subject: options.subject,
                html: options.html,
                plainText: options.text,
            },
        };
        const poller = await this.acsClient.beginSend(message);
        const result = await poller.pollUntilDone();
        if (result.status === 'Succeeded') {
            logger_1.logger.debug('EmailService: ACS email sent', {
                to: options.to,
                messageId: result.id,
            });
            return { success: true, messageId: result.id };
        }
        return {
            success: false,
            messageId: result.id,
            error: `ACS send status: ${result.status}`,
        };
    }
    async sendViaSmtp(options) {
        const info = (await this.smtpTransporter.sendMail({
            from: this.senderAddress,
            to: options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        }));
        logger_1.logger.debug('EmailService: SMTP email sent', {
            to: options.to,
            messageId: info.messageId,
        });
        return { success: true, messageId: info.messageId };
    }
}
exports.EmailService = EmailService;
exports.emailService = EmailService.getInstance();
//# sourceMappingURL=EmailService.js.map