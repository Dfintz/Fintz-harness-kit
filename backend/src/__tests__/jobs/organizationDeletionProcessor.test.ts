const mockClaimWorkItem = jest.fn();
const mockWithJobLock = jest.fn();
const mockGetRequestsReadyForExecution = jest.fn();
const mockExecuteDeletion = jest.fn();

jest.mock('../../services/jobs/DistributedJobLockService', () => ({
  claimWorkItem: (...args: unknown[]) => mockClaimWorkItem(...args),
  withJobLock: (...args: unknown[]) => mockWithJobLock(...args),
}));

jest.mock('../../services/organization/OrganizationDeletionService', () => ({
  OrganizationDeletionService: jest.fn().mockImplementation(() => ({
    getRequestsReadyForExecution: mockGetRequestsReadyForExecution,
    executeDeletion: mockExecuteDeletion,
  })),
}));

jest.mock('../../jobs/jobSchedulerHelper', () => ({
  scheduleFixedIntervalJob: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { OrganizationDeletionProcessorJob } from '../../jobs/organizationDeletionProcessor';

interface PrivateJob {
  executeUnlocked(): Promise<void>;
}

const runUnlocked = (job: OrganizationDeletionProcessorJob): Promise<void> =>
  (job as unknown as PrivateJob).executeUnlocked();

/**
 * F5: per-request claim/idempotency coverage for the org-deletion processor
 * (B6 / JOB-05). Inside the job-scope lock, each ready request is wrapped in
 * `claimWorkItem('organization-deletion-request:<id>')` so that across replicas
 * exactly one worker executes a given deletion. These tests assert the claim
 * outcomes are accounted for correctly: a lost claim (`claimed: false`) is a
 * benign skip (not a success, not a failure), a claimed execution error is a
 * counted failure, and one request's failure does not abort the rest of the batch.
 */
describe('OrganizationDeletionProcessorJob executeUnlocked (F5 B6/JOB-05)', () => {
  let job: OrganizationDeletionProcessorJob;

  const makeRequest = (id: string) => ({ id, organizationId: `org-${id}` });

  beforeEach(() => {
    jest.clearAllMocks();
    mockExecuteDeletion.mockResolvedValue(undefined);
    job = new OrganizationDeletionProcessorJob();
  });

  it('executes each ready deletion exactly once via a per-request claim', async () => {
    mockGetRequestsReadyForExecution.mockResolvedValue([makeRequest('1'), makeRequest('2')]);
    // Both claims won and executed successfully.
    mockClaimWorkItem.mockImplementation(async (_key: string, fn: () => Promise<void>) => {
      await fn();
      return { claimed: true, result: undefined };
    });

    await runUnlocked(job);

    expect(mockClaimWorkItem).toHaveBeenCalledTimes(2);
    expect(mockClaimWorkItem).toHaveBeenCalledWith(
      'organization-deletion-request:1',
      expect.any(Function),
      expect.objectContaining({ ttlSeconds: 20 * 60 })
    );
    expect(mockExecuteDeletion).toHaveBeenCalledTimes(2);
  });

  it('treats a lost claim (claimed: false) as a benign skip, not a failure', async () => {
    mockGetRequestsReadyForExecution.mockResolvedValue([makeRequest('1')]);
    // Another worker already owns the claim.
    mockClaimWorkItem.mockResolvedValue({ claimed: false, skippedReason: 'lock-held' });

    await expect(runUnlocked(job)).resolves.toBeUndefined();

    // The work fn never runs locally and the run completes cleanly (no throw).
    expect(mockExecuteDeletion).not.toHaveBeenCalled();
  });

  it('counts a claimed execution error as a failure but still finishes the batch', async () => {
    mockGetRequestsReadyForExecution.mockResolvedValue([
      makeRequest('1'),
      makeRequest('2'),
      makeRequest('3'),
    ]);
    // Request 2 claimed but its execution failed; 1 and 3 succeed.
    mockClaimWorkItem.mockImplementation(async (key: string, fn: () => Promise<void>) => {
      if (key === 'organization-deletion-request:2') {
        return { claimed: true, error: 'archive failed' };
      }
      await fn();
      return { claimed: true, result: undefined };
    });

    // The batch must complete without throwing despite the mid-batch failure.
    await expect(runUnlocked(job)).resolves.toBeUndefined();

    // 1 and 3 executed; the whole batch was attempted (failure didn't abort it).
    expect(mockClaimWorkItem).toHaveBeenCalledTimes(3);
    expect(mockExecuteDeletion).toHaveBeenCalledTimes(2);
  });

  it('does nothing when there are no requests ready for execution', async () => {
    mockGetRequestsReadyForExecution.mockResolvedValue([]);

    await runUnlocked(job);

    expect(mockClaimWorkItem).not.toHaveBeenCalled();
    expect(mockExecuteDeletion).not.toHaveBeenCalled();
  });
});
