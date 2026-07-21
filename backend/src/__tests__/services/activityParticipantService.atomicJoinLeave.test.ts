import { Activity, ParticipantRole } from '../../models/Activity';
import { ActivityFullError, ForbiddenError, ValidationError } from '../../utils/apiErrors';
import { createMockDataSource, createMockRepository } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
const mockActivityRepository = createMockRepository();
const mockParticipantRepository = createMockRepository();

const mockEmitParticipantJoined = jest.fn();
const mockEmitParticipantLeft = jest.fn();
const mockAuditLog = jest.fn();

jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));

jest.mock('../../websocket/controllers/activityWebSocketController', () => ({
  emitParticipantJoined: (...args: unknown[]) => mockEmitParticipantJoined(...args),
  emitParticipantLeft: (...args: unknown[]) => mockEmitParticipantLeft(...args),
}));

jest.mock('../../services/activity/ActivityAuditLogger', () => ({
  ActivityAuditAction: {
    PARTICIPANT_JOINED: 'PARTICIPANT_JOINED',
    PARTICIPANT_LEFT: 'PARTICIPANT_LEFT',
  },
  activityAuditLogger: { log: mockAuditLog },
}));

jest.mock('../../services/activity/RouteCalculationService', () => ({
  RouteCalculationService: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { ActivityParticipantService } from '../../services/activity/ActivityParticipantService';

/**
 * F5: concurrency/idempotency coverage for the ACT-01 atomic participant paths.
 *
 * `joinActivity` and `leaveActivity` perform their membership mutation +
 * `currentParticipants` recount inside `withEntityLock` (pessimistic_write) so a
 * capacity check or count update cannot race a concurrent join/leave on the same
 * activity. These tests exercise the locked query-runner path and assert the
 * idempotency invariants (re-join updates instead of duplicating; capacity is
 * enforced against the count read under the lock; leaving when absent is a clean
 * rejection, not a silent miscount).
 */
describe('ActivityParticipantService ACT-01 atomic join/leave (F5)', () => {
  let service: ActivityParticipantService;

  /** Build the activity row returned by the withEntityLock load. */
  const mockLockedActivity = (activity: Record<string, unknown>): void => {
    const lockQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(activity),
    };
    mockActivityRepository.createQueryBuilder.mockReturnValue(lockQb);
  };

  /** Build the participant existing-row lookup (getOne) result. */
  const mockExistingParticipant = (row: Record<string, unknown> | null): void => {
    const participantQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(row),
    };
    mockParticipantRepository.createQueryBuilder.mockReturnValue(participantQb);
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockDataSource.getRepository.mockImplementation((entity: { name?: string }) =>
      entity?.name === 'ActivityParticipantEntity'
        ? mockParticipantRepository
        : mockActivityRepository
    );

    // withEntityLock plumbing (see /memories/repo/b9-act02-atomic-activity-transitions.md).
    (mockActivityRepository as unknown as { metadata: unknown; target: unknown }).metadata = {
      name: 'Activity',
      primaryColumns: [{ propertyName: 'id' }],
    };
    (mockActivityRepository as unknown as { target: unknown }).target = Activity;
    mockDataSource.createQueryRunner.mockReturnValue({
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        getRepository: jest.fn((entity: { name?: string }) =>
          entity?.name === 'ActivityParticipantEntity'
            ? mockParticipantRepository
            : mockActivityRepository
        ),
      },
    });

    service = new ActivityParticipantService();
  });

  describe('joinActivity', () => {
    it('creates a participant and recounts currentParticipants on a fresh join', async () => {
      mockLockedActivity({
        id: 'act-1',
        organizationId: 'org-1',
        creatorId: 'creator-1',
        title: 'Op',
        activityType: 'mission',
        maxParticipants: 10,
        currentParticipants: 3,
      });
      mockExistingParticipant(null);
      // capacity check → 3, then post-insert recount → 4
      mockParticipantRepository.count.mockResolvedValueOnce(3).mockResolvedValueOnce(4);
      mockActivityRepository.save.mockImplementation(async (a: Record<string, unknown>) => a);

      const result = await service.joinActivity('act-1', {
        userId: 'user-1',
        userName: 'User One',
        role: ParticipantRole.MEMBER,
      });

      expect(result.wasUpdate).toBe(false);
      expect(result.activity.currentParticipants).toBe(4);
      expect(mockParticipantRepository.save).toHaveBeenCalledTimes(1);
      expect(mockEmitParticipantJoined).toHaveBeenCalledTimes(1);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PARTICIPANT_JOINED' })
      );
    });

    it('updates the existing row (idempotent re-join) without creating a duplicate or recounting', async () => {
      mockLockedActivity({
        id: 'act-1',
        organizationId: 'org-1',
        creatorId: 'creator-1',
        title: 'Op',
        activityType: 'mission',
        maxParticipants: 10,
        currentParticipants: 5,
      });
      mockExistingParticipant({
        activityId: 'act-1',
        userId: 'user-1',
        role: ParticipantRole.MEMBER,
        shipId: 'ship-old',
      });
      mockActivityRepository.save.mockImplementation(async (a: Record<string, unknown>) => a);

      const result = await service.joinActivity('act-1', {
        userId: 'user-1',
        userName: 'User One',
        shipId: 'ship-new',
      });

      expect(result.wasUpdate).toBe(true);
      // Idempotent: update path, never create/insert, never recount, never re-emit join.
      expect(mockParticipantRepository.update).toHaveBeenCalledTimes(1);
      expect(mockParticipantRepository.save).not.toHaveBeenCalled();
      expect(mockParticipantRepository.count).not.toHaveBeenCalled();
      expect(mockEmitParticipantJoined).not.toHaveBeenCalled();
    });

    it('rejects with ActivityFullError when the locked accepted count is at capacity', async () => {
      mockLockedActivity({
        id: 'act-1',
        organizationId: 'org-1',
        creatorId: 'creator-1',
        title: 'Op',
        activityType: 'mission',
        maxParticipants: 2,
        currentParticipants: 2,
      });
      mockExistingParticipant(null);
      // Capacity check under the lock observes a full activity.
      mockParticipantRepository.count.mockResolvedValueOnce(2);

      await expect(
        service.joinActivity('act-1', { userId: 'user-9', userName: 'Late' })
      ).rejects.toBeInstanceOf(ActivityFullError);

      expect(mockParticipantRepository.save).not.toHaveBeenCalled();
      expect(mockEmitParticipantJoined).not.toHaveBeenCalled();
    });
  });

  describe('leaveActivity', () => {
    it('deletes the participant and recounts currentParticipants under the lock', async () => {
      mockLockedActivity({
        id: 'act-1',
        organizationId: 'org-1',
        creatorId: 'creator-1',
        title: 'Op',
        activityType: 'mission',
        currentParticipants: 4,
      });
      mockExistingParticipant({ activityId: 'act-1', userId: 'user-1', userName: 'User One' });
      mockParticipantRepository.count.mockResolvedValueOnce(3); // recount after delete
      mockActivityRepository.save.mockImplementation(async (a: Record<string, unknown>) => a);

      const result = await service.leaveActivity('act-1', 'user-1');

      expect(mockParticipantRepository.delete).toHaveBeenCalledWith({
        activityId: 'act-1',
        userId: 'user-1',
      });
      expect(result.currentParticipants).toBe(3);
      expect(mockEmitParticipantLeft).toHaveBeenCalledTimes(1);
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PARTICIPANT_LEFT' })
      );
    });

    it('rejects a non-participant leave without deleting or recounting (idempotent)', async () => {
      mockLockedActivity({
        id: 'act-1',
        organizationId: 'org-1',
        creatorId: 'creator-1',
        currentParticipants: 4,
      });
      mockExistingParticipant(null);

      await expect(service.leaveActivity('act-1', 'ghost')).rejects.toBeInstanceOf(ValidationError);

      expect(mockParticipantRepository.delete).not.toHaveBeenCalled();
      expect(mockParticipantRepository.count).not.toHaveBeenCalled();
      expect(mockEmitParticipantLeft).not.toHaveBeenCalled();
    });

    it('forbids the creator from leaving their own activity', async () => {
      mockLockedActivity({
        id: 'act-1',
        organizationId: 'org-1',
        creatorId: 'user-1',
        currentParticipants: 4,
      });
      mockExistingParticipant({ activityId: 'act-1', userId: 'user-1' });

      await expect(service.leaveActivity('act-1', 'user-1')).rejects.toBeInstanceOf(ForbiddenError);

      expect(mockParticipantRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('canManageActivity', () => {
    it('requires accepted status for management permissions', async () => {
      mockExistingParticipant({
        activityId: 'act-1',
        userId: 'user-1',
        role: ParticipantRole.LEADER,
        status: 'invited',
      });

      await expect(service.canManageActivity('act-1', 'user-1')).resolves.toBe(false);
    });

    it('allows accepted leaders to manage activity orchestration', async () => {
      mockExistingParticipant({
        activityId: 'act-1',
        userId: 'user-1',
        role: ParticipantRole.LEADER,
        status: 'accepted',
      });

      await expect(service.canManageActivity('act-1', 'user-1')).resolves.toBe(true);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
