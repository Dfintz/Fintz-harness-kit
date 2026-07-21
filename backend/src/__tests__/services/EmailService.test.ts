/* eslint-disable @typescript-eslint/no-require-imports */
import nodemailer from 'nodemailer';

// Mock both external email dependencies before any imports
jest.mock('nodemailer');
jest.mock('@azure/communication-email');
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { EmailClient, type EmailSendResponse } from '@azure/communication-email';
import { AzureKeyCredential } from '@azure/core-auth';
import { logger } from '../../utils/logger';

import { EmailService } from '../../services/communication/email/EmailService';

describe('EmailService', () => {
  const originalEnv = process.env;
  const loggerMock = logger as jest.Mocked<typeof logger>;

  let mockSmtpTransporter: { sendMail: jest.Mock };
  let mockAcsBeginSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    EmailService.resetInstance();

    // Reset env
    process.env = { ...originalEnv };
    delete process.env.ACS_CONNECTION_STRING;
    delete process.env.ACS_EMAIL_SENDER_ADDRESS;
    delete process.env.EMAIL_SMTP_HOST;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_FROM;
    delete process.env.EMAIL_SMTP_PORT;
    delete process.env.EMAIL_SMTP_SECURE;
    delete process.env.EMAIL_TRANSPORT_OPTIONAL;

    // Setup nodemailer mock
    mockSmtpTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'smtp-msg-123' }),
    };
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockSmtpTransporter);

    // Setup ACS mock
    mockAcsBeginSend = jest.fn().mockResolvedValue({
      pollUntilDone: jest.fn().mockResolvedValue({
        status: 'Succeeded',
        id: 'acs-msg-456',
      } as Partial<EmailSendResponse>),
    });
    (EmailClient as jest.MockedClass<typeof EmailClient>).mockImplementation(
      () =>
        ({
          beginSend: mockAcsBeginSend,
        }) as unknown as EmailClient
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // =========================================================================
  // Transport selection
  // =========================================================================

  describe('transport selection', () => {
    it('should prefer ACS when ACS_CONNECTION_STRING is set', () => {
      process.env.ACS_CONNECTION_STRING =
        'endpoint=https://test.communication.azure.com/;accesskey=abc';
      process.env.ACS_EMAIL_SENDER_ADDRESS = 'noreply@fringecore.space';

      const service = EmailService.getInstance();

      expect(service.getTransport()).toBe('acs');
      expect(service.getSenderAddress()).toBe('noreply@fringecore.space');
      expect(EmailClient).toHaveBeenCalledWith(
        'https://test.communication.azure.com',
        expect.any(AzureKeyCredential)
      );
    });

    it('should fall back to SMTP when only SMTP is configured', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASS = 'app-password';
      process.env.EMAIL_FROM = 'noreply@fringecore.space';

      const service = EmailService.getInstance();

      expect(service.getTransport()).toBe('smtp');
      expect(service.getSenderAddress()).toBe('noreply@fringecore.space');
      expect(nodemailer.createTransport).toHaveBeenCalled();
    });

    it('should report none when nothing is configured', () => {
      const service = EmailService.getInstance();

      expect(service.getTransport()).toBe('none');
      expect(service.isConfigured()).toBe(false);
      expect(loggerMock.warn).toHaveBeenCalledWith(
        'EmailService: no email transport configured. Emails will be disabled.'
      );
    });

    it('should log at info when missing transport is explicitly optional', () => {
      process.env.EMAIL_TRANSPORT_OPTIONAL = 'true';

      const service = EmailService.getInstance();

      expect(service.getTransport()).toBe('none');
      expect(service.isConfigured()).toBe(false);
      expect(loggerMock.info).toHaveBeenCalledWith(
        'EmailService: no email transport configured. Emails will be disabled.',
        { transportOptional: true }
      );
      expect(loggerMock.warn).not.toHaveBeenCalledWith(
        'EmailService: no email transport configured. Emails will be disabled.'
      );
    });

    it('should prefer ACS over SMTP when both are configured', () => {
      process.env.ACS_CONNECTION_STRING =
        'endpoint=https://test.communication.azure.com/;accesskey=abc';
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASS = 'app-password';

      const service = EmailService.getInstance();

      expect(service.getTransport()).toBe('acs');
    });

    it('should use EMAIL_FROM as sender when ACS_EMAIL_SENDER_ADDRESS is not set', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASS = 'pass';
      process.env.EMAIL_FROM = 'custom@domain.com';

      const service = EmailService.getInstance();

      expect(service.getSenderAddress()).toBe('custom@domain.com');
    });
  });

  // =========================================================================
  // isConfigured
  // =========================================================================

  describe('isConfigured', () => {
    it('should return true when ACS is configured', () => {
      process.env.ACS_CONNECTION_STRING =
        'endpoint=https://test.communication.azure.com/;accesskey=abc';

      expect(EmailService.getInstance().isConfigured()).toBe(true);
    });

    it('should return true when SMTP is configured', () => {
      process.env.EMAIL_USER = 'user@test.com';
      process.env.EMAIL_PASS = 'pass';

      expect(EmailService.getInstance().isConfigured()).toBe(true);
    });

    it('should return false when nothing is configured', () => {
      expect(EmailService.getInstance().isConfigured()).toBe(false);
    });
  });

  // =========================================================================
  // send() — ACS transport
  // =========================================================================

  describe('send via ACS', () => {
    beforeEach(() => {
      process.env.ACS_CONNECTION_STRING =
        'endpoint=https://test.communication.azure.com/;accesskey=abc';
      process.env.ACS_EMAIL_SENDER_ADDRESS = 'noreply@fringecore.space';
    });

    it('should send email successfully via ACS', async () => {
      const service = EmailService.getInstance();

      const result = await service.send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: 'Hello',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('acs-msg-456');
      expect(mockAcsBeginSend).toHaveBeenCalledWith({
        senderAddress: 'noreply@fringecore.space',
        recipients: {
          to: [{ address: 'user@example.com' }],
        },
        content: {
          subject: 'Test Subject',
          html: '<p>Hello</p>',
          plainText: 'Hello',
        },
      });
    });

    it('should return failure when ACS reports non-Succeeded status', async () => {
      mockAcsBeginSend.mockResolvedValueOnce({
        pollUntilDone: jest.fn().mockResolvedValue({
          status: 'Failed',
          id: 'acs-fail-789',
        }),
      });

      const service = EmailService.getInstance();
      const result = await service.send({
        to: 'user@example.com',
        subject: 'Fail',
        html: '<p>fail</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed');
    });

    it('should handle ACS send errors gracefully', async () => {
      mockAcsBeginSend.mockRejectedValueOnce(new Error('ACS unavailable'));

      const service = EmailService.getInstance();
      const result = await service.send({
        to: 'user@example.com',
        subject: 'Error',
        html: '<p>error</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ACS unavailable');
    });
  });

  // =========================================================================
  // send() — SMTP transport
  // =========================================================================

  describe('send via SMTP', () => {
    beforeEach(() => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASS = 'app-password';
      process.env.EMAIL_FROM = 'noreply@fringecore.space';
    });

    it('should send email successfully via SMTP', async () => {
      const service = EmailService.getInstance();

      const result = await service.send({
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('smtp-msg-123');
      expect(mockSmtpTransporter.sendMail).toHaveBeenCalledWith({
        from: 'noreply@fringecore.space',
        to: 'user@example.com',
        subject: 'Test Subject',
        html: '<p>Hello</p>',
        text: undefined,
      });
    });

    it('should handle SMTP send errors gracefully', async () => {
      mockSmtpTransporter.sendMail.mockRejectedValueOnce(new Error('SMTP timeout'));

      const service = EmailService.getInstance();
      const result = await service.send({
        to: 'user@example.com',
        subject: 'Error',
        html: '<p>error</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('SMTP timeout');
    });
  });

  // =========================================================================
  // send() — no transport
  // =========================================================================

  describe('send with no transport', () => {
    it('should return failure without throwing', async () => {
      const service = EmailService.getInstance();

      const result = await service.send({
        to: 'user@example.com',
        subject: 'No transport',
        html: '<p>noop</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email transport not configured');
    });
  });

  // =========================================================================
  // Singleton
  // =========================================================================

  describe('singleton', () => {
    it('should return the same instance on multiple calls', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASS = 'pass';

      const a = EmailService.getInstance();
      const b = EmailService.getInstance();

      expect(a).toBe(b);
    });

    it('should create a new instance after resetInstance', () => {
      process.env.EMAIL_USER = 'test@gmail.com';
      process.env.EMAIL_PASS = 'pass';

      const a = EmailService.getInstance();
      EmailService.resetInstance();

      process.env.ACS_CONNECTION_STRING =
        'endpoint=https://test.communication.azure.com/;accesskey=abc';
      const b = EmailService.getInstance();

      expect(a.getTransport()).toBe('smtp');
      expect(b.getTransport()).toBe('acs');
    });
  });
});
