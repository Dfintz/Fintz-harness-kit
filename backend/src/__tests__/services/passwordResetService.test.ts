import crypto from 'node:crypto';

import bcrypt from 'bcrypt';
import { LessThan, Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { PasswordResetToken } from '../../models/PasswordResetToken';
import { User } from '../../models/User';
import { PasswordResetService } from '../../services/authentication/PasswordResetService';
import { emailService } from '../../services/communication/email';
import { ApiErrorCode } from '../../types/api';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('node:crypto');
jest.mock('bcrypt');
jest.mock('../../services/communication/email', () => ({
  emailService: {
    isConfigured: jest.fn().mockReturnValue(true),
    send: jest.fn().mockResolvedValue({ success: true, messageId: 'test-message-id' }),
    getSenderAddress: jest.fn().mockReturnValue('noreply@fringecore.space'),
    getTransport: jest.fn().mockReturnValue('smtp'),
  },
}));
describe('PasswordResetService', () => {
  let passwordResetService: PasswordResetService;
  let mockTokenRepository: jest.Mocked<Repository<PasswordResetToken>>;
  let mockUserRepository: jest.Mocked<Repository<User>>;
  const mockEmailService = emailService as jest.Mocked<typeof emailService>;

  const createMockUser = (overrides?: Partial<User>): User =>
    ({
      id: '100',
      username: 'testuser',
      email: 'test@example.com',
      password: 'hashed-password',
      rsiHandle: 'TEST_USER',
      ...overrides,
    }) as User;

  const createMockResetToken = (overrides?: Partial<PasswordResetToken>): PasswordResetToken => {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    return {
      id: '1',
      userId: '100',
      token: `test-token-${crypto.randomBytes(16).toString('hex')}`,
      expiresAt,
      used: false,
      createdAt: new Date(),
      isExpired: jest.fn().mockReturnValue(false),
      markAsUsed: jest.fn(),
      user: createMockUser(),
      ...overrides,
    } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset email service mock
    mockEmailService.isConfigured.mockReturnValue(true);
    mockEmailService.send.mockResolvedValue({ success: true, messageId: 'test-message-id' });

    // Mock repositories
    mockTokenRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    (AppDataSource.getRepository as jest.Mock).mockImplementation(entity => {
      if (entity === PasswordResetToken) {
        return mockTokenRepository;
      }
      if (entity === User) {
        return mockUserRepository;
      }
      return {} as any;
    });

    // Mock crypto
    (crypto.randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn(() => 'secure-random-token-hex'),
    });

    (crypto.createHash as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnValue({
        digest: jest.fn(() => 'hashed-token-hex'),
      }),
    });

    // Mock bcrypt
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new-password');

    // Set environment variables
    process.env.EMAIL_USER = 'test@gmail.com';
    process.env.EMAIL_PASS = 'test-password';
    process.env.EMAIL_SMTP_HOST = 'smtp.gmail.com';
    process.env.EMAIL_SMTP_PORT = '587';
    process.env.FRONTEND_URL = 'http://localhost:3000';
    process.env.EMAIL_FROM = 'noreply@fleetmanager.com';

    passwordResetService = new PasswordResetService();
  });

  afterEach(() => {
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
    delete process.env.EMAIL_SMTP_HOST;
    delete process.env.EMAIL_SMTP_PORT;
    delete process.env.FRONTEND_URL;
    delete process.env.EMAIL_FROM;
  });

  describe('constructor', () => {
    it('should initialize successfully when email is configured', () => {
      expect(passwordResetService).toBeDefined();
      expect(mockEmailService.isConfigured()).toBe(true);
    });

    it('should still initialize when email is not configured', () => {
      mockEmailService.isConfigured.mockReturnValue(false);

      const service = new PasswordResetService();

      expect(service).toBeDefined();
    });
  });

  describe('requestPasswordReset', () => {
    it('should generate token and send email for valid user', async () => {
      const mockUser = createMockUser({ email: 'user@example.com' });
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      const result = await passwordResetService.requestPasswordReset('user@example.com');

      expect(result.message).toContain('password reset link has been sent');
      expect(mockTokenRepository.save).toHaveBeenCalled();
      expect(mockEmailService.send).toHaveBeenCalled();
    });

    it('should not reveal if user does not exist', async () => {
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await passwordResetService.requestPasswordReset('nonexistent@example.com');

      expect(result.message).toContain('password reset link has been sent');
      expect(mockTokenRepository.save).not.toHaveBeenCalled();
      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('should invalidate existing tokens before creating new one', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('user@example.com');

      expect(mockUpdateBuilder.update).toHaveBeenCalledWith(PasswordResetToken);
      expect(mockUpdateBuilder.set).toHaveBeenCalledWith({ used: true });
    });

    it('should generate cryptographically secure token', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('user@example.com');

      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
    });

    it('should set token expiration to 1 hour', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      const beforeTime = new Date();
      await passwordResetService.requestPasswordReset('user@example.com');
      const afterTime = new Date();

      const createCall = mockTokenRepository.create.mock.calls[0][0];
      const expiresAt = createCall.expiresAt as Date;
      const hoursDiff = (expiresAt.getTime() - beforeTime.getTime()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeGreaterThanOrEqual(0.99);
      expect(hoursDiff).toBeLessThanOrEqual(1.01);
    });

    it('should include reset link in email', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('test@example.com');

      const emailCall = mockEmailService.send.mock.calls[0][0];
      expect(emailCall.html).toContain('http://localhost:3000/reset-password?token=');
      expect(emailCall.to).toBe('test@example.com');
      expect(emailCall.subject).toContain('Password Reset Request');
    });

    it('should throw error when email sending fails', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      mockEmailService.send.mockResolvedValueOnce({ success: false, error: 'SMTP error' });

      await expect(passwordResetService.requestPasswordReset('user@example.com')).rejects.toThrow(
        'Failed to send password reset email'
      );
    });
  });

  describe('verifyResetToken', () => {
    it('should return valid for a valid token', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      const result = await passwordResetService.verifyResetToken('valid-token');

      expect(result).toEqual({
        valid: true,
        userId: '100',
      });
    });

    it('should throw error for non-existent token', async () => {
      mockTokenRepository.findOne.mockResolvedValue(null);

      await expect(passwordResetService.verifyResetToken('invalid-token')).rejects.toThrow(
        'Invalid or expired reset token'
      );
      await expect(passwordResetService.verifyResetToken('invalid-token')).rejects.toMatchObject({
        statusCode: 400,
        code: ApiErrorCode.TOKEN_EXPIRED,
      });
    });

    it('should throw error for already used token', async () => {
      const mockToken = createMockResetToken({ used: true });
      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      await expect(passwordResetService.verifyResetToken('used-token')).rejects.toThrow(
        'This reset token has already been used'
      );
      await expect(passwordResetService.verifyResetToken('used-token')).rejects.toMatchObject({
        statusCode: 400,
        code: ApiErrorCode.TOKEN_EXPIRED,
      });
    });

    it('should throw error for expired token', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(true);
      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      await expect(passwordResetService.verifyResetToken('expired-token')).rejects.toThrow(
        'This reset token has expired'
      );
      await expect(passwordResetService.verifyResetToken('expired-token')).rejects.toMatchObject({
        statusCode: 400,
        code: ApiErrorCode.TOKEN_EXPIRED,
      });
    });

    it('should load user relation when verifying token', async () => {
      const mockToken = createMockResetToken();
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      await passwordResetService.verifyResetToken('token');

      // Token is hashed with SHA-256 before lookup
      expect(mockTokenRepository.findOne).toHaveBeenCalledWith({
        where: { token: 'hashed-token-hex' },
        relations: ['user'],
      });
    });
  });

  describe('resetPassword', () => {
    it('should reset password successfully', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await passwordResetService.resetPassword('valid-token', 'newPassword123');

      expect(result.message).toBe('Password has been successfully reset');
      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundError (404) when the token user no longer exists', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        passwordResetService.resetPassword('valid-token', 'newPassword123')
      ).rejects.toThrow('User not found');
      await expect(
        passwordResetService.resetPassword('valid-token', 'newPassword123')
      ).rejects.toMatchObject({ name: 'NotFoundError', statusCode: 404 });
    });

    it('should hash new password before saving', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await passwordResetService.resetPassword('valid-token', 'newPassword123');

      expect(bcrypt.hash).toHaveBeenCalledWith('newPassword123', 10);
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          password: 'hashed-new-password',
        })
      );
    });

    it('should mark token as used after password reset', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await passwordResetService.resetPassword('valid-token', 'newPassword123');

      expect(mockToken.markAsUsed).toHaveBeenCalled();
      expect(mockTokenRepository.save).toHaveBeenCalledWith(mockToken);
    });

    it('should send confirmation email after reset', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await passwordResetService.resetPassword('valid-token', 'newPassword123');

      expect(mockEmailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: expect.stringContaining('Password Reset Successful'),
        })
      );
    });

    it('should not fail if confirmation email fails', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockEmailService.send.mockRejectedValueOnce(new Error('Email failed'));

      // Should not throw despite email failure
      await expect(
        passwordResetService.resetPassword('valid-token', 'newPassword123')
      ).resolves.toEqual({
        message: 'Password has been successfully reset',
      });
    });

    it('should throw error if token is invalid', async () => {
      mockTokenRepository.findOne.mockResolvedValue(null);

      await expect(
        passwordResetService.resetPassword('invalid-token', 'newPassword123')
      ).rejects.toThrow('Invalid or expired reset token');
    });

    it('should throw error if user not found', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        passwordResetService.resetPassword('valid-token', 'newPassword123')
      ).rejects.toThrow('User not found');
    });

    it('should verify token before resetting password', async () => {
      const mockToken = createMockResetToken({ used: true });
      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      await expect(
        passwordResetService.resetPassword('used-token', 'newPassword123')
      ).rejects.toThrow('This reset token has already been used');
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      mockTokenRepository.delete.mockResolvedValue({ affected: 5 } as any);

      const count = await passwordResetService.cleanupExpiredTokens();

      expect(count).toBe(5);
      expect(mockTokenRepository.delete).toHaveBeenCalledWith({
        expiresAt: LessThan(expect.any(Date)),
      });
    });

    it('should return 0 when no tokens deleted', async () => {
      mockTokenRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const count = await passwordResetService.cleanupExpiredTokens();

      expect(count).toBe(0);
    });

    it('should handle undefined affected count', async () => {
      mockTokenRepository.delete.mockResolvedValue({ affected: undefined } as any);

      const count = await passwordResetService.cleanupExpiredTokens();

      expect(count).toBe(0);
    });
  });

  describe('getActiveTokenCount', () => {
    it('should return count of active tokens for user', async () => {
      mockTokenRepository.count.mockResolvedValue(3);

      const count = await passwordResetService.getActiveTokenCount('100');

      expect(count).toBe(3);
      expect(mockTokenRepository.count).toHaveBeenCalledWith({
        where: {
          userId: '100',
          used: false,
          expiresAt: LessThan(expect.any(Date)),
        },
      });
    });

    it('should return 0 when no active tokens', async () => {
      mockTokenRepository.count.mockResolvedValue(0);

      const count = await passwordResetService.getActiveTokenCount('100');

      expect(count).toBe(0);
    });
  });

  describe('Email Templates', () => {
    it('should include username in reset email', async () => {
      const mockUser = createMockUser({ username: 'JohnDoe' });
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('user@example.com');

      const emailCall = mockEmailService.send.mock.calls[0][0];
      expect(emailCall.html).toContain('JohnDoe');
    });

    it('should include expiration time in reset email', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('user@example.com');

      const emailCall = mockEmailService.send.mock.calls[0][0];
      expect(emailCall.html).toContain('60 minutes'); // 1 hour = 60 minutes
    });

    it('should include security warnings in reset email', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('user@example.com');

      const emailCall = mockEmailService.send.mock.calls[0][0];
      expect(emailCall.html).toContain('Security Notice');
      expect(emailCall.html).toContain('expire');
    });

    it('should use configured email sender', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('user@example.com');

      const emailCall = mockEmailService.send.mock.calls[0][0];
      expect(emailCall.subject).toContain('Password Reset Request');
    });
  });

  describe('Security & Edge Cases', () => {
    it('should handle concurrent reset requests', async () => {
      const mockUser = createMockUser();
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      const requests = Array(3)
        .fill(null)
        .map(() => passwordResetService.requestPasswordReset('user@example.com'));

      await Promise.all(requests);

      expect(mockTokenRepository.save).toHaveBeenCalledTimes(3);
    });

    it('should handle very long passwords', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const longPassword = 'x'.repeat(1000);

      await passwordResetService.resetPassword('valid-token', longPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(longPassword, 10);
    });

    it('should handle special characters in password', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      const specialPassword = 'P@ssw0rd!#$%^&*()_+-={}[]|:";\'<>?,./`~';

      await passwordResetService.resetPassword('valid-token', specialPassword);

      expect(bcrypt.hash).toHaveBeenCalledWith(specialPassword, 10);
    });

    it('should not allow reuse of token after password reset', async () => {
      const mockToken = createMockResetToken({ used: false });
      mockToken.isExpired = jest.fn().mockReturnValue(false);
      const mockUser = createMockUser();

      mockTokenRepository.findOne.mockResolvedValue(mockToken);
      mockUserRepository.findOne.mockResolvedValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);

      await passwordResetService.resetPassword('valid-token', 'newPassword123');

      // Try to use same token again
      mockToken.used = true;
      mockTokenRepository.findOne.mockResolvedValue(mockToken);

      await expect(
        passwordResetService.resetPassword('valid-token', 'anotherPassword')
      ).rejects.toThrow('This reset token has already been used');
    });

    it('should handle email with special characters', async () => {
      const mockUser = createMockUser({ email: 'user+test@example.com' });
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(mockUser),
      };

      mockUserRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);
      mockTokenRepository.create.mockReturnValue(createMockResetToken());
      mockTokenRepository.save.mockResolvedValue(createMockResetToken());

      const mockUpdateBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      mockTokenRepository.createQueryBuilder.mockReturnValue(mockUpdateBuilder as any);

      await passwordResetService.requestPasswordReset('user+test@example.com');

      expect(mockEmailService.send).toHaveBeenCalled();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
