import { EmailClient, type EmailMessage } from '@azure/communication-email';
import { AzureKeyCredential } from '@azure/core-auth';
import nodemailer from 'nodemailer';

import { logger } from '../../../utils/logger';

/**
 * Options for sending an email via the centralized EmailService.
 */
export interface SendEmailOptions {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** HTML body content */
  html: string;
  /** Optional plain-text fallback body */
  text?: string;
}

/**
 * Result of a send operation.
 */
export interface SendEmailResult {
  success: boolean;
  /** ACS message ID or nodemailer messageId */
  messageId?: string;
  error?: string;
}

/**
 * Centralized email sending service for SC Fleet Manager.
 *
 * Supports two transports:
 *  1. **Azure Communication Services (ACS)** — production (set ACS_CONNECTION_STRING)
 *  2. **Nodemailer SMTP** — local development / fallback (set EMAIL_SMTP_HOST + EMAIL_USER + EMAIL_PASS)
 *
 * All domain services (PasswordResetService, PasswordlessService, OrganizationDeletionService,
 * OrganizationDeletionNotificationService, NotificationService) should delegate to this service
 * instead of creating their own nodemailer transporters.
 */
export class EmailService {
  private static instance: EmailService;

  private acsClient: EmailClient | null = null;
  private smtpTransporter: nodemailer.Transporter | null = null;
  private readonly senderAddress: string;
  private transport: 'acs' | 'smtp' | 'none' = 'none';
  private readonly isTransportOptional: boolean;

  private constructor() {
    this.senderAddress =
      process.env.ACS_EMAIL_SENDER_ADDRESS ??
      process.env.EMAIL_FROM ??
      process.env.EMAIL_USER ??
      'noreply@fringecore.space';
    this.isTransportOptional = process.env.EMAIL_TRANSPORT_OPTIONAL === 'true';

    this.initializeTransport();
  }

  /**
   * Singleton accessor.
   */
  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Reset the singleton — **test helper only**.
   */
  static resetInstance(): void {
    EmailService.instance = undefined as unknown as EmailService;
  }

  // ---------------------------------------------------------------------------
  // Transport initialisation — ACS preferred, SMTP fallback
  // ---------------------------------------------------------------------------

  private parseAcsConnectionString(
    connectionString: string
  ): { endpoint: string; accessKey: string } | null {
    const parts = connectionString.split(';');
    let endpoint: string | null = null;
    let accessKey: string | null = null;

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
      } else if (key === 'accesskey') {
        accessKey = value;
      }
    }

    if (!endpoint || !accessKey) {
      return null;
    }

    return { endpoint, accessKey };
  }

  private initializeTransport(): void {
    // 1. Try Azure Communication Services
    const acsConnectionString = process.env.ACS_CONNECTION_STRING;
    if (acsConnectionString) {
      try {
        const acsConfig = this.parseAcsConnectionString(acsConnectionString);
        if (!acsConfig) {
          throw new Error('ACS_CONNECTION_STRING must contain endpoint and accesskey entries');
        }

        this.acsClient = new EmailClient(
          acsConfig.endpoint,
          new AzureKeyCredential(acsConfig.accessKey)
        );
        this.transport = 'acs';
        logger.info('EmailService: using Azure Communication Services transport', {
          sender: this.senderAddress,
        });
        return;
      } catch (error: unknown) {
        logger.error('EmailService: failed to initialise ACS client, falling back to SMTP', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // 2. Fallback to SMTP / Nodemailer
    const smtpHost = process.env.EMAIL_SMTP_HOST;
    const smtpUser = process.env.EMAIL_USER;
    const smtpPass = process.env.EMAIL_PASS;

    if (smtpUser && smtpPass) {
      this.smtpTransporter = nodemailer.createTransport({
        host: smtpHost ?? 'smtp.gmail.com',
        port: Number.parseInt(process.env.EMAIL_SMTP_PORT ?? '587'),
        secure: process.env.EMAIL_SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
      });
      this.transport = 'smtp';
      logger.info('EmailService: using SMTP transport', {
        host: smtpHost,
        sender: this.senderAddress,
      });
      return;
    }

    // 3. No transport available
    const logMessage = 'EmailService: no email transport configured. Emails will be disabled.';
    if (this.isTransportOptional) {
      logger.info(logMessage, {
        transportOptional: true,
      });
      return;
    }

    logger.warn(logMessage);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Whether email sending is available.
   */
  isConfigured(): boolean {
    return this.transport !== 'none';
  }

  /**
   * Which transport is active.
   */
  getTransport(): 'acs' | 'smtp' | 'none' {
    return this.transport;
  }

  /**
   * The sender address in use.
   */
  getSenderAddress(): string {
    return this.senderAddress;
  }

  /**
   * Send an email. Returns a result object — does **not** throw on delivery failure.
   */
  async send(options: SendEmailOptions): Promise<SendEmailResult> {
    if (this.transport === 'none') {
      logger.warn('EmailService: email not configured, skipping send', {
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('EmailService: failed to send email', {
        to: options.to,
        subject: options.subject,
        transport: this.transport,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  // ---------------------------------------------------------------------------
  // Transport implementations
  // ---------------------------------------------------------------------------

  private async sendViaAcs(options: SendEmailOptions): Promise<SendEmailResult> {
    const message: EmailMessage = {
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

    // acsClient is guaranteed non-null when transport === 'acs'
    const poller = await this.acsClient!.beginSend(message); // eslint-disable-line @typescript-eslint/no-non-null-assertion
    const result = await poller.pollUntilDone();

    if (result.status === 'Succeeded') {
      logger.debug('EmailService: ACS email sent', {
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

  private async sendViaSmtp(options: SendEmailOptions): Promise<SendEmailResult> {
    // smtpTransporter is guaranteed non-null when transport === 'smtp'
    const info: { messageId?: string } = (await this.smtpTransporter!.sendMail({
      from: this.senderAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    })) as { messageId?: string };

    logger.debug('EmailService: SMTP email sent', {
      to: options.to,
      messageId: info.messageId,
    });
    return { success: true, messageId: info.messageId };
  }
}

/** Convenience singleton export */
export const emailService = EmailService.getInstance();
