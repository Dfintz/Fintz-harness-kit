import { mockAppDataSource } from '../../../__tests__/helpers/database-mock';

jest.mock('../../../data-source', () => ({ AppDataSource: mockAppDataSource }));
jest.mock('../../../config/database', () => ({ AppDataSource: mockAppDataSource }));
// Auto-mock the org member service so the ActivityJobService field construction is inert;
// the instance's addMember is overridden per test.
jest.mock('../../organization/OrganizationMemberService');
jest.mock('../ActivityAuditLogger', () => ({
  ActivityAuditAction: { APPLICATION_ACCEPTED: 'APPLICATION_ACCEPTED' },
  activityAuditLogger: { log: jest.fn() },
}));

import { ActivityType, ApplicationStatus } from '../../../models/Activity';
import { ActivityParticipantEntity } from '../../../models/ActivityParticipant';
import { ActivityJobService } from '../ActivityJobService';

function makeActivity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'act-1',
    title: 'Pilots Wanted',
    activityType: ActivityType.RECRUITMENT,
    organizationId: 'org-1',
    currentParticipants: 0,
    applications: [
      {
        applicationId: 'app-1',
        applicantId: 'user-1',
        applicantName: 'Alice',
        status: ApplicationStatus.PENDING,
      },
    ],
    ...overrides,
  };
}

describe('ActivityJobService.acceptApplication — recruitment onboarding', () => {
  let service: ActivityJobService;
  let addMember: jest.Mock;

  /** Stub withEntityLock to run its callback against a mock activity + queryRunner. */
  function wireLock(activity: Record<string, unknown>): void {
    const participantRepo = {
      create: jest.fn((x: unknown) => x),
      save: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(1),
    };
    const activityRepo = { save: jest.fn().mockResolvedValue(activity) };
    jest
      .spyOn(
        service as unknown as { withEntityLock: (...a: unknown[]) => unknown },
        'withEntityLock'
      )
      .mockImplementation((...args: unknown[]) => {
        const cb = args[1] as (a: unknown, q: unknown) => unknown;
        const queryRunner = {
          manager: {
            getRepository: (entity: unknown) =>
              entity === ActivityParticipantEntity ? participantRepo : activityRepo,
          },
        };
        return cb(activity, queryRunner);
      });
  }

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActivityJobService();
    addMember = jest.fn().mockResolvedValue({ id: 'membership-1' });
    (service as unknown as { memberService: { addMember: jest.Mock } }).memberService = {
      addMember,
    };
    (service as unknown as { getUserNameFromActivity: jest.Mock }).getUserNameFromActivity = jest
      .fn()
      .mockResolvedValue('Reviewer');
  });

  it('adds the accepted recruit as an org member with the recruitment source', async () => {
    wireLock(makeActivity());

    await service.acceptApplication('act-1', 'app-1', 'admin-1');

    expect(addMember).toHaveBeenCalledWith(
      'org-1',
      'user-1',
      'member',
      undefined,
      undefined,
      undefined,
      {
        acquisitionSource: 'recruitment',
        acquisitionRefId: 'app-1',
      }
    );
  });

  it('does not add a member for a non-recruitment (job listing) acceptance', async () => {
    wireLock(makeActivity({ activityType: ActivityType.JOB_LISTING }));

    await service.acceptApplication('act-1', 'app-1', 'admin-1');

    expect(addMember).not.toHaveBeenCalled();
  });

  it('does not add a member for a personal recruitment post without an organization', async () => {
    wireLock(makeActivity({ organizationId: null }));

    await service.acceptApplication('act-1', 'app-1', 'admin-1');

    expect(addMember).not.toHaveBeenCalled();
  });

  it('still resolves the acceptance when addMember fails (non-fatal)', async () => {
    wireLock(makeActivity());
    addMember.mockRejectedValue(new Error('User is already a member'));

    const result = await service.acceptApplication('act-1', 'app-1', 'admin-1');

    expect(result.status).toBe(ApplicationStatus.ACCEPTED);
    expect(addMember).toHaveBeenCalled();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
