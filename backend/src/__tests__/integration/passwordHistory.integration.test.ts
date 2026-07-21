/**
 * Integration test for password history functionality
 * Tests the complete flow of password changes and history validation
 */

import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { PasswordHistory } from '../../models/PasswordHistory';
import { User } from '../../models/User';
import { PasswordResetService } from '../../services/authentication/PasswordResetService';
import { AccountSecurityService } from '../../services/security/core/AccountSecurityService';
import { UserAuthenticationService } from '../../services/user/UserAuthenticationService';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEventType: {
    AUTH_FAILURE: 'AUTH_FAILURE',
    SECURITY_LEVEL_CHANGED: 'SECURITY_LEVEL_CHANGED',
  },
}));

jest.mock('../../services/security/core/TokenEncryptionService', () => ({
  getTokenEncryptionService: jest.fn(() => ({
    encrypt: jest.fn((data: string) => ({ encrypted: data, iv: 'iv', authTag: 'tag' })),
    decrypt: jest.fn((encrypted: string) => encrypted),
  })),
}));

// Mock nodemailer to prevent actual email sending
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({}),
  })),
}));

describe('Password History - Integration Tests', () => {
  let userRepository: jest.Mocked<Repository<User>>;
  let passwordHistoryRepository: jest.Mocked<Repository<PasswordHistory>>;
  let tokenRepository: any;
  let securityService: AccountSecurityService;
  let authService: UserAuthenticationService;
  let passwordResetService: PasswordResetService;

  const testUserId = 'test-user-123';
  const testUser: User = {
    id: testUserId,
    username: 'testuser',
    email: 'test@example.com',
    password: '',
  } as User;

  beforeAll(() => {
    // Setup repository mocks
    userRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(entity => Promise.resolve(entity)),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn(),
      })),
    } as unknown as jest.Mocked<Repository<User>>;

    passwordHistoryRepository = {
      find: jest.fn(),
      create: jest.fn(entity => entity as PasswordHistory),
      save: jest.fn(entity => Promise.resolve(entity as PasswordHistory)),
      delete: jest.fn(() => Promise.resolve({ affected: 1, raw: {} })),
    } as unknown as jest.Mocked<Repository<PasswordHistory>>;

    tokenRepository = {
      findOne: jest.fn(),
      save: jest.fn(entity => Promise.resolve(entity)),
    };

    // Setup AppDataSource mock
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: any) => {
      if (entity === User || entity.name === 'User') {
        return userRepository;
      }
      if (entity === PasswordHistory || entity.name === 'PasswordHistory') {
        return passwordHistoryRepository;
      }
      if (entity.name === 'PasswordResetToken') {
        return tokenRepository;
      }
      // Return basic mock for other repositories
      return {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(e => e),
        save: jest.fn(e => Promise.resolve(e)),
      } as unknown as Repository<unknown>;
    });

    // Initialize services
    securityService = AccountSecurityService.getInstance();
    authService = new UserAuthenticationService();
    passwordResetService = new PasswordResetService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Restore bcrypt mocks to allow each test to set up its own
    jest.restoreAllMocks();
  });

  describe('UserAuthenticationService.updatePassword', () => {
    it('should add password to history after successful password update', async () => {
      const oldPassword = 'OldPassword123!';
      const newPassword = 'NewPassword456!';
      const oldHash = await bcrypt.hash(oldPassword, 10);
      const newHash = await bcrypt.hash(newPassword, 10);

      // Mock user with existing password
      const userWithPassword = { ...testUser, password: oldHash };

      // Mock the query builder to return the user
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithPassword),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Mock no password history
      passwordHistoryRepository.find.mockResolvedValue([]);

      // Mock bcrypt.hash to return our pre-computed hash
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(newHash as never);

      await authService.updatePassword(testUserId, oldPassword, newPassword);

      // Verify password was added to history
      expect(passwordHistoryRepository.create).toHaveBeenCalledWith({
        userId: testUserId,
        passwordHash: newHash,
      });
      expect(passwordHistoryRepository.save).toHaveBeenCalled();
    });

    it('should prevent password reuse from history', async () => {
      const oldPassword = 'OldPassword123!';
      const reusedPassword = 'OldPassword123!'; // Same as old password
      const oldHash = await bcrypt.hash(oldPassword, 10);

      // Mock user with existing password
      const userWithPassword = { ...testUser, password: oldHash };

      // Mock the query builder to return the user
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithPassword),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Mock password history with the old password
      const historyEntry = {
        id: '1',
        userId: testUserId,
        passwordHash: oldHash,
        createdAt: new Date(),
      } as PasswordHistory;
      passwordHistoryRepository.find.mockResolvedValue([historyEntry]);

      // Mock bcrypt.compare to return true when comparing reusedPassword with oldHash
      jest.spyOn(bcrypt, 'compare').mockImplementation((async (password: string, hash: string) => {
        if (password === oldPassword && hash === oldHash) return true;
        if (password === reusedPassword && hash === oldHash) return true;
        return false;
      }) as any);

      // Should throw error about password reuse
      await expect(
        authService.updatePassword(testUserId, oldPassword, reusedPassword)
      ).rejects.toThrow(AccountSecurityService.PASSWORD_REUSE_ERROR);

      // Verify password was NOT added to history
      expect(passwordHistoryRepository.save).not.toHaveBeenCalled();
    });

    it('should allow password change when not in history', async () => {
      const oldPassword = 'OldPassword123!';
      const newPassword = 'BrandNewPassword789!';
      const oldHash = await bcrypt.hash(oldPassword, 10);
      const oldHash2 = await bcrypt.hash('EvenOlderPassword!', 10);

      // Mock user with existing password
      const userWithPassword = { ...testUser, password: oldHash };

      // Mock the query builder to return the user
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithPassword),
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Mock password history with different passwords
      const historyEntries = [
        {
          id: '1',
          userId: testUserId,
          passwordHash: oldHash2,
          createdAt: new Date(Date.now() - 86400000),
        },
      ] as PasswordHistory[];
      passwordHistoryRepository.find.mockResolvedValue(historyEntries);

      // Mock bcrypt.compare to return correct values
      jest.spyOn(bcrypt, 'compare').mockImplementation((async (password: string, hash: string) => {
        if (password === oldPassword && hash === oldHash) return true;
        if (password === newPassword && hash === oldHash2) return false; // New password not in history
        return false;
      }) as any);

      await authService.updatePassword(testUserId, oldPassword, newPassword);

      // Verify password was added to history
      expect(passwordHistoryRepository.save).toHaveBeenCalled();
    });
  });

  describe('PasswordResetService.resetPassword', () => {
    it('should add password to history after successful reset', async () => {
      const newPassword = 'NewResetPassword123!';
      const newHash = await bcrypt.hash(newPassword, 10);
      const mockToken = 'valid-reset-token';

      // Mock token
      tokenRepository.findOne.mockResolvedValue({
        userId: testUserId,
        token: mockToken,
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
        isExpired: jest.fn().mockReturnValue(false),
        markAsUsed: jest.fn(),
      });

      // Mock user
      userRepository.findOne.mockResolvedValue(testUser);

      // Mock no password history
      passwordHistoryRepository.find.mockResolvedValue([]);

      // Mock bcrypt.hash
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(newHash as never);

      await passwordResetService.resetPassword(mockToken, newPassword);

      // Verify password was added to history
      expect(passwordHistoryRepository.create).toHaveBeenCalledWith({
        userId: testUserId,
        passwordHash: newHash,
      });
      expect(passwordHistoryRepository.save).toHaveBeenCalled();
    });

    it('should prevent password reset with password from history', async () => {
      const reusedPassword = 'UsedPassword123!';
      const reusedHash = await bcrypt.hash(reusedPassword, 10);
      const mockToken = 'valid-reset-token';

      // Mock token with markAsUsed method
      const resetToken = {
        userId: testUserId,
        token: mockToken,
        used: false,
        expiresAt: new Date(Date.now() + 3600000),
        isExpired: jest.fn().mockReturnValue(false),
        markAsUsed: jest.fn(),
      };
      tokenRepository.findOne.mockResolvedValue(resetToken);

      // Mock user
      userRepository.findOne.mockResolvedValue(testUser);

      // Mock password history with the reused password
      const historyEntry = {
        id: '1',
        userId: testUserId,
        passwordHash: reusedHash,
        createdAt: new Date(),
      } as PasswordHistory;
      passwordHistoryRepository.find.mockResolvedValue([historyEntry]);

      // Mock bcrypt.compare to return true when comparing reusedPassword with reusedHash
      jest.spyOn(bcrypt, 'compare').mockImplementation((async (password: string, hash: string) => {
        if (password === reusedPassword && hash === reusedHash) return true;
        return false;
      }) as any);

      // Should throw error about password reuse
      await expect(passwordResetService.resetPassword(mockToken, reusedPassword)).rejects.toThrow(
        AccountSecurityService.PASSWORD_REUSE_ERROR
      );
    });
  });

  describe('Password History Cleanup', () => {
    it('should keep only the last 12 passwords', async () => {
      const newPassword = 'NewPassword123!';
      const newHash = await bcrypt.hash(newPassword, 10);

      // Create 15 history entries (more than the limit of 12)
      const historyEntries = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        userId: testUserId,
        passwordHash: `hash-${i}`,
        createdAt: new Date(Date.now() - i * 86400000),
      })) as PasswordHistory[];

      passwordHistoryRepository.find.mockResolvedValue(historyEntries);

      await securityService.addPasswordToHistory(testUserId, newHash);

      // Verify cleanup was called to delete the 3 oldest entries
      expect(passwordHistoryRepository.delete).toHaveBeenCalledWith(['13', '14', '15']);
    });
  });

  describe('End-to-End Password Change Flow', () => {
    it('should complete full password change cycle with history tracking', async () => {
      const passwords = ['FirstPassword123!', 'SecondPassword456!', 'ThirdPassword789!'];

      // Initialize user with first password
      const firstHash = await bcrypt.hash(passwords[0], 10);
      const secondHash = await bcrypt.hash(passwords[1], 10);
      const thirdHash = await bcrypt.hash(passwords[2], 10);

      const userWithFirstPassword = { ...testUser, password: firstHash };
      const userWithSecondPassword = { ...testUser, password: secondHash };
      const userWithThirdPassword = { ...testUser, password: thirdHash };

      // Mock the query builder to return the appropriate user for each call
      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        getOne: jest
          .fn()
          .mockResolvedValueOnce(userWithFirstPassword) // First password change
          .mockResolvedValueOnce(userWithSecondPassword) // Second password change
          .mockResolvedValue(userWithThirdPassword), // Subsequent calls
      };
      userRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      // Start with empty history
      passwordHistoryRepository.find.mockResolvedValue([]);

      // Mock bcrypt.compare for all password comparisons
      jest.spyOn(bcrypt, 'compare').mockImplementation((async (password: string, hash: string) => {
        if (password === passwords[0] && hash === firstHash) return true;
        if (password === passwords[1] && hash === secondHash) return true;
        if (password === passwords[2] && hash === thirdHash) return true;
        // For history checks
        if (password === passwords[1] && hash === secondHash) return true;
        return false;
      }) as any);

      // First password change
      jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce(secondHash as never);
      await authService.updatePassword(testUserId, passwords[0], passwords[1]);

      expect(passwordHistoryRepository.save).toHaveBeenCalledTimes(1);

      // Second password change - should have 1 entry in history now (the previous NEW password)
      jest.spyOn(bcrypt, 'hash').mockResolvedValueOnce(thirdHash as never);
      passwordHistoryRepository.find.mockResolvedValue([
        {
          id: '1',
          userId: testUserId,
          passwordHash: secondHash, // Second password (previous new password) is now in history
          createdAt: new Date(Date.now() - 86400000),
        } as PasswordHistory,
      ]);

      await authService.updatePassword(testUserId, passwords[1], passwords[2]);

      expect(passwordHistoryRepository.save).toHaveBeenCalledTimes(2);

      // Try to reuse second password (which is in history) - should fail
      passwordHistoryRepository.find.mockResolvedValue([
        {
          id: '1',
          userId: testUserId,
          passwordHash: firstHash, // First password in history
          createdAt: new Date(Date.now() - 86400000),
        },
        {
          id: '2',
          userId: testUserId,
          passwordHash: secondHash, // Second password in history
          createdAt: new Date(),
        } as PasswordHistory,
      ]);

      // Try to reuse second password which is in history
      await expect(
        authService.updatePassword(testUserId, passwords[2], passwords[1])
      ).rejects.toThrow(AccountSecurityService.PASSWORD_REUSE_ERROR);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
