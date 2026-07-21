import { SystemRole } from '@sc-fleet-manager/shared-types';

import { AppDataSource } from '../../data-source';
import type { ActivityParticipantEntity } from '../../models/ActivityParticipant';
import { ActivityService } from '../activity/ActivityService';
import type { ParticipationQuery } from '../aggregators/UnifiedParticipantService';
import { UnifiedParticipantService } from '../aggregators/UnifiedParticipantService';
import { JobApplicationService } from '../organization/JobApplicationService';
import type { LFGSession } from '../social/LFGSessionService';
import { LFGSessionService, LFGSessionStatus } from '../social/LFGSessionService';
import { TeamService } from '../team/TeamService';

// ── Mocks ───────────────────────────────────────────────────────────────

jest.mock('../team/TeamService');
jest.mock('../activity/ActivityService');
jest.mock('../organization/JobApplicationService');
jest.mock('../social/LFGSessionService');

jest.mock('../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => ({
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    })),
    transaction: jest.fn(cb => cb({})),
  },
}));

// ── Helpers ─────────────────────────────────────────────────────────────

const USER_ID = 'user-001';
const ORG_ID = 'org-001';

function makeTeamMember(overrides?: Record<string, unknown>) {
  return {
    id: 'tm-1',
    userId: USER_ID,
    teamId: 'team-1',
    organizationId: ORG_ID,
    role: 'member',
    status: 'active',
    joinedAt: new Date('2025-01-01'),
    user: { id: USER_ID, username: 'TestUser' },
    team: { id: 'team-1', name: 'Alpha' },
    ...overrides,
  };
}

function makeActivityParticipant(
  overrides?: Partial<ActivityParticipantEntity>
): ActivityParticipantEntity {
  return {
    id: 'ap-1',
    activityId: 'act-1',
    userId: USER_ID,
    userName: 'TestUser',
    organizationId: ORG_ID,
    role: 'member',
    status: 'accepted',
    joinedAt: new Date('2025-01-10'),
    activity: {
      organizationId: ORG_ID,
      title: 'Mining Op',
      activityType: 'mission',
    },
    ...overrides,
  } as ActivityParticipantEntity;
}

function makeLfgSession(overrides?: Partial<LFGSession>): LFGSession {
  return {
    id: 'lfg-1',
    hostUserId: USER_ID,
    organizationId: ORG_ID,
    activityType: 'MISSION',
    title: 'LFG Mining',
    maxPlayers: 4,
    currentPlayers: [USER_ID],
    status: LFGSessionStatus.OPEN,
    createdAt: new Date('2025-01-15'),
    expiresAt: new Date('2025-01-15T04:00:00Z'),
    updatedAt: new Date('2025-01-15'),
    tags: ['mining'],
    ...overrides,
  };
}

function makeJobApplication(overrides?: Record<string, unknown>) {
  return {
    id: 'app-1',
    userId: USER_ID,
    applicantName: 'TestUser',
    jobListingId: 'job-1',
    status: 'PENDING',
    createdAt: new Date('2025-01-20'),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────

describe('UnifiedParticipantService', () => {
  let service: UnifiedParticipantService;
  let mockTeamService: jest.Mocked<TeamService>;
  let mockActivityService: jest.Mocked<ActivityService>;
  let mockJobApplicationService: jest.Mocked<JobApplicationService>;
  let mockLfgSessionService: jest.Mocked<LFGSessionService>;
  let mockActivityParticipantRepo: {
    createQueryBuilder: jest.Mock;
  };
  let mockActivityParticipantQueryBuilder: {
    innerJoinAndSelect: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    getMany: jest.Mock;
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockActivityParticipantQueryBuilder = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockActivityParticipantRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(mockActivityParticipantQueryBuilder),
    };

    (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
      if (entity?.name === 'ActivityParticipantEntity') {
        return mockActivityParticipantRepo;
      }
      return {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      };
    });

    service = new UnifiedParticipantService();

    mockTeamService = (service as any).teamService;
    mockActivityService = (service as any).activityService;
    mockJobApplicationService = (service as any).jobApplicationService;
    mockLfgSessionService = (service as any).lfgSessionService;

    // Default to returning empty arrays
    mockTeamService.findByUser = jest.fn().mockResolvedValue([]);
    mockActivityService.getActivitiesForUser = jest.fn().mockResolvedValue([]);
    mockJobApplicationService.getApplicationsByUser = jest.fn().mockResolvedValue([]);
    mockLfgSessionService.getUserSessions = jest.fn().mockResolvedValue([]);
    mockLfgSessionService.getHostedSessions = jest.fn().mockResolvedValue([]);
  });

  // ── Cross-System Aggregation ──────────────────────────────────────

  describe('getUserParticipationSummary', () => {
    it('should return empty summary when user has no participations', async () => {
      const query: ParticipationQuery = { userId: USER_ID, organizationId: ORG_ID };

      const result = await service.getUserParticipationSummary(query);

      expect(result.userId).toBe(USER_ID);
      expect(result.totalParticipations).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.pendingCount).toBe(0);
      expect(result.allRoles).toEqual([]);
      expect(result.systems).toHaveLength(4);
    });

    it('should aggregate participations from all four systems', async () => {
      const teamMember = makeTeamMember();
      const activityParticipant = makeActivityParticipant();
      const lfgSession = makeLfgSession();
      const jobApp = makeJobApplication();

      mockTeamService.findByUser = jest.fn().mockResolvedValue([teamMember]);
      (TeamService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: 'TestUser',
        roles: [SystemRole.ORG_MEMBER],
        status: 'active',
        joinedAt: teamMember.joinedAt,
        source: 'manual',
        metadata: { teamId: 'team-1' },
      });

      mockActivityParticipantQueryBuilder.getMany = jest
        .fn()
        .mockResolvedValue([activityParticipant]);

      mockLfgSessionService.getUserSessions = jest.fn().mockResolvedValue([lfgSession]);
      mockLfgSessionService.getHostedSessions = jest.fn().mockResolvedValue([]);
      (LFGSessionService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: USER_ID,
        roles: [SystemRole.LFG_INITIATOR],
        status: 'active',
        joinedAt: lfgSession.createdAt,
        source: 'manual',
        metadata: { sessionId: 'lfg-1' },
      });

      mockJobApplicationService.getApplicationsByUser = jest.fn().mockResolvedValue([jobApp]);
      (JobApplicationService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: 'TestUser',
        roles: [SystemRole.JOB_APPLICANT],
        status: 'pending',
        joinedAt: jobApp.createdAt,
        source: 'manual',
        metadata: { jobListingId: 'job-1' },
      });

      const query: ParticipationQuery = {
        userId: USER_ID,
        organizationId: ORG_ID,
        organizationIds: [ORG_ID],
      };

      const result = await service.getUserParticipationSummary(query);

      expect(result.totalParticipations).toBe(4);
      expect(result.systems).toHaveLength(4);
      expect(result.activeCount).toBe(3); // team + activity (accepted→active) + lfg are 'active'
      expect(result.allRoles).toContain(SystemRole.ORG_MEMBER);
      expect(result.allRoles).toContain(SystemRole.LFG_INITIATOR);
      expect(result.allRoles).toContain(SystemRole.JOB_APPLICANT);
    });

    it('should handle individual system failures gracefully', async () => {
      mockTeamService.findByUser = jest.fn().mockRejectedValue(new Error('DB connection lost'));
      mockActivityService.getActivitiesForUser = jest.fn().mockResolvedValue([]);

      const query: ParticipationQuery = { userId: USER_ID, organizationId: ORG_ID };
      const result = await service.getUserParticipationSummary(query);

      // Should not throw; team system returns error, rest return empty
      expect(result.systems).toHaveLength(4);
      const teamResult = result.systems.find(s => s.system === 'team');
      expect(teamResult?.error).toBe('DB connection lost');
      expect(teamResult?.participants).toEqual([]);
      expect(result.totalParticipations).toBe(0);
    });

    it('should filter to requested systems only', async () => {
      const lfgSession = makeLfgSession();
      mockLfgSessionService.getUserSessions = jest.fn().mockResolvedValue([lfgSession]);
      mockLfgSessionService.getHostedSessions = jest.fn().mockResolvedValue([]);
      (LFGSessionService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: USER_ID,
        roles: [SystemRole.LFG_INITIATOR],
        status: 'active',
        joinedAt: lfgSession.createdAt,
        source: 'manual',
        metadata: { sessionId: 'lfg-1' },
      });

      const query: ParticipationQuery = {
        userId: USER_ID,
        systems: ['lfg'],
      };

      const result = await service.getUserParticipationSummary(query);

      expect(result.systems).toHaveLength(1);
      expect(result.systems[0].system).toBe('lfg');
      expect(result.totalParticipations).toBe(1);

      // Other services should not have been called
      expect(mockTeamService.findByUser).not.toHaveBeenCalled();
      expect(mockActivityService.getActivitiesForUser).not.toHaveBeenCalled();
      expect(mockJobApplicationService.getApplicationsByUser).not.toHaveBeenCalled();
    });
  });

  // ── Team System ───────────────────────────────────────────────────

  describe('team participation', () => {
    it('should return empty when no organizationId provided', async () => {
      const query: ParticipationQuery = { userId: USER_ID, systems: ['team'] };
      const result = await service.getUserParticipationSummary(query);

      const teamResult = result.systems.find(s => s.system === 'team');
      expect(teamResult?.participants).toEqual([]);
      expect(mockTeamService.findByUser).not.toHaveBeenCalled();
    });

    it('should delegate to TeamService.toParticipantInfo for mapping', async () => {
      const member = makeTeamMember();
      mockTeamService.findByUser = jest.fn().mockResolvedValue([member]);
      (TeamService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: 'TestUser',
        roles: [SystemRole.ORG_MEMBER],
        status: 'active',
        joinedAt: member.joinedAt,
        source: 'manual',
        metadata: { teamId: 'team-1' },
      });

      const query: ParticipationQuery = {
        userId: USER_ID,
        organizationId: ORG_ID,
        systems: ['team'],
      };
      const result = await service.getUserParticipationSummary(query);

      expect(mockTeamService.findByUser).toHaveBeenCalledWith(ORG_ID, USER_ID);
      expect(TeamService.toParticipantInfo).toHaveBeenCalledWith(member);
      expect(result.systems[0].participants).toHaveLength(1);
    });
  });

  // ── Activity System ───────────────────────────────────────────────

  describe('activity participation', () => {
    it('should filter activities to only those where user is participant', async () => {
      mockActivityParticipantQueryBuilder.getMany = jest
        .fn()
        .mockResolvedValue([makeActivityParticipant()]);

      const query: ParticipationQuery = {
        userId: USER_ID,
        organizationIds: [ORG_ID],
        systems: ['activity'],
      };
      const result = await service.getUserParticipationSummary(query);

      const actResult = result.systems.find(s => s.system === 'activity');
      expect(actResult?.participants).toHaveLength(1);
    });

    it('should map activity participants using shared-types mapping functions', async () => {
      mockActivityParticipantQueryBuilder.getMany = jest
        .fn()
        .mockResolvedValue([makeActivityParticipant()]);

      const query: ParticipationQuery = {
        userId: USER_ID,
        organizationIds: [ORG_ID],
        systems: ['activity'],
      };
      const result = await service.getUserParticipationSummary(query);

      const participant = result.systems[0].participants[0];
      expect(participant.userId).toBe(USER_ID);
      expect(participant.username).toBe('TestUser');
      expect(participant.roles).toBeDefined();
      expect(participant.metadata).toHaveProperty('activityId', 'act-1');
      expect(participant.metadata).toHaveProperty('activityTitle', 'Mining Op');
    });

    it('should use organizationId as fallback for orgIds', async () => {
      mockActivityParticipantQueryBuilder.getMany = jest.fn().mockResolvedValue([]);

      const query: ParticipationQuery = {
        userId: USER_ID,
        organizationId: ORG_ID,
        systems: ['activity'],
      };
      await service.getUserParticipationSummary(query);

      expect(mockActivityParticipantQueryBuilder.andWhere).toHaveBeenCalledWith(
        'activity."organizationId" IN (:...orgIds)',
        { orgIds: [ORG_ID] }
      );
    });

    it('should handle empty normalized participant rows', async () => {
      mockActivityParticipantQueryBuilder.getMany = jest.fn().mockResolvedValue([]);

      const query: ParticipationQuery = {
        userId: USER_ID,
        systems: ['activity'],
      };
      const result = await service.getUserParticipationSummary(query);

      const actResult = result.systems.find(s => s.system === 'activity');
      expect(actResult?.participants).toHaveLength(0);
    });
  });

  // ── Job System ────────────────────────────────────────────────────

  describe('job participation', () => {
    it('should delegate to JobApplicationService.toParticipantInfo', async () => {
      const app = makeJobApplication();
      mockJobApplicationService.getApplicationsByUser = jest.fn().mockResolvedValue([app]);
      (JobApplicationService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: 'TestUser',
        roles: [SystemRole.JOB_APPLICANT],
        status: 'pending',
        joinedAt: app.createdAt,
        source: 'manual',
        metadata: { jobListingId: 'job-1', applicationId: 'app-1' },
      });

      const query: ParticipationQuery = { userId: USER_ID, systems: ['job'] };
      const result = await service.getUserParticipationSummary(query);

      expect(mockJobApplicationService.getApplicationsByUser).toHaveBeenCalledWith(USER_ID);
      expect(JobApplicationService.toParticipantInfo).toHaveBeenCalledWith(app);
      expect(result.systems[0].participants).toHaveLength(1);
      expect(result.pendingCount).toBe(1);
    });
  });

  // ── LFG System ────────────────────────────────────────────────────

  describe('lfg participation', () => {
    it('should merge user sessions and hosted sessions with deduplication', async () => {
      const session = makeLfgSession();
      // Same session returned by both queries
      mockLfgSessionService.getUserSessions = jest.fn().mockResolvedValue([session]);
      mockLfgSessionService.getHostedSessions = jest.fn().mockResolvedValue([session]);
      (LFGSessionService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: USER_ID,
        roles: [SystemRole.LFG_INITIATOR],
        status: 'active',
        joinedAt: session.createdAt,
        source: 'manual',
        metadata: { sessionId: 'lfg-1' },
      });

      const query: ParticipationQuery = { userId: USER_ID, systems: ['lfg'] };
      const result = await service.getUserParticipationSummary(query);

      const lfgResult = result.systems.find(s => s.system === 'lfg');
      // Deduplicated — should have 1 not 2
      expect(lfgResult?.participants).toHaveLength(1);
    });

    it('should combine unique sessions from user and hosted lists', async () => {
      const session1 = makeLfgSession({ id: 'lfg-1' });
      const session2 = makeLfgSession({ id: 'lfg-2', hostUserId: 'other' });

      mockLfgSessionService.getUserSessions = jest.fn().mockResolvedValue([session1, session2]);
      mockLfgSessionService.getHostedSessions = jest.fn().mockResolvedValue([session1]);
      (LFGSessionService.toParticipantInfo as jest.Mock).mockImplementation(
        (uid: string, sess: LFGSession) => ({
          userId: uid,
          username: uid,
          roles: [uid === sess.hostUserId ? SystemRole.LFG_INITIATOR : SystemRole.LFG_MEMBER],
          status: 'active',
          joinedAt: sess.createdAt,
          source: 'manual',
          metadata: { sessionId: sess.id },
        })
      );

      const query: ParticipationQuery = { userId: USER_ID, systems: ['lfg'] };
      const result = await service.getUserParticipationSummary(query);

      const lfgResult = result.systems.find(s => s.system === 'lfg');
      expect(lfgResult?.participants).toHaveLength(2);
    });
  });

  // ── Summary Counts ────────────────────────────────────────────────

  describe('summary counts', () => {
    it('should count active and pending statuses correctly', async () => {
      const lfgSession = makeLfgSession();
      const jobApp = makeJobApplication();

      mockLfgSessionService.getUserSessions = jest.fn().mockResolvedValue([lfgSession]);
      mockLfgSessionService.getHostedSessions = jest.fn().mockResolvedValue([]);
      (LFGSessionService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: USER_ID,
        roles: [SystemRole.LFG_INITIATOR],
        status: 'active',
        joinedAt: lfgSession.createdAt,
        source: 'manual',
        metadata: {},
      });

      mockJobApplicationService.getApplicationsByUser = jest.fn().mockResolvedValue([jobApp]);
      (JobApplicationService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: 'TestUser',
        roles: [SystemRole.JOB_APPLICANT],
        status: 'pending',
        joinedAt: jobApp.createdAt,
        source: 'manual',
        metadata: {},
      });

      const query: ParticipationQuery = {
        userId: USER_ID,
        systems: ['lfg', 'job'],
      };
      const result = await service.getUserParticipationSummary(query);

      expect(result.activeCount).toBe(1);
      expect(result.pendingCount).toBe(1);
      expect(result.totalParticipations).toBe(2);
    });

    it('should count invited and waitlisted as pending', async () => {
      const app1 = makeJobApplication({ id: 'app-invited' });
      const app2 = makeJobApplication({ id: 'app-waitlisted' });

      mockJobApplicationService.getApplicationsByUser = jest.fn().mockResolvedValue([app1, app2]);
      (JobApplicationService.toParticipantInfo as jest.Mock)
        .mockReturnValueOnce({
          userId: USER_ID,
          username: 'TestUser',
          roles: [SystemRole.JOB_APPLICANT],
          status: 'invited',
          joinedAt: new Date(),
          source: 'manual',
          metadata: {},
        })
        .mockReturnValueOnce({
          userId: USER_ID,
          username: 'TestUser',
          roles: [SystemRole.JOB_APPLICANT],
          status: 'waitlisted',
          joinedAt: new Date(),
          source: 'manual',
          metadata: {},
        });

      const query: ParticipationQuery = { userId: USER_ID, systems: ['job'] };
      const result = await service.getUserParticipationSummary(query);

      expect(result.pendingCount).toBe(2);
      expect(result.activeCount).toBe(0);
    });

    it('should deduplicate roles across systems', async () => {
      const member = makeTeamMember();
      mockTeamService.findByUser = jest.fn().mockResolvedValue([member]);
      (TeamService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: 'TestUser',
        roles: [SystemRole.ORG_MEMBER],
        status: 'active',
        joinedAt: member.joinedAt,
        source: 'manual',
        metadata: {},
      });

      const member2 = makeTeamMember({ id: 'tm-2', teamId: 'team-2' });
      mockTeamService.findByUser = jest.fn().mockResolvedValue([member, member2]);
      (TeamService.toParticipantInfo as jest.Mock).mockReturnValue({
        userId: USER_ID,
        username: 'TestUser',
        roles: [SystemRole.ORG_MEMBER],
        status: 'active',
        joinedAt: member.joinedAt,
        source: 'manual',
        metadata: {},
      });

      const query: ParticipationQuery = {
        userId: USER_ID,
        organizationId: ORG_ID,
        systems: ['team'],
      };
      const result = await service.getUserParticipationSummary(query);

      // ORG_MEMBER appears twice in participants but should be unique in allRoles
      expect(result.allRoles).toEqual([SystemRole.ORG_MEMBER]);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle all systems returning errors', async () => {
      mockTeamService.findByUser = jest.fn().mockRejectedValue(new Error('Team DB down'));
      mockActivityParticipantQueryBuilder.getMany = jest
        .fn()
        .mockRejectedValue(new Error('Activity DB down'));
      mockJobApplicationService.getApplicationsByUser = jest
        .fn()
        .mockRejectedValue(new Error('Job DB down'));
      mockLfgSessionService.getUserSessions = jest.fn().mockRejectedValue(new Error('Redis down'));
      mockLfgSessionService.getHostedSessions = jest.fn().mockResolvedValue([]);

      const query: ParticipationQuery = { userId: USER_ID, organizationId: ORG_ID };
      const result = await service.getUserParticipationSummary(query);

      expect(result.totalParticipations).toBe(0);
      const errors = result.systems.filter(s => s.error);
      expect(errors.length).toBe(4);
    });

    it('should handle no rows returned from normalized activity participants', async () => {
      mockActivityParticipantQueryBuilder.getMany = jest.fn().mockResolvedValue([]);

      const query: ParticipationQuery = {
        userId: USER_ID,
        systems: ['activity'],
      };
      const result = await service.getUserParticipationSummary(query);

      const actResult = result.systems.find(s => s.system === 'activity');
      expect(actResult?.participants).toHaveLength(0);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});

