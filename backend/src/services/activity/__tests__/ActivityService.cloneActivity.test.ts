// Focused unit tests for ActivityService.cloneActivity (INT-07 clone-event).
//
// cloneActivity is the backend primitive the Discord "Clone" button wires into.
// These tests pin two behaviours that matter for the bot use case:
//   1. The clone resets per-instance Discord/voice linkage (discordEventId,
//      voiceChannelId, voiceChannelName) so it never hijacks the source's posted
//      Discord scheduled event or voice channel.
//   2. The clone is a fresh DRAFT with empty sign-ups and the caller's date overrides.
//
// The handler is exercised without the constructor (which needs a data source):
// we instantiate via Object.create and inject a mock repository — cloneActivity
// only touches `this.repository`.

jest.mock('../../../data-source', () => ({ AppDataSource: { getRepository: jest.fn() } }));
jest.mock('../../../config/database', () => ({ AppDataSource: { getRepository: jest.fn() } }));

import { ActivityStatus } from '../../../models/Activity';
import { ActivityService } from '../ActivityService';

interface MockRepo {
  findOne: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
}

function makeService(repo: MockRepo): ActivityService {
  const service = Object.create(ActivityService.prototype) as ActivityService;
  (service as unknown as { repository: MockRepo }).repository = repo;
  return service;
}

describe('ActivityService.cloneActivity', () => {
  const original = {
    id: 'src-activity-1',
    title: 'Weekly Mining Op',
    organizationId: 'org-1',
    creatorId: 'user-1',
    status: ActivityStatus.COMPLETED,
    activityType: 'event',
    discordEventId: 'discord-scheduled-event-99',
    voiceChannelId: 'vc-123',
    voiceChannelName: 'Op Voice',
    scheduledStartDate: new Date('2026-06-01T18:00:00.000Z'),
    scheduledEndDate: new Date('2026-06-01T20:00:00.000Z'),
    participants: [{ userId: 'user-2', status: 'accepted' }],
    currentParticipants: 1,
    metadata: { foo: 'bar' },
  };

  let repo: MockRepo;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue({ ...original }),
      // TypeORM's repository.create echoes the merged entity; save persists it.
      create: jest.fn().mockImplementation((entity: unknown) => entity),
      save: jest.fn().mockImplementation(async (entity: unknown) => entity),
    };
  });

  it('clears per-instance Discord/voice linkage so the clone cannot hijack the source', async () => {
    const service = makeService(repo);

    const clone = (await service.cloneActivity('src-activity-1')) as unknown as Record<
      string,
      unknown
    >;

    expect(clone.discordEventId).toBeUndefined();
    expect(clone.voiceChannelId).toBeUndefined();
    expect(clone.voiceChannelName).toBeUndefined();
  });

  it('creates a fresh DRAFT with empty sign-ups and a new id', async () => {
    const service = makeService(repo);

    const clone = (await service.cloneActivity('src-activity-1')) as unknown as Record<
      string,
      unknown
    >;

    expect(clone.status).toBe(ActivityStatus.DRAFT);
    expect(clone.id).toBeUndefined();
    expect(clone.participants).toEqual([]);
    expect(clone.currentParticipants).toBe(0);
    // Copied content survives the clone.
    expect(clone.title).toBe('Weekly Mining Op');
    expect(clone.organizationId).toBe('org-1');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it('applies the caller-supplied schedule overrides', async () => {
    const service = makeService(repo);
    const newStart = new Date('2026-06-08T18:00:00.000Z');
    const newEnd = new Date('2026-06-08T20:00:00.000Z');

    const clone = (await service.cloneActivity('src-activity-1', {
      scheduledStartDate: newStart,
      scheduledEndDate: newEnd,
    })) as unknown as Record<string, unknown>;

    expect(clone.scheduledStartDate).toEqual(newStart);
    expect(clone.scheduledEndDate).toEqual(newEnd);
  });

  it('throws when the source activity does not exist', async () => {
    repo.findOne.mockResolvedValue(null);
    const service = makeService(repo);

    await expect(service.cloneActivity('missing')).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

