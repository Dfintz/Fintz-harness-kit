/**
 * Tests for AccountSecurityService password history functionality
 */

import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';

import { PasswordHistory } from '../../models/PasswordHistory';
import { AccountSecurityService } from '../../services/security/core/AccountSecurityService';

// Mock dependencies
jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../utils/auditLogger', () => ({
  logAuditEvent: jest.fn(),
  AuditEventType: {},
}));

jest.mock('../../services/security/core/TokenEncryptionService', () => ({
  getTokenEncryptionService: jest.fn(() => ({})),
}));

// Import after mocks
import { AppDataSource } from '../../config/database';

describe('AccountSecurityService - Password History', () => {
  let securityService: AccountSecurityService;
  let mockPasswordHistoryRepository: jest.Mocked<Repository<PasswordHistory>>;

  beforeAll(() => {
    // Create mock repository
    mockPasswordHistoryRepository = {
      find: jest.fn(),
      create: jest.fn(entity => entity as PasswordHistory),
      save: jest.fn(entity => Promise.resolve(entity as PasswordHistory)),
      delete: jest.fn(() => Promise.resolve({ affected: 1, raw: {} })),
    } as unknown as jest.Mocked<Repository<PasswordHistory>>;

    // Setup AppDataSource mock to always return our mock repository
    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: unknown) => {
      if (entity.name === 'PasswordHistory' || entity === PasswordHistory) {
        return mockPasswordHistoryRepository;
      }
      // Return a basic mock for other repositories
      return {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(e => e),
        save: jest.fn(e => Promise.resolve(e)),
      } as unknown as Repository<unknown>;
    });

    // Get singleton instance
    securityService = AccountSecurityService.getInstance();
  });

  beforeEach(() => {
    // Clear mock call history before each test
    jest.clearAllMocks();
  });

  describe('checkPasswordHistory', () => {
    const userId = 'test-user-123';
    const newPassword = 'NewPassword123!';

    it('should return true when no password history exists', async () => {
      mockPasswordHistoryRepository.find.mockResolvedValue([]);

      const result = await securityService.checkPasswordHistory(userId, newPassword);

      expect(result).toBe(true);
      expect(mockPasswordHistoryRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 12,
      });
    });

    it('should return true when password is not in history', async () => {
      const oldPasswordHash = await bcrypt.hash('OldPassword123!', 10);
      const mockHistory = [
        { id: '1', userId, passwordHash: oldPasswordHash, createdAt: new Date() },
      ] as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      const result = await securityService.checkPasswordHistory(userId, newPassword);

      expect(result).toBe(true);
    });

    it('should return false when password matches one in history', async () => {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const mockHistory = [
        { id: '1', userId, passwordHash, createdAt: new Date() },
      ] as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      const result = await securityService.checkPasswordHistory(userId, newPassword);

      expect(result).toBe(false);
    });

    it('should check against multiple previous passwords', async () => {
      const password1 = await bcrypt.hash('OldPassword1!', 10);
      const password2 = await bcrypt.hash('OldPassword2!', 10);
      const password3 = await bcrypt.hash(newPassword, 10);
      const password4 = await bcrypt.hash('OldPassword4!', 10);

      const mockHistory = [
        { id: '1', userId, passwordHash: password4, createdAt: new Date('2024-01-04') },
        { id: '2', userId, passwordHash: password3, createdAt: new Date('2024-01-03') },
        { id: '3', userId, passwordHash: password2, createdAt: new Date('2024-01-02') },
        { id: '4', userId, passwordHash: password1, createdAt: new Date('2024-01-01') },
      ] as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      const result = await securityService.checkPasswordHistory(userId, newPassword);

      expect(result).toBe(false);
    });

    it('should respect custom history count parameter', async () => {
      mockPasswordHistoryRepository.find.mockResolvedValue([]);

      await securityService.checkPasswordHistory(userId, newPassword, 5);

      expect(mockPasswordHistoryRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 5,
      });
    });

    it('should default to 12 passwords when history count not specified', async () => {
      mockPasswordHistoryRepository.find.mockResolvedValue([]);

      await securityService.checkPasswordHistory(userId, newPassword);

      expect(mockPasswordHistoryRepository.find).toHaveBeenCalledWith({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: 12,
      });
    });

    it('should fail open (return true) on database error', async () => {
      mockPasswordHistoryRepository.find.mockRejectedValue(new Error('Database error'));

      const result = await securityService.checkPasswordHistory(userId, newPassword);

      expect(result).toBe(true);
    });

    it('should handle bcrypt comparison errors gracefully', async () => {
      const mockHistory = [
        { id: '1', userId, passwordHash: 'invalid-hash', createdAt: new Date() },
      ] as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      // Our implementation catches bcrypt errors and fails open (returns true)
      // This is intentional to prevent blocking legitimate password changes
      const result = await securityService.checkPasswordHistory(userId, newPassword);

      expect(result).toBe(true);
    });
  });

  describe('addPasswordToHistory', () => {
    const userId = 'test-user-123';
    const passwordHash = '$2b$10$abcdefghijklmnopqrstuvwxyz';

    it('should create and save a password history entry', async () => {
      const mockEntry = { id: '1', userId, passwordHash, createdAt: new Date() } as PasswordHistory;
      mockPasswordHistoryRepository.create.mockReturnValue(mockEntry);
      mockPasswordHistoryRepository.save.mockResolvedValue(mockEntry);
      mockPasswordHistoryRepository.find.mockResolvedValue([mockEntry]);

      await securityService.addPasswordToHistory(userId, passwordHash);

      expect(mockPasswordHistoryRepository.create).toHaveBeenCalledWith({
        userId,
        passwordHash,
      });
      expect(mockPasswordHistoryRepository.save).toHaveBeenCalledWith(mockEntry);
    });

    it('should trigger cleanup of old password history', async () => {
      const mockEntry = {
        id: '13',
        userId,
        passwordHash,
        createdAt: new Date(),
      } as PasswordHistory;
      mockPasswordHistoryRepository.create.mockReturnValue(mockEntry);
      mockPasswordHistoryRepository.save.mockResolvedValue(mockEntry);

      // Create 13 history entries (1 over the limit)
      const mockHistory = Array.from({ length: 13 }, (_, i) => ({
        id: `${i + 1}`,
        userId,
        passwordHash: `hash-${i}`,
        createdAt: new Date(Date.now() - i * 86400000),
      })) as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      await securityService.addPasswordToHistory(userId, passwordHash);

      // Should delete the oldest entry
      expect(mockPasswordHistoryRepository.delete).toHaveBeenCalledWith(['13']);
    });

    it('should not fail if save errors', async () => {
      const mockEntry = { id: '1', userId, passwordHash, createdAt: new Date() } as PasswordHistory;
      mockPasswordHistoryRepository.create.mockReturnValue(mockEntry);
      mockPasswordHistoryRepository.save.mockRejectedValue(new Error('Save failed'));

      // Should not throw
      await expect(
        securityService.addPasswordToHistory(userId, passwordHash)
      ).resolves.toBeUndefined();
    });
  });

  describe('cleanupOldPasswordHistory (via addPasswordToHistory)', () => {
    const userId = 'test-user-123';
    const passwordHash = '$2b$10$abcdefghijklmnopqrstuvwxyz';

    it('should keep only the most recent 12 passwords', async () => {
      const mockEntry = {
        id: 'new',
        userId,
        passwordHash,
        createdAt: new Date(),
      } as PasswordHistory;
      mockPasswordHistoryRepository.create.mockReturnValue(mockEntry);
      mockPasswordHistoryRepository.save.mockResolvedValue(mockEntry);

      // Create 15 history entries
      const mockHistory = Array.from({ length: 15 }, (_, i) => ({
        id: `${i + 1}`,
        userId,
        passwordHash: `hash-${i}`,
        createdAt: new Date(Date.now() - i * 86400000),
      })) as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      await securityService.addPasswordToHistory(userId, passwordHash);

      // Should delete the 3 oldest entries (15 - 12 = 3)
      expect(mockPasswordHistoryRepository.delete).toHaveBeenCalledWith(['13', '14', '15']);
    });

    it('should not delete anything if under the limit', async () => {
      const mockEntry = {
        id: 'new',
        userId,
        passwordHash,
        createdAt: new Date(),
      } as PasswordHistory;
      mockPasswordHistoryRepository.create.mockReturnValue(mockEntry);
      mockPasswordHistoryRepository.save.mockResolvedValue(mockEntry);

      // Create only 5 history entries
      const mockHistory = Array.from({ length: 5 }, (_, i) => ({
        id: `${i + 1}`,
        userId,
        passwordHash: `hash-${i}`,
        createdAt: new Date(Date.now() - i * 86400000),
      })) as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      await securityService.addPasswordToHistory(userId, passwordHash);

      // Should not delete anything
      expect(mockPasswordHistoryRepository.delete).not.toHaveBeenCalled();
    });

    it('should not fail if cleanup errors', async () => {
      const mockEntry = {
        id: 'new',
        userId,
        passwordHash,
        createdAt: new Date(),
      } as PasswordHistory;
      mockPasswordHistoryRepository.create.mockReturnValue(mockEntry);
      mockPasswordHistoryRepository.save.mockResolvedValue(mockEntry);
      mockPasswordHistoryRepository.find.mockRejectedValue(new Error('Find failed'));

      // Should not throw
      await expect(
        securityService.addPasswordToHistory(userId, passwordHash)
      ).resolves.toBeUndefined();
    });
  });

  describe('integration scenarios', () => {
    const userId = 'test-user-123';

    it('should prevent reuse of any of the last 12 passwords', async () => {
      // Create 12 different passwords
      const passwords = Array.from({ length: 12 }, (_, i) => `Password${i}!`);
      const hashes = await Promise.all(passwords.map(p => bcrypt.hash(p, 10)));

      const mockHistory = hashes.map((hash, i) => ({
        id: `${i + 1}`,
        userId,
        passwordHash: hash,
        createdAt: new Date(Date.now() - i * 86400000),
      })) as PasswordHistory[];

      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      // Try to reuse the 5th password
      const result = await securityService.checkPasswordHistory(userId, passwords[4]);

      expect(result).toBe(false);
    });

    it('should allow password reuse after it falls out of history', async () => {
      const oldPassword = 'VeryOldPassword123!';
      const oldHash = await bcrypt.hash(oldPassword, 10);

      // Create 12 different recent passwords (old password is the 13th, outside history)
      const recentPasswords = Array.from({ length: 12 }, (_, i) => `RecentPassword${i}!`);
      const recentHashes = await Promise.all(recentPasswords.map(p => bcrypt.hash(p, 10)));

      const mockHistory = recentHashes.map((hash, i) => ({
        id: `${i + 1}`,
        userId,
        passwordHash: hash,
        createdAt: new Date(Date.now() - i * 86400000),
      })) as PasswordHistory[];

      // The old password is not in the returned history
      mockPasswordHistoryRepository.find.mockResolvedValue(mockHistory);

      // Try to use the old password (13th password, outside of last 12)
      const result = await securityService.checkPasswordHistory(userId, oldPassword);

      expect(result).toBe(true);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
