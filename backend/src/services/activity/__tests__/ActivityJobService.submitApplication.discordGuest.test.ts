import { mockAppDataSource } from '../../../__tests__/helpers/database-mock';

jest.mock('../../../data-source', () => ({ AppDataSource: mockAppDataSource }));
jest.mock('../../../config/database', () => ({ AppDataSource: mockAppDataSource }));

import { ActivityType } from '../../../models/Activity';
import { ConflictError } from '../../../utils/apiErrors';

import { ActivityJobService } from '../ActivityJobService';

const SYSTEM_BOT_USER_ID = '00000000-0000-0000-0000-000000000000';

describe('ActivityJobService.submitApplication - discord guest identity', () => {
  const repository = {
    metadata: { name: 'Activity' },
    findOne: jest.fn(),
    save: jest.fn(),
  };

  let service: ActivityJobService;

  beforeEach(() => {
    jest.clearAllMocks();
    (mockAppDataSource.getRepository as jest.Mock).mockReturnValue(repository);
    service = new ActivityJobService();
  });

  it('allows different guest Discord users sharing the system applicantId', async () => {
    repository.findOne.mockResolvedValue({
      id: 'activity-1',
      activityType: ActivityType.RECRUITMENT,
      applications: [
        {
          applicationId: 'app-1',
          applicantId: SYSTEM_BOT_USER_ID,
          applicantName: 'GuestOne',
          discordId: 'discord-1',
        },
      ],
      currentApplicants: 1,
      maxApplicants: 10,
    });

    repository.save.mockImplementation(async entity => entity);

    const created = await service.submitApplication('activity-1', {
      applicantId: SYSTEM_BOT_USER_ID,
      applicantName: 'GuestTwo',
      discordId: 'discord-2',
      message: 'Second guest applicant',
    });

    expect(created.discordId).toBe('discord-2');
    expect(repository.save).toHaveBeenCalledTimes(1);
    const savedActivity = repository.save.mock.calls[0][0] as {
      applications: Array<{ discordId?: string }>;
      currentApplicants: number;
    };
    expect(savedActivity.currentApplicants).toBe(2);
    expect(savedActivity.applications).toHaveLength(2);
    expect(savedActivity.applications.map(app => app.discordId)).toEqual([
      'discord-1',
      'discord-2',
    ]);
  });

  it('rejects duplicate applications for the same Discord user', async () => {
    repository.findOne.mockResolvedValue({
      id: 'activity-1',
      activityType: ActivityType.RECRUITMENT,
      applications: [
        {
          applicationId: 'app-1',
          applicantId: SYSTEM_BOT_USER_ID,
          applicantName: 'GuestOne',
          discordId: 'discord-1',
        },
      ],
      currentApplicants: 1,
      maxApplicants: 10,
    });

    await expect(
      service.submitApplication('activity-1', {
        applicantId: SYSTEM_BOT_USER_ID,
        applicantName: 'GuestOneAgain',
        discordId: 'discord-1',
      })
    ).rejects.toBeInstanceOf(ConflictError);

    expect(repository.save).not.toHaveBeenCalled();
  });
});
