/**
 * Tests for AccountSecurityService lockout, recovery, and security stats functionality
 * Covers: isAccountLocked, recordFailedAttempt, resetFailedAttempts,
 *         getLockoutStatus, unlockAccount, generateRecoveryCodes, hashRecoveryCodes,
 *         initiateEmailRecovery, verifyRecoveryToken, markTokenUsed,
 *         disable2FAWithRecovery, cleanupExpiredTokens, logSecurityEvent, getSecurityStats
 */

import crypto from 'node:crypto';

import { MoreThan, Repository } from 'typeorm';

import { RecoveryToken } from '../../models/RecoveryToken';
import { User } from '../../models/User';
import { AccountSecurityService } from '../../services/security/core/AccountSecurityService';

// Mock dependencies
const mockLogAuditEvent = jest.fn();
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/auditLogger', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  AuditEventType: {
    SECURITY_LEVEL_CHANGED: 'SECURITY_LEVEL_CHANGED',
    AUTH_FAILURE: 'AUTH_FAILURE',
  },
}));

const mockEncrypt = jest.fn();
const mockDecrypt = jest.fn();
jest.mock('../../services/security/core/TokenEncryptionService', () => ({
  getTokenEncryptionService: jest.fn(() => ({
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
  })),
  TokenEncryptionService: jest.fn(),
}));

jest.mock('../../utils/apiErrors', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(resource: string, id?: string) {
      super(id ? `${resource} with id ${id} not found` : `${resource} not found`);
      this.name = 'NotFoundError';
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  DatabaseError: class DatabaseError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'DatabaseError';
    }
  },
}));

// Import after mocks
import { AppDataSource } from '../../config/database';

describe('AccountSecurityService - Lockout, Recovery & Stats', () => {
  let securityService: AccountSecurityService;
  let mockUserRepository: jest.Mocked<Repository<User>>;
  let mockRecoveryTokenRepository: jest.Mocked<Repository<RecoveryToken>>;

  function createMockUser(overrides: Partial<User> = {}): User {
    return {
      id: 'user-123',
      email: 'test@example.com',
      failedLoginAttempts: 0,
      lockedUntil: undefined,
      twoFactorEnabled: false,
      twoFactorSecret: undefined,
      failedTwoFactorAttempts: 0,
      ...overrides,
    } as User;
  }

  beforeAll(() => {
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(entity => Promise.resolve(entity as User)),
      count: jest.fn(),
      increment: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }),
    } as unknown as jest.Mocked<Repository<User>>;

    mockRecoveryTokenRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(entity => entity as RecoveryToken),
      save: jest.fn(entity => Promise.resolve(entity as RecoveryToken)),
      update: jest.fn(() => Promise.resolve({ affected: 1, raw: {}, generatedMaps: [] })),
      count: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      }),
    } as unknown as jest.Mocked<Repository<RecoveryToken>>;

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      if (entity === User || entity.name === 'User') return mockUserRepository;
      if (entity === RecoveryToken || entity.name === 'RecoveryToken')
        return mockRecoveryTokenRepository;
      return {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn((e: unknown) => e),
        save: jest.fn((e: unknown) => Promise.resolve(e)),
      };
    });

    securityService = AccountSecurityService.getInstance();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset the query builder mock for each test
    (mockUserRepository.createQueryBuilder as jest.Mock).mockReturnValue({
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    });
  });

  // =================================================================
  // isAccountLocked
  // =================================================================

  describe('isAccountLocked', () => {
    it('should return false when lockedUntil is undefined', () => {
      const user = createMockUser({ lockedUntil: undefined });
      expect(securityService.isAccountLocked(user)).toBe(false);
    });

    it('should return true when lockedUntil is in the future', () => {
      const user = createMockUser({
        lockedUntil: new Date(Date.now() + 60_000),
      });
      expect(securityService.isAccountLocked(user)).toBe(true);
    });

    it('should return false when lockedUntil is in the past', () => {
      const user = createMockUser({
        lockedUntil: new Date(Date.now() - 60_000),
        failedLoginAttempts: 5,
      });
      expect(securityService.isAccountLocked(user)).toBe(false);
    });
  });

  // =================================================================
  // recordFailedAttempt
  // =================================================================

  describe('recordFailedAttempt', () => {
    it('should atomically increment and return remaining attempts', async () => {
      const user = createMockUser({ failedLoginAttempts: 2 });
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await securityService.recordFailedAttempt('user-123');

      expect(result.isLocked).toBe(false);
      expect(result.attemptsRemaining).toBe(3);
      expect(mockUserRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should lock account when threshold is reached', async () => {
      const user = createMockUser({ failedLoginAttempts: 5 });
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await securityService.recordFailedAttempt('user-123');

      expect(result.isLocked).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.lockedUntil).toBeDefined();
      // Lockout is now applied via an atomic QueryBuilder update (not save)
      expect(mockUserRepository.createQueryBuilder).toHaveBeenCalled();
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account_locked',
        })
      );
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(securityService.recordFailedAttempt('unknown-user')).rejects.toThrow(
        'not found'
      );
    });

    it('should throw DatabaseError on repository failure', async () => {
      (mockUserRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('DB error')),
      });

      await expect(securityService.recordFailedAttempt('user-123')).rejects.toThrow(
        'Failed to record login attempt'
      );
    });
  });

  // =================================================================
  // resetFailedAttempts
  // =================================================================

  describe('resetFailedAttempts', () => {
    it('should reset attempts and clear lockout for a locked user', async () => {
      const user = createMockUser({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      mockUserRepository.findOne.mockResolvedValue(user);

      await securityService.resetFailedAttempts('user-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: undefined,
        })
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'lockout_reset',
          metadata: expect.objectContaining({ previousAttempts: 5 }),
        })
      );
    });

    it('should do nothing if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await securityService.resetFailedAttempts('unknown');

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });

    it('should not log audit event when no lockout was active', async () => {
      const user = createMockUser({ failedLoginAttempts: 0 });
      mockUserRepository.findOne.mockResolvedValue(user);

      await securityService.resetFailedAttempts('user-123');

      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  });

  // =================================================================
  // getLockoutStatus
  // =================================================================

  describe('getLockoutStatus', () => {
    it('should return unlocked status with zero attempts', async () => {
      const user = createMockUser();
      mockUserRepository.findOne.mockResolvedValue(user);

      const status = await securityService.getLockoutStatus('user-123');

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
      expect(status.attemptsRemaining).toBe(5);
      expect(status.lockedUntil).toBeUndefined();
      expect(status.lockoutExpiresIn).toBeUndefined();
    });

    it('should return locked status with expiry info', async () => {
      const lockedUntil = new Date(Date.now() + 60_000);
      const user = createMockUser({
        failedLoginAttempts: 5,
        lockedUntil,
      });
      mockUserRepository.findOne.mockResolvedValue(user);

      const status = await securityService.getLockoutStatus('user-123');

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
      expect(status.attemptsRemaining).toBe(0);
      expect(status.lockedUntil).toBe(lockedUntil);
      expect(status.lockoutExpiresIn).toBeGreaterThan(0);
    });

    it('should throw NotFoundError for nonexistent user', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(securityService.getLockoutStatus('unknown')).rejects.toThrow('not found');
    });
  });

  // =================================================================
  // unlockAccount
  // =================================================================

  describe('unlockAccount', () => {
    it('should unlock a locked account and log audit event', async () => {
      const user = createMockUser({
        failedLoginAttempts: 5,
        lockedUntil: new Date(Date.now() + 60_000),
      });
      mockUserRepository.findOne.mockResolvedValue(user);

      await securityService.unlockAccount('user-123');

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: undefined,
        })
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'account_unlocked',
          metadata: expect.objectContaining({ reason: 'admin_override' }),
        })
      );
    });

    it('should not log audit event if account was not locked', async () => {
      const user = createMockUser();
      mockUserRepository.findOne.mockResolvedValue(user);

      await securityService.unlockAccount('user-123');

      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(securityService.unlockAccount('unknown')).rejects.toThrow('not found');
    });
  });

  // =================================================================
  // generateRecoveryCodes / hashRecoveryCodes
  // =================================================================

  describe('generateRecoveryCodes', () => {
    it('should generate the requested number of codes', () => {
      const codes = securityService.generateRecoveryCodes(5);
      expect(codes).toHaveLength(5);
    });

    it('should default to 8 codes', () => {
      const codes = securityService.generateRecoveryCodes();
      expect(codes).toHaveLength(8);
    });

    it('should produce codes in XXXX-XXXX-XXXX format', () => {
      const codes = securityService.generateRecoveryCodes(3);
      for (const code of codes) {
        expect(code).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/);
      }
    });

    it('should generate unique codes', () => {
      const codes = securityService.generateRecoveryCodes(20);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });
  });

  describe('hashRecoveryCodes', () => {
    it('should hash each code with SHA-256', () => {
      const codes = ['AAAA-BBBB-CCCC'];
      const hashes = securityService.hashRecoveryCodes(codes);

      expect(hashes).toHaveLength(1);
      const expected = crypto.createHash('sha256').update('AAAABBBBCCCC').digest('hex');
      expect(hashes[0]).toBe(expected);
    });

    it('should produce deterministic hashes', () => {
      const codes = ['1234-5678-9ABC'];
      const hashes1 = securityService.hashRecoveryCodes(codes);
      const hashes2 = securityService.hashRecoveryCodes(codes);
      expect(hashes1).toEqual(hashes2);
    });
  });

  // =================================================================
  // initiateEmailRecovery
  // =================================================================

  describe('initiateEmailRecovery', () => {
    beforeEach(() => {
      mockEncrypt.mockReturnValue({
        encrypted: 'enc-data',
        iv: 'enc-iv',
        authTag: 'enc-tag',
      });
    });

    it('should create a recovery token for an existing user', async () => {
      const user = createMockUser();
      mockUserRepository.findOne.mockResolvedValue(user);

      const result = await securityService.initiateEmailRecovery('test@example.com');

      expect(result.token).toHaveLength(64); // 32 bytes hex
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockRecoveryTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'email',
          isUsed: false,
          tokenHash: expect.any(String),
        })
      );
      expect(mockRecoveryTokenRepository.save).toHaveBeenCalled();
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'recovery_initiated' })
      );
    });

    it('should return a valid-looking token even for nonexistent email', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await securityService.initiateEmailRecovery('nonexistent@example.com');

      expect(result.token).toHaveLength(64);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockRecoveryTokenRepository.save).not.toHaveBeenCalled();
    });

    it('should still perform encryption work for nonexistent email (timing normalization)', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await securityService.initiateEmailRecovery('nonexistent@example.com');

      expect(mockEncrypt).toHaveBeenCalled();
    });

    it('should use the specified recovery type', async () => {
      const user = createMockUser();
      mockUserRepository.findOne.mockResolvedValue(user);

      await securityService.initiateEmailRecovery('test@example.com', 'admin');

      expect(mockRecoveryTokenRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'admin' })
      );
    });
  });

  // =================================================================
  // verifyRecoveryToken
  // =================================================================

  describe('verifyRecoveryToken', () => {
    const rawToken = 'a'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    it('should return the token when hash matches and decryption succeeds', async () => {
      const mockToken = {
        id: 1,
        userId: 'user-123',
        tokenHash,
        token: JSON.stringify({ encrypted: 'e', iv: 'i', authTag: 't' }),
        isUsed: false,
        expiresAt: new Date(Date.now() + 60_000),
      } as unknown as RecoveryToken;

      mockRecoveryTokenRepository.findOne.mockResolvedValue(mockToken);
      mockDecrypt.mockReturnValue(rawToken);

      const result = await securityService.verifyRecoveryToken(rawToken);

      expect(result).toBe(mockToken);
      expect(mockRecoveryTokenRepository.findOne).toHaveBeenCalledWith({
        where: {
          tokenHash,
          isUsed: false,
          expiresAt: MoreThan(expect.any(Date)),
        },
      });
    });

    it('should return null when no matching token found', async () => {
      mockRecoveryTokenRepository.findOne.mockResolvedValue(null);

      const result = await securityService.verifyRecoveryToken('invalid-token');

      expect(result).toBeNull();
    });

    it('should return null when decryption fails', async () => {
      const mockToken = {
        id: 1,
        userId: 'user-123',
        tokenHash,
        token: JSON.stringify({ encrypted: 'e', iv: 'i', authTag: 't' }),
        isUsed: false,
        expiresAt: new Date(Date.now() + 60_000),
      } as unknown as RecoveryToken;

      mockRecoveryTokenRepository.findOne.mockResolvedValue(mockToken);
      mockDecrypt.mockImplementation(() => {
        throw new Error('decrypt failed');
      });

      const result = await securityService.verifyRecoveryToken(rawToken);

      expect(result).toBeNull();
    });

    it('should return null when decrypted value does not match', async () => {
      const mockToken = {
        id: 1,
        userId: 'user-123',
        tokenHash,
        token: JSON.stringify({ encrypted: 'e', iv: 'i', authTag: 't' }),
        isUsed: false,
        expiresAt: new Date(Date.now() + 60_000),
      } as unknown as RecoveryToken;

      mockRecoveryTokenRepository.findOne.mockResolvedValue(mockToken);
      mockDecrypt.mockReturnValue('b'.repeat(64)); // Different value, same length

      const result = await securityService.verifyRecoveryToken(rawToken);

      expect(result).toBeNull();
    });
  });

  // =================================================================
  // markTokenUsed
  // =================================================================

  describe('markTokenUsed', () => {
    it('should update both isUsed and used fields and set usedAt', async () => {
      await securityService.markTokenUsed(42);

      expect(mockRecoveryTokenRepository.update).toHaveBeenCalledWith(42, {
        isUsed: true,
        used: true,
        usedAt: expect.any(Date),
      });
    });

    it('should throw DatabaseError on failure', async () => {
      (mockRecoveryTokenRepository.update as jest.Mock).mockRejectedValue(new Error('DB fail'));

      await expect(securityService.markTokenUsed(42)).rejects.toThrow(
        'Failed to mark token as used'
      );
    });
  });

  // =================================================================
  // disable2FAWithRecovery
  // =================================================================

  describe('disable2FAWithRecovery', () => {
    it('should disable 2FA when recovery token is valid', async () => {
      const recoveryToken = { id: 10, userId: 'user-123', isUsed: true } as RecoveryToken;
      mockRecoveryTokenRepository.findOne.mockResolvedValue(recoveryToken);

      const user = createMockUser({
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
        failedTwoFactorAttempts: 2,
      });
      mockUserRepository.findOne.mockResolvedValue(user);

      await securityService.disable2FAWithRecovery('user-123', 'email', 10);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          twoFactorEnabled: false,
          twoFactorSecret: undefined,
          failedTwoFactorAttempts: 0,
        })
      );
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: '2fa_disabled',
          metadata: expect.objectContaining({ recoveryTokenId: 10 }),
        })
      );
    });

    it('should throw ValidationError when recovery token is invalid', async () => {
      mockRecoveryTokenRepository.findOne.mockResolvedValue(null);

      await expect(
        securityService.disable2FAWithRecovery('user-123', 'email', 999)
      ).rejects.toThrow('Invalid or unconsumed recovery token');
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockRecoveryTokenRepository.findOne.mockResolvedValue({
        id: 10,
        userId: 'user-123',
        isUsed: true,
      } as RecoveryToken);
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(securityService.disable2FAWithRecovery('user-123', 'email', 10)).rejects.toThrow(
        'not found'
      );
    });

    it('should skip silently if 2FA is not enabled', async () => {
      mockRecoveryTokenRepository.findOne.mockResolvedValue({
        id: 10,
        userId: 'user-123',
        isUsed: true,
      } as RecoveryToken);
      const user = createMockUser({ twoFactorEnabled: false });
      mockUserRepository.findOne.mockResolvedValue(user);

      await securityService.disable2FAWithRecovery('user-123', 'email', 10);

      expect(mockUserRepository.save).not.toHaveBeenCalled();
    });
  });

  // =================================================================
  // cleanupExpiredTokens
  // =================================================================

  describe('cleanupExpiredTokens', () => {
    it('should return the count of deleted tokens', async () => {
      const count = await securityService.cleanupExpiredTokens();
      expect(count).toBe(3);
      expect(mockRecoveryTokenRepository.createQueryBuilder).toHaveBeenCalled();
    });

    it('should return 0 on error', async () => {
      (mockRecoveryTokenRepository.createQueryBuilder as jest.Mock).mockReturnValue({
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('DB fail')),
      });

      const count = await securityService.cleanupExpiredTokens();
      expect(count).toBe(0);
    });
  });

  // =================================================================
  // logSecurityEvent
  // =================================================================

  describe('logSecurityEvent', () => {
    it('should delegate to logAuditEvent with service context', async () => {
      await securityService.logSecurityEvent(
        'SECURITY_LEVEL_CHANGED' as never,
        { message: 'Test event', detail: 'extra' },
        'user-123',
        '127.0.0.1'
      );

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          ipAddress: '127.0.0.1',
          message: 'Test event',
          metadata: expect.objectContaining({
            service: 'AccountSecurityService',
            detail: 'extra',
          }),
        })
      );
    });

    it('should use default message when data.message is absent', async () => {
      await securityService.logSecurityEvent('SECURITY_LEVEL_CHANGED' as never, {
        detail: 'no-message',
      });

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Security event' })
      );
    });

    it('should not throw if logAuditEvent throws', async () => {
      mockLogAuditEvent.mockImplementation(() => {
        throw new Error('audit fail');
      });

      await expect(
        securityService.logSecurityEvent('SECURITY_LEVEL_CHANGED' as never, {})
      ).resolves.toBeUndefined();
    });
  });

  // =================================================================
  // getSecurityStats
  // =================================================================

  describe('getSecurityStats', () => {
    it('should return counts from repositories', async () => {
      mockUserRepository.count
        .mockResolvedValueOnce(2) // locked accounts
        .mockResolvedValueOnce(7); // failed attempts
      mockRecoveryTokenRepository.count.mockResolvedValue(3);

      const stats = await securityService.getSecurityStats();

      expect(stats).toEqual({
        lockedAccounts: 2,
        recentFailedAttempts: 7,
        activeRecoveryTokens: 3,
      });
    });

    it('should return zeros on database error', async () => {
      mockUserRepository.count.mockRejectedValue(new Error('DB fail'));

      const stats = await securityService.getSecurityStats();

      expect(stats).toEqual({
        lockedAccounts: 0,
        recentFailedAttempts: 0,
        activeRecoveryTokens: 0,
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
