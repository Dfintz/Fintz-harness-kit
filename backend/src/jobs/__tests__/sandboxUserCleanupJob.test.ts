import { AppDataSource } from '../../config/database';
import { getGdprDataDeletionService } from '../../services/user/GdprDataDeletionService';
import { runSandboxUserCleanupJob } from '../sandboxUserCleanupJob';

const mockGetRawMany = jest.fn();
const mockDeleteAllUserData = jest.fn();

jest.mock('../../config/database', () => ({
  AppDataSource: {
    getRepository: jest.fn(),
  },
}));

jest.mock('../../services/user/GdprDataDeletionService', () => ({
  getGdprDataDeletionService: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('sandboxUserCleanupJob', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.SANDBOX_USER_RETENTION_DAYS;

    const mockQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getRawMany: mockGetRawMany,
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue({
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    });

    (getGdprDataDeletionService as jest.Mock).mockReturnValue({
      deleteAllUserData: mockDeleteAllUserData,
    });
  });

  it('uses a 30-day retention default when SANDBOX_USER_RETENTION_DAYS is unset', async () => {
    mockGetRawMany.mockResolvedValue([]);

    const result = await runSandboxUserCleanupJob();

    expect(result).toEqual({
      retentionDays: 30,
      eligibleCount: 0,
      deletedCount: 0,
      failedCount: 0,
    });
  });

  it('uses configured retention days from SANDBOX_USER_RETENTION_DAYS', async () => {
    process.env.SANDBOX_USER_RETENTION_DAYS = '45';
    mockGetRawMany.mockResolvedValue([]);

    const result = await runSandboxUserCleanupJob();

    expect(result.retentionDays).toBe(45);
  });

  it('deletes only eligible sandbox users and reports failures', async () => {
    mockGetRawMany.mockResolvedValue([{ id: 'sandbox-user-1' }, { id: 'sandbox-user-2' }]);
    mockDeleteAllUserData
      .mockResolvedValueOnce({ success: true, errors: [] })
      .mockResolvedValueOnce({ success: false, errors: ['foreign key constraint'] });

    const result = await runSandboxUserCleanupJob();

    expect(mockDeleteAllUserData).toHaveBeenCalledWith('sandbox-user-1', true);
    expect(mockDeleteAllUserData).toHaveBeenCalledWith('sandbox-user-2', true);
    expect(result).toEqual({
      retentionDays: 30,
      eligibleCount: 2,
      deletedCount: 1,
      failedCount: 1,
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
