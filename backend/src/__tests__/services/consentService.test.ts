// Mock database for unit testing
import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

import { User } from '../../models/User';
import { ConsentType, UserConsent } from '../../models/UserConsent';
import { ConsentService } from '../../services/user/ConsentService';
import { TestDatabase } from '../helpers/testHelpers.helper';

const AppDataSource = mockAppDataSource;

// Integration test that requires real database - skip in CI
// Use describe.skip to skip the entire test suite when database is not available
const describeIfDatabase =
  process.env.DATABASE_URL || process.env.DB_HOST ? describe : describe.skip;

describeIfDatabase('ConsentService', () => {
  let consentService: ConsentService;
  let testUser: User;

  beforeAll(async () => {
    if (!AppDataSource.isInitialized) {
      await AppDataSource.initialize();
    }
  });

  beforeEach(async () => {
    // Create test user
    testUser = await TestDatabase.createUser({
      email: 'consent-test@example.com',
      username: 'consent-tester',
      discordId: 'consent-discord-123',
    });

    // Clear any existing consents
    await AppDataSource.getRepository(UserConsent).delete({
      userId: testUser.id,
    });

    consentService = new ConsentService();
  });

  afterEach(async () => {
    // Cleanup
    if (testUser && testUser.id) {
      await AppDataSource.getRepository(UserConsent).delete({
        userId: testUser.id,
      });
      await TestDatabase.deleteUser(testUser.id);
    }
  });

  afterAll(async () => {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  });

  describe('recordConsent', () => {
    it('should record new consent', async () => {
      const result = await consentService.recordConsent(
        testUser.id,
        ConsentType.DATA_PROCESSING,
        true,
        {
          version: '1.0',
          ipAddress: '192.168.1.1',
        }
      );

      expect(result).toBeDefined();
      expect(result.userId).toBe(testUser.id);
      expect(result.consentType).toBe(ConsentType.DATA_PROCESSING);
      expect(result.granted).toBe(true);
      expect(result.version).toBe('1.0');
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should record marketing consent', async () => {
      const result = await consentService.recordConsent(testUser.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      expect(result.consentType).toBe(ConsentType.MARKETING);
      expect(result.granted).toBe(true);
    });

    it('should record consent withdrawal', async () => {
      // First grant consent
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      // Then withdraw
      const result = await consentService.recordConsent(
        testUser.id,
        ConsentType.DATA_PROCESSING,
        false,
        {
          version: '1.0',
          ipAddress: '192.168.1.1',
        }
      );

      expect(result.granted).toBe(false);
    });

    it('should track version changes', async () => {
      // Consent to v1.0
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      // Consent to v2.0 - updates existing record
      const result = await consentService.recordConsent(
        testUser.id,
        ConsentType.DATA_PROCESSING,
        true,
        {
          version: '2.0',
          ipAddress: '192.168.1.1',
        }
      );

      expect(result.version).toBe('2.0');

      // Verify only one record exists (updated, not duplicated)
      const allConsents = await consentService.getUserConsents(testUser.id);
      expect(allConsents).toHaveLength(1);
    });

    it('should capture IP address', async () => {
      const result = await consentService.recordConsent(
        testUser.id,
        ConsentType.DATA_PROCESSING,
        true,
        {
          version: '1.0',
          ipAddress: '203.0.113.42',
        }
      );

      expect(result.ipAddress).toBe('203.0.113.42');
    });
  });

  describe('getUserConsents', () => {
    it('should return empty array for user with no consents', async () => {
      const consents = await consentService.getUserConsents(testUser.id);
      expect(consents).toEqual([]);
    });

    it('should return all user consents', async () => {
      // Record multiple consents
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, false, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.THIRD_PARTY, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      const consents = await consentService.getUserConsents(testUser.id);

      expect(consents).toHaveLength(3);
      expect(consents.map(c => c.consentType)).toContain(ConsentType.DATA_PROCESSING);
      expect(consents.map(c => c.consentType)).toContain(ConsentType.MARKETING);
      expect(consents.map(c => c.consentType)).toContain(ConsentType.THIRD_PARTY);
    });

    it('should order consents by type ascending', async () => {
      // Record consents
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.THIRD_PARTY, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      const consents = await consentService.getUserConsents(testUser.id);

      // Ordered by consentType ASC
      expect(consents[0].consentType).toBe(ConsentType.DATA_PROCESSING);
      expect(consents[1].consentType).toBe(ConsentType.MARKETING);
      expect(consents[2].consentType).toBe(ConsentType.THIRD_PARTY);
    });

    it('should return all consent types', async () => {
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      const consents = await consentService.getUserConsents(testUser.id);

      expect(consents).toHaveLength(2);
      expect(consents.map(c => c.consentType)).toContain(ConsentType.DATA_PROCESSING);
      expect(consents.map(c => c.consentType)).toContain(ConsentType.MARKETING);
    });
  });

  describe('hasConsent', () => {
    it('should return false for non-existent consent', async () => {
      const hasConsent = await consentService.hasConsent(testUser.id, ConsentType.DATA_PROCESSING);
      expect(hasConsent).toBe(false);
    });

    it('should return true for granted consent', async () => {
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      const hasConsent = await consentService.hasConsent(testUser.id, ConsentType.DATA_PROCESSING);
      expect(hasConsent).toBe(true);
    });

    it('should return false for withdrawn consent', async () => {
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, false, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      const hasConsent = await consentService.hasConsent(testUser.id, ConsentType.DATA_PROCESSING);
      expect(hasConsent).toBe(false);
    });

    it('should use latest consent record', async () => {
      // Grant, withdraw, grant again
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, false, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      const hasConsent = await consentService.hasConsent(testUser.id, ConsentType.MARKETING);
      expect(hasConsent).toBe(true);
    });

    it('should check specific consent types independently', async () => {
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, false, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      expect(await consentService.hasConsent(testUser.id, ConsentType.DATA_PROCESSING)).toBe(true);
      expect(await consentService.hasConsent(testUser.id, ConsentType.MARKETING)).toBe(false);
      expect(await consentService.hasConsent(testUser.id, ConsentType.THIRD_PARTY)).toBe(false);
    });
  });

  describe('exportUserData', () => {
    beforeEach(async () => {
      // Create sample consent data
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, false, {
        version: '1.0',
        ipAddress: '192.168.1.2',
      });
    });

    it('should export user consent data in structured format', async () => {
      const exportData = await consentService.exportUserData(testUser.id);

      expect(exportData).toBeDefined();
      expect(exportData.user.id).toBe(testUser.id);
      expect(exportData.consents).toBeInstanceOf(Array);
      expect(exportData.consents.length).toBeGreaterThan(0);
    });

    it('should include all consent details', async () => {
      const exportData = await consentService.exportUserData(testUser.id);

      const dataProcessingConsent = exportData.consents.find(
        c => c.type === ConsentType.DATA_PROCESSING
      );
      expect(dataProcessingConsent).toBeDefined();
      expect(dataProcessingConsent?.granted).toBe(true);
      expect(dataProcessingConsent?.version).toBe('1.0');
      expect(dataProcessingConsent?.grantedAt).toBeDefined();
    });

    it('should return empty consents array for user with no data', async () => {
      const newUser = await TestDatabase.createUser({
        email: 'no-consents@example.com',
        username: 'no-consents',
        discordId: 'no-consents-123',
      });

      const exportData = await consentService.exportUserData(newUser.id);

      expect(exportData.consents).toEqual([]);

      await TestDatabase.deleteUser(newUser.id);
    });
  });

  describe('deleteUserData', () => {
    beforeEach(async () => {
      // Create sample consents
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.THIRD_PARTY, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
    });

    it('should delete all user consents', async () => {
      // Verify consents exist
      const beforeDelete = await consentService.getUserConsents(testUser.id);
      expect(beforeDelete.length).toBeGreaterThan(0);

      // Delete
      await consentService.deleteUserData(testUser.id);

      // Verify deleted
      const afterDelete = await consentService.getUserConsents(testUser.id);
      expect(afterDelete).toEqual([]);
    });

    it('should return count of deleted records', async () => {
      const deletedCount = await consentService.deleteUserData(testUser.id);
      expect(deletedCount).toBe(3); // Three consents created in beforeEach
    });

    it('should not affect other users consents', async () => {
      // Create another user
      const otherUser = await TestDatabase.createUser({
        email: 'other@example.com',
        username: 'other-user',
        discordId: 'other-123',
      });

      await consentService.recordConsent(otherUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      // Delete first user's data
      await consentService.deleteUserData(testUser.id);

      // Verify other user's data remains
      const otherUserConsents = await consentService.getUserConsents(otherUser.id);
      expect(otherUserConsents.length).toBe(1);

      // Cleanup
      await TestDatabase.deleteUser(otherUser.id);
    });

    it('should handle deleting data for user with no consents', async () => {
      const newUser = await TestDatabase.createUser({
        email: 'empty@example.com',
        username: 'empty-user',
        discordId: 'empty-123',
      });

      const deletedCount = await consentService.deleteUserData(newUser.id);
      expect(deletedCount).toBe(0);

      await TestDatabase.deleteUser(newUser.id);
    });
  });

  describe('getConsentStatistics', () => {
    beforeEach(async () => {
      // Clear ALL existing consents first to ensure clean state
      await AppDataSource.getRepository(UserConsent).delete({});

      // Create multiple users with various consents
      const user1 = await TestDatabase.createUser({
        email: 'user1@test.com',
        username: 'user1',
        discordId: 'user1-discord',
      });
      const user2 = await TestDatabase.createUser({
        email: 'user2@test.com',
        username: 'user2',
        discordId: 'user2-discord',
      });
      const user3 = await TestDatabase.createUser({
        email: 'user3@test.com',
        username: 'user3',
        discordId: 'user3-discord',
      });

      // User 1: All consents granted
      await consentService.recordConsent(user1.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(user1.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      // User 2: Mixed consents
      await consentService.recordConsent(user2.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(user2.id, ConsentType.MARKETING, false, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      // User 3: No consents

      // Store for cleanup
      (testUser as any).additionalUsers = [user1, user2, user3];
    });

    afterEach(async () => {
      // Cleanup additional users
      if ((testUser as any).additionalUsers) {
        for (const user of (testUser as any).additionalUsers) {
          await AppDataSource.getRepository(UserConsent).delete({ userId: user.id });
          await TestDatabase.deleteUser(user.id);
        }
      }
    });

    it('should return statistics for all consent types', async () => {
      const stats = await consentService.getConsentStatistics();

      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
    });

    it('should count consents by type', async () => {
      const stats = await consentService.getConsentStatistics();

      const dataProcessing = stats.find(s => s.type === ConsentType.DATA_PROCESSING);
      expect(dataProcessing).toBeDefined();
      expect(dataProcessing.granted).toBe(2); // user1 and user2
      expect(dataProcessing.revoked).toBe(0);

      const marketing = stats.find(s => s.type === ConsentType.MARKETING);
      expect(marketing).toBeDefined();
      expect(marketing.granted).toBe(1); // user1 only
      expect(marketing.revoked).toBe(1); // user2
    });

    it('should calculate totals', async () => {
      const stats = await consentService.getConsentStatistics();

      const dataProcessing = stats.find(s => s.type === ConsentType.DATA_PROCESSING);
      expect(dataProcessing.total).toBeGreaterThan(0);
      expect(dataProcessing.total).toBeLessThanOrEqual(100);
    });
  });

  describe('Integration: Complete Consent Lifecycle', () => {
    it('should handle full consent lifecycle', async () => {
      // Step 1: User grants initial consents
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, true, {
        version: '1.0',
        ipAddress: '192.168.1.1',
      });

      // Verify granted
      expect(await consentService.hasConsent(testUser.id, ConsentType.DATA_PROCESSING)).toBe(true);
      expect(await consentService.hasConsent(testUser.id, ConsentType.MARKETING)).toBe(true);

      // Step 2: User withdraws marketing consent
      await consentService.recordConsent(testUser.id, ConsentType.MARKETING, false, {
        version: '1.0',
        ipAddress: '192.168.1.2',
      });
      expect(await consentService.hasConsent(testUser.id, ConsentType.MARKETING)).toBe(false);
      expect(await consentService.hasConsent(testUser.id, ConsentType.DATA_PROCESSING)).toBe(true); // Unchanged

      // Step 3: New version of terms - updates existing record
      await consentService.recordConsent(testUser.id, ConsentType.DATA_PROCESSING, true, {
        version: '2.0',
        ipAddress: '192.168.1.3',
      });

      // Verify history - updates don't create new records
      const allConsents = await consentService.getUserConsents(testUser.id);
      expect(allConsents.filter(c => c.consentType === ConsentType.DATA_PROCESSING)).toHaveLength(
        1
      ); // Updated to v2.0

      // Step 4: User exports their data
      const exportData = await consentService.exportUserData(testUser.id);
      expect(exportData.consents).toHaveLength(2); // 1 data_processing + 1 marketing

      // Step 5: User requests deletion
      const deletedCount = await consentService.deleteUserData(testUser.id);
      expect(deletedCount).toBe(2);

      // Verify all deleted
      const finalConsents = await consentService.getUserConsents(testUser.id);
      expect(finalConsents).toEqual([]);
    });
  });
});
