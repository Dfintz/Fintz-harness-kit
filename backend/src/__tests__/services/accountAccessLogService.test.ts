import { AppDataSource } from '../../config/database';
import { AccountAccessLogService } from '../../services/security';

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

describe('AccountAccessLogService', () => {
  let service: AccountAccessLogService;
  let mockRepository: any;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);
    service = new AccountAccessLogService();
  });

  describe('logAccess', () => {
    it('should create and save an access log', async () => {
      const mockLog = {
        id: 'log-1',
        accountId: 'account-1',
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'view',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockLog);
      mockRepository.save.mockResolvedValue(mockLog);

      const result = await service.logAccess(
        'account-1',
        'user-1',
        'org-1',
        'view',
        '127.0.0.1',
        'Mozilla/5.0'
      );

      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockLog);
    });

    it('should handle log creation with metadata', async () => {
      const metadata = { reason: 'testing' };
      const mockLog = {
        id: 'log-1',
        accountId: 'account-1',
        userId: 'user-1',
        organizationId: 'org-1',
        action: 'password_reveal',
        metadata,
        createdAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockLog);
      mockRepository.save.mockResolvedValue(mockLog);

      const result = await service.logAccess(
        'account-1',
        'user-1',
        'org-1',
        'password_reveal',
        undefined,
        undefined,
        metadata
      );

      expect(result?.metadata).toEqual(metadata);
    });

    it('should return null on error', async () => {
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      const result = await service.logAccess('account-1', 'user-1', 'org-1', 'view');

      expect(result).toBeNull();
    });
  });

  describe('getAccountAccessLogs', () => {
    it('should fetch access logs for an account', async () => {
      const mockLogs = [
        { id: 'log-1', action: 'view', createdAt: new Date() },
        { id: 'log-2', action: 'password_reveal', createdAt: new Date() },
      ];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.getAccountAccessLogs('account-1');

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { accountId: 'account-1' },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockLogs);
    });

    it('should support pagination', async () => {
      mockRepository.find.mockResolvedValue([]);

      await service.getAccountAccessLogs('account-1', 10, 20);

      expect(mockRepository.find).toHaveBeenCalledWith({
        where: { accountId: 'account-1' },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 20,
      });
    });
  });

  describe('getAccountAnalytics', () => {
    it('should calculate analytics from logs', async () => {
      const mockLogs = [
        { userId: 'user-1', action: 'view', createdAt: new Date('2024-01-01') },
        { userId: 'user-1', action: 'password_reveal', createdAt: new Date('2024-01-02') },
        { userId: 'user-2', action: 'view', createdAt: new Date('2024-01-03') },
        { userId: 'user-2', action: 'view', createdAt: new Date('2024-01-04') },
      ];

      mockRepository.find.mockResolvedValue(mockLogs);

      const result = await service.getAccountAnalytics('account-1');

      expect(result.totalAccesses).toBe(4);
      expect(result.uniqueUsers).toBe(2);
      expect(result.actionCounts).toEqual({
        view: 3,
        password_reveal: 1,
      });
    });

    it('should handle empty logs', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await service.getAccountAnalytics('account-1');

      expect(result.totalAccesses).toBe(0);
      expect(result.uniqueUsers).toBe(0);
      expect(result.actionCounts).toEqual({});
      expect(result.lastAccessed).toBeUndefined();
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
