import { Activity, ActivityStatus, ActivityType } from '../models/Activity';
import {
  ActivityParticipantEntity,
  ActivityParticipantStatus,
} from '../models/ActivityParticipant';
import { OperationCommandService } from '../services/activity/OperationCommandService';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/apiErrors';
import { redisClient } from '../utils/redis';

// Mock dependencies
jest.mock('../utils/redis', () => ({
  redisClient: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('../websocket/websocketServer', () => ({
  emitToOrganization: jest.fn(),
}));

jest.mock('../services/activity/ActivityAuditLogger', () => ({
  ActivityAuditAction: {
    ACTIVITY_UPDATED: 'ACTIVITY_UPDATED',
  },
  activityAuditLogger: {
    log: jest.fn(),
  },
}));

const mockActivityRepo = {
  findOne: jest.fn(),
  update: jest.fn(),
};

const mockParticipantRepo = {
  find: jest.fn(),
};

const mockQueryBuilder = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  setParameter: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue({ affected: 1 }),
};

jest.mock('../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Activity) return mockActivityRepo;
      if (entity === ActivityParticipantEntity) return mockParticipantRepo;
      return {};
    }),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  },
}));

describe('OperationCommandService', () => {
  let service: OperationCommandService;

  const orgId = 'org-1';
  const opsCommander = { id: 'user-ops', name: 'OpsCommander' };
  const fleetCmdr = { id: 'user-fc', name: 'FleetCmdr' };
  const squadLeader = { id: 'user-sl', name: 'SquadLeader' };
  const member = { id: 'user-member', name: 'Member' };

  const mockActivity: Partial<Activity> = {
    id: 'activity-1',
    title: 'Test Operation',
    activityType: 'operation' as ActivityType,
    status: ActivityStatus.PLANNING,
    organizationId: orgId,
    creatorId: opsCommander.id,
  };

  const mockParticipants: Partial<ActivityParticipantEntity>[] = [
    { userId: opsCommander.id, status: ActivityParticipantStatus.ACCEPTED },
    { userId: fleetCmdr.id, status: ActivityParticipantStatus.ACCEPTED },
    { userId: squadLeader.id, status: ActivityParticipantStatus.ACCEPTED },
    { userId: member.id, status: ActivityParticipantStatus.ACCEPTED },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OperationCommandService();
  });

  // ===== setCommandChain =====

  describe('setCommandChain', () => {
    it('should create a command chain with valid hierarchy', async () => {
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);
      mockActivityRepo.update.mockResolvedValue({ affected: 1 });
      mockParticipantRepo.find.mockResolvedValue(mockParticipants);
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const chain = await service.setCommandChain(
        'activity-1',
        orgId,
        opsCommander.id,
        opsCommander.name,
        [
          {
            userId: fleetCmdr.id,
            userName: fleetCmdr.name,
            fleetId: 'fleet-1',
            fleetName: 'Alpha',
          },
        ],
        [
          {
            userId: squadLeader.id,
            userName: squadLeader.name,
            squadronName: 'Bravo',
            reportsToUserId: fleetCmdr.id,
          },
        ]
      );

      expect(chain).toBeDefined();
      expect(chain.commanderId).toBe(opsCommander.id);
      expect(chain.nodes[opsCommander.id].rank).toBe('ops_commander');
      expect(chain.nodes[fleetCmdr.id].rank).toBe('fleet_commander');
      expect(chain.nodes[squadLeader.id].rank).toBe('squadron_leader');
      expect(chain.nodes[member.id].rank).toBe('member');
      expect(chain.nodes[opsCommander.id].subordinateIds).toContain(fleetCmdr.id);
      expect(chain.nodes[fleetCmdr.id].subordinateIds).toContain(squadLeader.id);
    });

    it('should throw ForbiddenError for non-creator', async () => {
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);

      await expect(
        service.setCommandChain('activity-1', orgId, 'user-random', 'Random', [], [])
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw ValidationError for non-participant fleet commander', async () => {
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);
      mockParticipantRepo.find.mockResolvedValue(mockParticipants);

      await expect(
        service.setCommandChain(
          'activity-1',
          orgId,
          opsCommander.id,
          opsCommander.name,
          [{ userId: 'user-unknown', userName: 'Unknown' }],
          []
        )
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for squadron leader reporting to unknown commander', async () => {
      mockActivityRepo.findOne.mockResolvedValue(mockActivity);
      mockParticipantRepo.find.mockResolvedValue(mockParticipants);

      await expect(
        service.setCommandChain(
          'activity-1',
          orgId,
          opsCommander.id,
          opsCommander.name,
          [{ userId: fleetCmdr.id, userName: fleetCmdr.name }],
          [
            {
              userId: squadLeader.id,
              userName: squadLeader.name,
              squadronName: 'Test',
              reportsToUserId: 'nonexistent',
            },
          ]
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  // ===== issueCommand =====

  describe('issueCommand', () => {
    const mockChain = {
      activityId: 'activity-1',
      organizationId: orgId,
      commanderId: opsCommander.id,
      commanderName: opsCommander.name,
      nodes: {
        [opsCommander.id]: {
          userId: opsCommander.id,
          userName: opsCommander.name,
          rank: 'ops_commander' as const,
          subordinateIds: [fleetCmdr.id],
        },
        [fleetCmdr.id]: {
          userId: fleetCmdr.id,
          userName: fleetCmdr.name,
          rank: 'fleet_commander' as const,
          fleetId: 'fleet-1',
          subordinateIds: [squadLeader.id],
          superiorId: opsCommander.id,
        },
        [squadLeader.id]: {
          userId: squadLeader.id,
          userName: squadLeader.name,
          rank: 'squadron_leader' as const,
          squadronName: 'Bravo',
          subordinateIds: [member.id],
          superiorId: fleetCmdr.id,
        },
        [member.id]: {
          userId: member.id,
          userName: member.name,
          rank: 'member' as const,
          subordinateIds: [],
          superiorId: squadLeader.id,
        },
      },
      updatedAt: new Date().toISOString(),
    };

    beforeEach(() => {
      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('op_chain:')) return Promise.resolve(mockChain);
        if (key.startsWith('op_cmds:')) return Promise.resolve([]);
        return Promise.resolve(null);
      });
      (redisClient.set as jest.Mock).mockResolvedValue(true);
    });

    it('should issue a command from ops commander to all', async () => {
      const cmd = await service.issueCommand(
        'activity-1',
        orgId,
        { userId: opsCommander.id, userName: opsCommander.name },
        'order',
        'All ships form up',
        { type: 'all' }
      );

      expect(cmd).toBeDefined();
      expect(cmd.type).toBe('order');
      expect(cmd.issuedByRank).toBe('ops_commander');
      expect(cmd.targetScope.resolvedRecipientIds).toHaveLength(3);
      expect(cmd.targetScope.resolvedRecipientIds).toContain(fleetCmdr.id);
      expect(cmd.targetScope.resolvedRecipientIds).toContain(squadLeader.id);
      expect(cmd.targetScope.resolvedRecipientIds).toContain(member.id);
    });

    it('should only allow commanding subordinates', async () => {
      const cmd = await service.issueCommand(
        'activity-1',
        orgId,
        { userId: fleetCmdr.id, userName: fleetCmdr.name },
        'rally',
        'Rally at waypoint alpha',
        { type: 'all' }
      );

      // Fleet commander should only reach squadron leader and member
      expect(cmd.targetScope.resolvedRecipientIds).toHaveLength(2);
      expect(cmd.targetScope.resolvedRecipientIds).toContain(squadLeader.id);
      expect(cmd.targetScope.resolvedRecipientIds).toContain(member.id);
      // Should NOT contain ops commander
      expect(cmd.targetScope.resolvedRecipientIds).not.toContain(opsCommander.id);
    });

    it('should throw ForbiddenError for member trying to issue command', async () => {
      await expect(
        service.issueCommand(
          'activity-1',
          orgId,
          { userId: member.id, userName: member.name },
          'order',
          'Test',
          {
            type: 'all',
          }
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('should throw NotFoundError when no chain exists', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await expect(
        service.issueCommand(
          'activity-1',
          orgId,
          { userId: opsCommander.id, userName: opsCommander.name },
          'order',
          'Test',
          { type: 'all' }
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ===== acknowledgeCommand =====

  describe('acknowledgeCommand', () => {
    const mockCommand = {
      id: 'cmd-1',
      activityId: 'activity-1',
      organizationId: orgId,
      type: 'order',
      priority: 'routine',
      issuedBy: opsCommander.id,
      issuedByName: opsCommander.name,
      issuedByRank: 'ops_commander',
      targetScope: {
        type: 'all',
        resolvedRecipientIds: [fleetCmdr.id, squadLeader.id],
      },
      message: 'Form up',
      issuedAt: new Date().toISOString(),
      status: 'issued',
      acknowledgements: [],
    };

    it('should record an acknowledgement', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue({ ...mockCommand });
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const result = await service.acknowledgeCommand('cmd-1', fleetCmdr.id, fleetCmdr.name);

      expect(result.acknowledgements).toHaveLength(1);
      expect(result.acknowledgements[0].userId).toBe(fleetCmdr.id);
    });

    it('should auto-complete when all recipients acknowledge', async () => {
      const oneAcked = {
        ...mockCommand,
        acknowledgements: [
          {
            userId: fleetCmdr.id,
            userName: fleetCmdr.name,
            acknowledgedAt: new Date().toISOString(),
          },
        ],
      };

      (redisClient.get as jest.Mock).mockResolvedValue({ ...oneAcked });
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const result = await service.acknowledgeCommand('cmd-1', squadLeader.id, squadLeader.name);

      expect(result.status).toBe('acknowledged');
      expect(result.acknowledgedAt).toBeDefined();
    });

    it('should throw ForbiddenError for non-recipient', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue({ ...mockCommand });

      await expect(service.acknowledgeCommand('cmd-1', member.id, member.name)).rejects.toThrow(
        ForbiddenError
      );
    });

    it('should throw ConflictError for duplicate acknowledgement', async () => {
      const alreadyAcked = {
        ...mockCommand,
        acknowledgements: [
          {
            userId: fleetCmdr.id,
            userName: fleetCmdr.name,
            acknowledgedAt: new Date().toISOString(),
          },
        ],
      };

      (redisClient.get as jest.Mock).mockResolvedValue(alreadyAcked);

      await expect(
        service.acknowledgeCommand('cmd-1', fleetCmdr.id, fleetCmdr.name)
      ).rejects.toThrow(ConflictError);
    });

    it('should throw NotFoundError for expired command', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null);

      await expect(
        service.acknowledgeCommand('cmd-999', fleetCmdr.id, fleetCmdr.name)
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ===== preflightCheck =====

  describe('issuePreflightCheck', () => {
    it('should issue a preflight_check command with urgent priority', async () => {
      const mockChain = {
        activityId: 'activity-1',
        organizationId: orgId,
        commanderId: opsCommander.id,
        nodes: {
          [opsCommander.id]: {
            userId: opsCommander.id,
            userName: opsCommander.name,
            rank: 'ops_commander',
            subordinateIds: [fleetCmdr.id],
          },
          [fleetCmdr.id]: {
            userId: fleetCmdr.id,
            userName: fleetCmdr.name,
            rank: 'fleet_commander',
            subordinateIds: [],
            superiorId: opsCommander.id,
          },
        },
      };

      (redisClient.get as jest.Mock).mockImplementation((key: string) => {
        if (key.startsWith('op_chain:')) return Promise.resolve(mockChain);
        if (key.startsWith('op_cmds:')) return Promise.resolve([]);
        return Promise.resolve(null);
      });
      (redisClient.set as jest.Mock).mockResolvedValue(true);

      const cmd = await service.issuePreflightCheck(
        'activity-1',
        orgId,
        opsCommander.id,
        opsCommander.name
      );

      expect(cmd.type).toBe('preflight_check');
      expect(cmd.priority).toBe('urgent');
      expect(cmd.message).toContain('Pre-flight check');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
