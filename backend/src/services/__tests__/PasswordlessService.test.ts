import crypto from 'crypto';

import { AppDataSource } from '../../data-source';
import { PasswordlessToken } from '../../models/PasswordlessToken';
import { User } from '../../models/User';
import { PasswordlessService } from '../authentication/PasswordlessService';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn(() => Promise.resolve()),
  })),
}));

describe('PasswordlessService', () => {
  let passwordlessService: PasswordlessService;
  let mockTokenRepo: any;
  let mockUserRepo: any;

  const testUser = {
    id: 'user-123',
    username: 'testuser',
    email: 'test@example.com',
  } as User;

  const testMetadata = {
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set environment for email
    process.env.EMAIL_USER = 'test@example.com';
    process.env.EMAIL_PASS = 'testpass';

    // Mock token repository
    mockTokenRepo = {
      create: jest.fn(data => ({
        ...data,
        isExpired: () => new Date() > data.expiresAt,
        isLocked: () => (data.attempts || 0) >= (data.maxAttempts || 5),
        isValid: () =>
          !data.used &&
          new Date() <= data.expiresAt &&
          (data.attempts || 0) < (data.maxAttempts || 5),
      })),
      save: jest.fn(entity => Promise.resolve(entity)),
      findOne: jest.fn(),
      update: jest.fn(() => Promise.resolve({ affected: 1 })),
      delete: jest.fn(() => Promise.resolve({ affected: 1 })),
      count: jest.fn(() => Promise.resolve(0)),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest.fn(() => Promise.resolve(0)),
      })),
    };

    // Mock user repository
    mockUserRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn(() => Promise.resolve(testUser)),
      })),
    };

    // Mock AppDataSource.getRepository
    (AppDataSource.getRepository as jest.Mock) = jest.fn(entity => {
      if (entity === PasswordlessToken) {
        return mockTokenRepo;
      }
      if (entity === User) {
        return mockUserRepo;
      }
      return {};
    });

    // Create service instance
    passwordlessService = new PasswordlessService();
  });

  describe('Magic Link Flow', () => {
    describe('sendMagicLink', () => {
      it('should send magic link for existing user', async () => {
        const result = await passwordlessService.sendMagicLink(
          testUser.email,
          'login',
          testMetadata
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('Magic link sent');
        expect(result.expiresAt).toBeInstanceOf(Date);
        expect(result.tokenId).toBeDefined();
        expect(mockTokenRepo.save).toHaveBeenCalled();
      });

      it('should send magic link for new user (registration)', async () => {
        mockUserRepo.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          getOne: jest.fn(() => Promise.resolve(null)), // No user found
        });

        const result = await passwordlessService.sendMagicLink(
          'new@example.com',
          'register',
          testMetadata
        );

        expect(result.success).toBe(true);
        const savedToken = mockTokenRepo.save.mock.calls[0][0];
        expect(savedToken.userId).toBeUndefined();
        expect(savedToken.email).toBe('new@example.com');
      });

      it('should invalidate existing tokens before creating new one', async () => {
        await passwordlessService.sendMagicLink(testUser.email, 'login');

        expect(mockTokenRepo.update).toHaveBeenCalledWith(
          expect.objectContaining({
            email: testUser.email,
            purpose: 'login',
            used: false,
          }),
          expect.objectContaining({ used: true })
        );
      });

      it('should enforce rate limiting', async () => {
        mockTokenRepo.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getCount: jest.fn(() => Promise.resolve(10)), // Exceeded limit
        });

        await expect(passwordlessService.sendMagicLink(testUser.email, 'login')).rejects.toThrow(
          'Too many requests'
        );
      });
    });

    describe('verifyMagicLink', () => {
      it('should verify valid magic link', async () => {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const mockToken = {
          id: 'token-123',
          userId: testUser.id,
          email: testUser.email,
          tokenHash,
          purpose: 'login',
          used: false,
          expiresAt,
          attempts: 0,
          maxAttempts: 5,
          isExpired: () => false,
          isLocked: () => false,
          isValid: () => true,
        };
        mockTokenRepo.findOne.mockResolvedValue(mockToken);

        const result = await passwordlessService.verifyMagicLink(token, testMetadata);

        expect(result.valid).toBe(true);
        expect(result.userId).toBe(testUser.id);
        expect(result.email).toBe(testUser.email);
        expect(result.isNewUser).toBe(false);
        expect(mockTokenRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({
            used: true,
            verifyIp: testMetadata.ipAddress,
          })
        );
      });

      it('should reject used magic link', async () => {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        mockTokenRepo.findOne.mockResolvedValue({
          tokenHash,
          used: true,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          isExpired: () => false,
          isLocked: () => false,
          isValid: () => false,
        });

        await expect(passwordlessService.verifyMagicLink(token)).rejects.toThrow(
          'already been used'
        );
      });

      it('should reject expired magic link', async () => {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        mockTokenRepo.findOne.mockResolvedValue({
          tokenHash,
          used: false,
          expiresAt: new Date(Date.now() - 1000),
          isExpired: () => true,
          isLocked: () => false,
          isValid: () => false,
        });

        await expect(passwordlessService.verifyMagicLink(token)).rejects.toThrow('expired');
      });

      it('should reject invalid token', async () => {
        mockTokenRepo.findOne.mockResolvedValue(null);

        await expect(passwordlessService.verifyMagicLink('invalid-token')).rejects.toThrow(
          'Invalid or expired magic link'
        );
      });
    });
  });

  describe('Code-Based Flow', () => {
    describe('sendLoginCode', () => {
      it('should send login code for existing user', async () => {
        const result = await passwordlessService.sendLoginCode(
          testUser.email,
          'login',
          testMetadata
        );

        expect(result.success).toBe(true);
        expect(result.message).toContain('Verification code sent');
        expect(result.expiresAt).toBeInstanceOf(Date);
        expect(mockTokenRepo.save).toHaveBeenCalled();

        const savedToken = mockTokenRepo.save.mock.calls[0][0];
        expect(savedToken.tokenType).toBe('code');
        expect(savedToken.tokenHash).toBeDefined();
      });
    });

    describe('verifyCode', () => {
      it('should verify valid code', async () => {
        const code = '123456';
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const mockToken = {
          id: 'token-123',
          userId: testUser.id,
          email: testUser.email,
          tokenHash: codeHash,
          purpose: 'login',
          used: false,
          expiresAt,
          attempts: 0,
          maxAttempts: 5,
          isExpired: () => false,
          isLocked: () => false,
          isValid: () => true,
        };
        mockTokenRepo.findOne.mockResolvedValue(mockToken);

        const result = await passwordlessService.verifyCode(testUser.email, code, testMetadata);

        expect(result.valid).toBe(true);
        expect(result.userId).toBe(testUser.id);
        expect(mockTokenRepo.save).toHaveBeenCalledWith(expect.objectContaining({ used: true }));
      });

      it('should reject invalid code and increment attempts', async () => {
        const code = '123456';
        const wrongCodeHash = crypto.createHash('sha256').update('000000').digest('hex');
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        const mockToken = {
          id: 'token-123',
          email: testUser.email,
          tokenHash: wrongCodeHash,
          used: false,
          expiresAt,
          attempts: 0,
          maxAttempts: 5,
          isExpired: () => false,
          isLocked: () => false,
        };
        mockTokenRepo.findOne.mockResolvedValue(mockToken);

        await expect(passwordlessService.verifyCode(testUser.email, code)).rejects.toThrow(
          'Invalid code'
        );

        expect(mockTokenRepo.save).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
      });

      it('should lock after max attempts', async () => {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        mockTokenRepo.findOne.mockResolvedValue({
          id: 'token-123',
          email: testUser.email,
          tokenHash: 'hash',
          used: false,
          expiresAt,
          attempts: 5,
          maxAttempts: 5,
          isExpired: () => false,
          isLocked: () => true,
        });

        await expect(passwordlessService.verifyCode(testUser.email, '123456')).rejects.toThrow(
          'Too many failed attempts'
        );
      });

      it('should reject expired code', async () => {
        mockTokenRepo.findOne.mockResolvedValue({
          id: 'token-123',
          email: testUser.email,
          tokenHash: 'hash',
          used: false,
          expiresAt: new Date(Date.now() - 1000),
          attempts: 0,
          maxAttempts: 5,
          isExpired: () => true,
          isLocked: () => false,
        });

        await expect(passwordlessService.verifyCode(testUser.email, '123456')).rejects.toThrow(
          'expired'
        );
      });

      it('should handle no pending code', async () => {
        mockTokenRepo.findOne.mockResolvedValue(null);

        await expect(passwordlessService.verifyCode(testUser.email, '123456')).rejects.toThrow(
          'Pending verification code not found'
        );
      });
    });
  });

  describe('Token Management', () => {
    describe('cleanupExpiredTokens', () => {
      it('should delete expired tokens', async () => {
        mockTokenRepo.delete.mockResolvedValue({ affected: 5 });

        const result = await passwordlessService.cleanupExpiredTokens();

        expect(result).toBe(5);
        expect(mockTokenRepo.delete).toHaveBeenCalled();
      });
    });
  });

  describe('Statistics', () => {
    describe('getStats', () => {
      it('should return service statistics', async () => {
        mockTokenRepo.count.mockResolvedValue(10);
        mockTokenRepo.createQueryBuilder.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getCount: jest.fn(() => Promise.resolve(25)),
        });

        const stats = await passwordlessService.getStats();

        expect(stats).toHaveProperty('activeTokens');
        expect(stats).toHaveProperty('usedTokens24h');
        expect(stats).toHaveProperty('expiredTokens');
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

