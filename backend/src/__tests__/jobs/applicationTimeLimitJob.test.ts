/**
 * ApplicationTimeLimitJob tests (PERF-03)
 *
 * The job's outer guild-settings scan now iterates in bounded keyset batches via
 * findInBatches instead of an unbounded settingsRepo.find(). These tests verify the
 * batched path still auto-rejects expired pending applications and respects the
 * per-guild time-limit configuration.
 */

const mockSettingsFind = jest.fn();
const mockAppFind = jest.fn();
const mockAppSave = jest.fn();

jest.mock('../../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn((entity: { name?: string }) => {
      const name = entity?.name ?? entity;
      if (name === 'OrgApplication') {
        return { find: mockAppFind, save: mockAppSave };
      }
      return { find: mockSettingsFind };
    }),
  },
}));

jest.mock('node-cron', () => ({ schedule: jest.fn() }));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ApplicationTimeLimitJob } from '../../jobs/applicationTimeLimitJob';
import { OrgApplicationStatus } from '../../models/OrgApplication';

interface PrivateJob {
  processExpiredApplications(): Promise<void>;
}

const runJob = (job: ApplicationTimeLimitJob): Promise<void> =>
  (job as unknown as PrivateJob).processExpiredApplications();

describe('ApplicationTimeLimitJob (PERF-03 batched settings scan)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppFind.mockResolvedValue([]);
    mockAppSave.mockImplementation(async (app: unknown) => app);
  });

  it('auto-rejects expired pending applications for guilds with a time limit', async () => {
    mockSettingsFind.mockResolvedValue([
      {
        id: 's-1',
        organizationId: 'org-1',
        recruitmentSettings: { applicationTimeLimitMinutes: 60 },
      },
    ]);
    mockAppFind.mockResolvedValue([{ id: 'app-1', organizationId: 'org-1' }]);

    await runJob(new ApplicationTimeLimitJob());

    expect(mockAppSave).toHaveBeenCalledTimes(1);
    expect(mockAppSave).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'app-1',
        status: OrgApplicationStatus.REJECTED,
        reviewedBy: 'system:time-limit',
      })
    );
  });

  it('skips guilds with no or non-positive time limit (never queries applications)', async () => {
    mockSettingsFind.mockResolvedValue([
      {
        id: 's-1',
        organizationId: 'org-1',
        recruitmentSettings: { applicationTimeLimitMinutes: 0 },
      },
      { id: 's-2', organizationId: 'org-2', recruitmentSettings: undefined },
    ]);

    await runJob(new ApplicationTimeLimitJob());

    expect(mockAppFind).not.toHaveBeenCalled();
    expect(mockAppSave).not.toHaveBeenCalled();
  });

  it('does nothing when a configured guild has no expired applications', async () => {
    mockSettingsFind.mockResolvedValue([
      {
        id: 's-1',
        organizationId: 'org-1',
        recruitmentSettings: { applicationTimeLimitMinutes: 30 },
      },
    ]);
    mockAppFind.mockResolvedValue([]);

    await runJob(new ApplicationTimeLimitJob());

    expect(mockAppFind).toHaveBeenCalledTimes(1);
    expect(mockAppSave).not.toHaveBeenCalled();
  });
});
