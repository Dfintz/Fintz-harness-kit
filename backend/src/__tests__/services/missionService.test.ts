import { AppDataSource } from '../../config/database';
import {
  Mission,
  MissionDifficulty,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../models/Mission';
import { MissionService } from '../../services/content/MissionService';
import { ConflictError, ValidationError } from '../../utils/apiErrors';

// Mock the database
jest.mock('../../config/database', () => ({
  AppDataSource: {
    isInitialized: true,
    getRepository: jest.fn(),
  },
}));

// Mock the logger
jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

describe('MissionService', () => {
  let missionService: MissionService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRepository: any;

  const orgId = 'org-123';
  const userId = 'user-456';
  const missionId = 'mission-789';

  const baseMission: Partial<Mission> = {
    id: missionId,
    organizationId: orgId,
    title: 'Test Mission',
    description: 'A test mission',
    missionType: MissionType.COMBAT,
    status: MissionStatus.DRAFT,
    difficulty: MissionDifficulty.MEDIUM,
    priority: MissionPriority.NORMAL,
    createdBy: userId,
    objectives: [],
    participants: [],
    tags: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    canTransitionTo: Mission.prototype.canTransitionTo,
    isActive: Mission.prototype.isActive,
    isTerminal: Mission.prototype.isTerminal,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
      metadata: { name: 'Mission' },
    };

    (AppDataSource.getRepository as jest.Mock).mockReturnValue(mockRepository);

    missionService = new MissionService();
  });

  describe('SCMDB import mapping', () => {
    it('should add SCMDB source link to notes and tags when importing', async () => {
      const record = {
        id: 'record-1',
        source: 'scmdb',
        recordType: 'contract',
        externalId: '12345',
        displayName: 'Security Contract',
        category: 'combat',
        payloadHash: 'hash',
        payload: {
          title: 'Security Contract',
          description: 'Defend area',
          location: 'Stanton',
        },
        isActive: true,
      };

      const externalRepo = {
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([record]),
        })),
      };

      const missionRepo = {
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([]),
        })),
        create: jest.fn((input: unknown) => input),
        save: jest.fn(async (input: unknown) => input),
      };

      (AppDataSource.getRepository as jest.Mock).mockImplementation((entity: { name?: string }) => {
        if (entity?.name === 'ExternalCatalogRecord') return externalRepo;
        return missionRepo;
      });

      const service = new MissionService();
      const result = await service.importScmdbMissions(orgId, userId, [
        { externalId: '12345', notes: 'Operator note' },
      ]);

      expect(result.imported).toHaveLength(1);
      const imported = result.imported[0] as unknown as { notes: string; tags: string[] };
      expect(imported.notes).toContain('SCMDB Source: https://scmdb.net/en/contracts/12345');
      expect(imported.notes).toContain('Operator note');
      expect(imported.tags).toContain('source:https://scmdb.net/en/contracts/12345');
      expect(imported.tags).toContain('scmdb:12345');
    });
  });

  // ---- CRUD ----

  describe('createMission', () => {
    it('should create a mission with tenant scoping', async () => {
      const missionData: Partial<Mission> = {
        title: 'New Mission',
        description: 'Mission description',
        missionType: MissionType.MINING,
        createdBy: userId,
      };

      const created = { ...baseMission, ...missionData, organizationId: orgId };
      mockRepository.create.mockReturnValue(created);
      mockRepository.save.mockResolvedValue(created);

      const result = await missionService.createMission(orgId, missionData);

      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ...missionData,
          organizationId: orgId,
          status: MissionStatus.DRAFT,
        })
      );
      expect(mockRepository.save).toHaveBeenCalledWith(created);
      expect(result.organizationId).toBe(orgId);
      expect(result.title).toBe('New Mission');
    });
  });

  describe('getMissionById', () => {
    it('should find a mission by ID scoped to organization', async () => {
      mockRepository.findOne.mockResolvedValue(baseMission);

      const result = await missionService.getMissionById(missionId, orgId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: missionId, organizationId: orgId },
        relations: ['fleet'],
      });
      expect(result).toEqual(baseMission);
    });

    it('should return null for non-existent mission', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await missionService.getMissionById('nonexistent', orgId);

      expect(result).toBeNull();
    });

    it('should not return missions from another organization', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await missionService.getMissionById(missionId, 'other-org');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: missionId, organizationId: 'other-org' },
        relations: ['fleet'],
      });
      expect(result).toBeNull();
    });
  });

  describe('getAllMissions', () => {
    it('should return paginated missions scoped to organization', async () => {
      const missions = [baseMission];
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([missions, 1]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await missionService.getAllMissions(orgId, { page: 1, limit: 10 });

      expect(result.data).toEqual(missions);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'mission.organizationId = :organizationId',
        { organizationId: orgId }
      );
    });

    it('should apply status filter', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await missionService.getAllMissions(
        orgId,
        { page: 1, limit: 10 },
        { status: MissionStatus.PLANNED }
      );

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('mission.status = :status', {
        status: MissionStatus.PLANNED,
      });
    });

    it('should apply search filter across title, description, and location', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      await missionService.getAllMissions(orgId, { page: 1, limit: 10 }, { search: 'rescue' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(mission.title ILIKE :search OR mission.description ILIKE :search OR mission.location ILIKE :search)',
        { search: '%rescue%' }
      );
    });

    it('should calculate pagination correctly', async () => {
      const queryBuilder = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 25]),
      };
      mockRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await missionService.getAllMissions(orgId, { page: 2, limit: 10 });

      expect(queryBuilder.skip).toHaveBeenCalledWith(10);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.pagination.totalPages).toBe(3);
      expect(result.pagination.hasNext).toBe(true);
      expect(result.pagination.hasPrev).toBe(true);
    });
  });

  describe('updateMission', () => {
    it('should update a mission', async () => {
      const mission = { ...baseMission } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.updateMission(missionId, orgId, {
        title: 'Updated Title',
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe('Updated Title');
    });

    it('should return null for non-existent mission', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await missionService.updateMission(missionId, orgId, { title: 'Nope' });

      expect(result).toBeNull();
    });

    it('should validate status transition on update', async () => {
      const mission = { ...baseMission, status: MissionStatus.COMPLETED } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);

      await expect(
        missionService.updateMission(missionId, orgId, { status: MissionStatus.DRAFT })
      ).rejects.toThrow('Invalid status transition');
      // E3 error normalization: invalid transition is a 400 ValidationError (not 500)
      await expect(
        missionService.updateMission(missionId, orgId, { status: MissionStatus.DRAFT })
      ).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
      await expect(
        missionService.updateMission(missionId, orgId, { status: MissionStatus.DRAFT })
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('should auto-set completedAt when status moves to completed', async () => {
      const mission = { ...baseMission, status: MissionStatus.IN_PROGRESS } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.updateMission(missionId, orgId, {
        status: MissionStatus.COMPLETED,
      });

      expect(result?.completedAt).toBeDefined();
    });
  });

  describe('deleteMission', () => {
    it('should soft-delete a mission', async () => {
      const mission = { ...baseMission } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.deleteMission(missionId, orgId, userId);

      expect(result).toBe(true);
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: userId,
        })
      );
    });

    it('should return false for non-existent mission', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await missionService.deleteMission(missionId, orgId, userId);

      expect(result).toBe(false);
    });
  });

  // ---- Status Transitions ----

  describe('transitionStatus', () => {
    it('should transition draft → planned', async () => {
      const mission = { ...baseMission, status: MissionStatus.DRAFT } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.transitionStatus(missionId, orgId, MissionStatus.PLANNED);

      expect(result?.status).toBe(MissionStatus.PLANNED);
    });

    it('should transition planned → briefed', async () => {
      const mission = { ...baseMission, status: MissionStatus.PLANNED } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.transitionStatus(missionId, orgId, MissionStatus.BRIEFED);

      expect(result?.status).toBe(MissionStatus.BRIEFED);
    });

    it('should transition in_progress → completed', async () => {
      const mission = { ...baseMission, status: MissionStatus.IN_PROGRESS } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.transitionStatus(
        missionId,
        orgId,
        MissionStatus.COMPLETED
      );

      expect(result?.status).toBe(MissionStatus.COMPLETED);
      expect(result?.completedAt).toBeDefined();
    });

    it('should reject invalid transition completed → draft', async () => {
      const mission = { ...baseMission, status: MissionStatus.COMPLETED } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);

      await expect(
        missionService.transitionStatus(missionId, orgId, MissionStatus.DRAFT)
      ).rejects.toThrow('Invalid status transition');
      // E3 error normalization: invalid transition is a 400 ValidationError (not 500)
      await expect(
        missionService.transitionStatus(missionId, orgId, MissionStatus.DRAFT)
      ).rejects.toMatchObject({ name: 'ValidationError', statusCode: 400 });
    });

    it('should reject invalid transition failed → in_progress', async () => {
      const mission = { ...baseMission, status: MissionStatus.FAILED } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);

      await expect(
        missionService.transitionStatus(missionId, orgId, MissionStatus.IN_PROGRESS)
      ).rejects.toThrow('Invalid status transition');
    });

    it('should allow cancellation from any non-terminal state', async () => {
      for (const fromStatus of [
        MissionStatus.DRAFT,
        MissionStatus.PLANNED,
        MissionStatus.BRIEFED,
        MissionStatus.IN_PROGRESS,
      ]) {
        const mission = { ...baseMission, status: fromStatus } as Mission;
        mockRepository.findOne.mockResolvedValue(mission);
        mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

        const result = await missionService.transitionStatus(
          missionId,
          orgId,
          MissionStatus.CANCELLED
        );

        expect(result?.status).toBe(MissionStatus.CANCELLED);
      }
    });

    it('should return null for non-existent mission', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await missionService.transitionStatus(missionId, orgId, MissionStatus.PLANNED);

      expect(result).toBeNull();
    });
  });

  describe('completeMission', () => {
    it('should complete a mission with notes', async () => {
      const mission = { ...baseMission, status: MissionStatus.IN_PROGRESS } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.completeMission(missionId, orgId, {
        status: MissionStatus.COMPLETED,
        notes: 'Mission accomplished',
      });

      expect(result?.status).toBe(MissionStatus.COMPLETED);
      expect(result?.notes).toBe('Mission accomplished');
      expect(result?.completedAt).toBeDefined();
    });

    it('should fail a mission', async () => {
      const mission = { ...baseMission, status: MissionStatus.IN_PROGRESS } as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.completeMission(missionId, orgId, {
        status: MissionStatus.FAILED,
        notes: 'Ambushed by pirates',
      });

      expect(result?.status).toBe(MissionStatus.FAILED);
      expect(result?.notes).toBe('Ambushed by pirates');
    });
  });

  // ---- Participants ----

  describe('assignMission', () => {
    it('should assign a user to a mission', async () => {
      const mission = { ...baseMission, participants: [] } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.assignMission(missionId, orgId, 'user-lead');

      expect(result?.assignedTo).toBe('user-lead');
      expect(result?.participants).toHaveLength(1);
      expect(result?.participants[0].userId).toBe('user-lead');
      expect(result?.participants[0].role).toBe('leader');
      expect(result?.participants[0].status).toBe('confirmed');
    });

    it('should update role if user already a participant', async () => {
      const mission = {
        ...baseMission,
        participants: [
          {
            userId: 'user-lead',
            role: 'member',
            joinedAt: new Date().toISOString(),
            status: 'pending',
          },
        ],
      } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.assignMission(missionId, orgId, 'user-lead', 'leader');

      expect(result?.participants[0].role).toBe('leader');
      expect(result?.participants[0].status).toBe('confirmed');
    });
  });

  describe('addParticipant', () => {
    it('should add a new participant', async () => {
      const mission = { ...baseMission, participants: [] } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.addParticipant(missionId, orgId, 'user-new', 'support');

      expect(result?.participants).toHaveLength(1);
      expect(result?.participants[0].userId).toBe('user-new');
      expect(result?.participants[0].role).toBe('support');
      expect(result?.participants[0].status).toBe('pending');
    });

    it('should throw if user already a participant', async () => {
      const mission = {
        ...baseMission,
        participants: [
          {
            userId: 'user-dup',
            role: 'member',
            joinedAt: new Date().toISOString(),
            status: 'confirmed',
          },
        ],
      } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);

      await expect(missionService.addParticipant(missionId, orgId, 'user-dup')).rejects.toThrow(
        'already a participant'
      );
      // E3 error normalization: duplicate participant is a 409 ConflictError (not 500)
      await expect(
        missionService.addParticipant(missionId, orgId, 'user-dup')
      ).rejects.toMatchObject({ name: 'ConflictError', statusCode: 409 });
      await expect(
        missionService.addParticipant(missionId, orgId, 'user-dup')
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe('removeParticipant', () => {
    it('should remove a participant', async () => {
      const mission = {
        ...baseMission,
        participants: [
          {
            userId: 'user-a',
            role: 'member',
            joinedAt: new Date().toISOString(),
            status: 'confirmed',
          },
          {
            userId: 'user-b',
            role: 'support',
            joinedAt: new Date().toISOString(),
            status: 'confirmed',
          },
        ],
      } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.removeParticipant(missionId, orgId, 'user-a');

      expect(result?.participants).toHaveLength(1);
      expect(result?.participants[0].userId).toBe('user-b');
    });

    it('should clear assignedTo if removed user was the assignee', async () => {
      const mission = {
        ...baseMission,
        assignedTo: 'user-a',
        participants: [
          {
            userId: 'user-a',
            role: 'leader',
            joinedAt: new Date().toISOString(),
            status: 'confirmed',
          },
        ],
      } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.removeParticipant(missionId, orgId, 'user-a');

      expect(result?.assignedTo).toBeUndefined();
      expect(result?.participants).toHaveLength(0);
    });
  });

  describe('getParticipants', () => {
    it('should return participants for a mission', async () => {
      const participants = [
        {
          userId: 'user-a',
          role: 'leader',
          joinedAt: new Date().toISOString(),
          status: 'confirmed',
        },
      ];
      const mission = { ...baseMission, participants } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);

      const result = await missionService.getParticipants(missionId, orgId);

      expect(result).toEqual(participants);
    });

    it('should return null for non-existent mission', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await missionService.getParticipants(missionId, orgId);

      expect(result).toBeNull();
    });
  });

  // ---- Objectives ----

  describe('addObjective', () => {
    it('should add an objective to a mission', async () => {
      const mission = { ...baseMission, objectives: [] } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.addObjective(missionId, orgId, {
        title: 'Destroy target',
        description: 'Eliminate the hostile station',
      });

      expect(result?.objectives).toHaveLength(1);
      expect(result?.objectives[0].title).toBe('Destroy target');
      expect(result?.objectives[0].completed).toBe(false);
      expect(result?.objectives[0].order).toBe(1);
      expect(result?.objectives[0].id).toBeDefined();
    });

    it('should increment order for subsequent objectives', async () => {
      const mission = {
        ...baseMission,
        objectives: [
          { id: 'obj-1', title: 'First', completed: false, order: 1 },
          { id: 'obj-2', title: 'Second', completed: false, order: 2 },
        ],
      } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.addObjective(missionId, orgId, { title: 'Third' });

      expect(result?.objectives).toHaveLength(3);
      expect(result?.objectives[2].order).toBe(3);
    });
  });

  describe('updateObjective', () => {
    it('should update an existing objective', async () => {
      const mission = {
        ...baseMission,
        objectives: [
          { id: 'obj-1', title: 'Original', description: 'Desc', completed: false, order: 1 },
        ],
      } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.updateObjective(missionId, orgId, 'obj-1', {
        title: 'Updated',
        completed: true,
      });

      expect(result?.objectives[0].title).toBe('Updated');
      expect(result?.objectives[0].completed).toBe(true);
    });

    it('should return null if objective not found', async () => {
      const mission = { ...baseMission, objectives: [] } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);

      const result = await missionService.updateObjective(missionId, orgId, 'nonexistent', {
        title: 'Nope',
      });

      expect(result).toBeNull();
    });
  });

  describe('removeObjective', () => {
    it('should remove an objective', async () => {
      const mission = {
        ...baseMission,
        objectives: [
          { id: 'obj-1', title: 'Keep', completed: false, order: 1 },
          { id: 'obj-2', title: 'Remove', completed: false, order: 2 },
        ],
      } as unknown as Mission;
      mockRepository.findOne.mockResolvedValue(mission);
      mockRepository.save.mockImplementation((m: Mission) => Promise.resolve(m));

      const result = await missionService.removeObjective(missionId, orgId, 'obj-2');

      expect(result?.objectives).toHaveLength(1);
      expect(result?.objectives[0].id).toBe('obj-1');
    });
  });

  // ---- Query Helpers ----

  describe('getActiveMissions', () => {
    it('should return planned, briefed, and in_progress missions', async () => {
      const activeMissions = [baseMission];
      mockRepository.find.mockResolvedValue(activeMissions);

      const result = await missionService.getActiveMissions(orgId);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.arrayContaining([
            expect.objectContaining({ organizationId: orgId, status: MissionStatus.PLANNED }),
            expect.objectContaining({ organizationId: orgId, status: MissionStatus.BRIEFED }),
            expect.objectContaining({ organizationId: orgId, status: MissionStatus.IN_PROGRESS }),
          ]),
        })
      );
      expect(result).toEqual(activeMissions);
    });
  });

  describe('getTemplates', () => {
    it('should return draft missions without assignee', async () => {
      mockRepository.find.mockResolvedValue([baseMission]);

      const result = await missionService.getTemplates(orgId);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            status: MissionStatus.DRAFT,
            assignedTo: undefined,
          }),
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getMissionsByFleet', () => {
    it('should return missions for a specific fleet', async () => {
      const fleetId = 'fleet-001';
      mockRepository.find.mockResolvedValue([baseMission]);

      const result = await missionService.getMissionsByFleet(fleetId, orgId);

      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            fleetId,
            organizationId: orgId,
          }),
        })
      );
      expect(result).toHaveLength(1);
    });
  });

  // ---- Database Initialization Guard ----

  describe('database initialization guard', () => {
    it('should throw when AppDataSource is not initialized', () => {
      (AppDataSource as { isInitialized: boolean }).isInitialized = false;

      // Create a new service instance against uninitialized DB
      const uninitService = new MissionService();

      expect(() => {
        // Access the repository getter by calling any method that uses it
        // We can't directly test the getter, so we trigger it via create
        return uninitService.createMission(orgId, { title: 'fail' });
      }).rejects.toThrow('Database not initialized');

      // Restore
      (AppDataSource as { isInitialized: boolean }).isInitialized = true;
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
