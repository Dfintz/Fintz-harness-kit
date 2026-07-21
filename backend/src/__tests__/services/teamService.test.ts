/**
 * TeamService Tests — Wave 2.6 Teams/Squads System
 */

import {
  createMockDataSource,
  createMockQueryBuilder,
  createMockRepositoryWithData,
} from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));
jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

import type { Team } from '../../models/Team';
import type { TeamMember } from '../../models/TeamMember';
import { StarCommsContextSyncService } from '../../services/communication/starcomms';
import { TeamService } from '../../services/team/TeamService';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/apiErrors';

describe('TeamService (Wave 2.6)', () => {
  const ORG_ID = 'org-1';
  let service: TeamService;
  let mockTeams: Partial<Team>[];
  let mockMembers: Partial<TeamMember>[];
  let teamRepo: any;
  let memberRepo: any;
  let syncTeamContextSpy: jest.SpiedFunction<StarCommsContextSyncService['syncTeamContext']>;

  const makeTeam = (overrides: Partial<Team> = {}): Partial<Team> => ({
    id: `team-${Math.random().toString(36).substr(2, 6)}`,
    organizationId: ORG_ID,
    name: 'Alpha Squadron',
    type: 'squadron',
    level: 0,
    sortOrder: 0,
    maxMembers: 20,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const makeMember = (overrides: Partial<TeamMember> = {}): Partial<TeamMember> => ({
    id: `member-${Math.random().toString(36).substr(2, 6)}`,
    organizationId: ORG_ID,
    teamId: 'team-1',
    userId: 'user-1',
    role: 'member',
    status: 'active',
    joinedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockTeams = [];
    mockMembers = [];

    teamRepo = createMockRepositoryWithData(mockTeams);
    memberRepo = createMockRepositoryWithData(mockMembers);

    // Make getRepository return the right repo based on entity
    mockDataSource.getRepository.mockImplementation((entity: any) => {
      const name = typeof entity === 'function' ? entity.name : String(entity);
      if (name === 'TeamMember') return memberRepo;
      return teamRepo;
    });

    // Setup QueryBuilder for team repo
    const teamQB = createMockQueryBuilder(null);
    teamQB.getRawOne = jest.fn().mockResolvedValue({ max: -1 });
    teamQB.getRawMany = jest.fn().mockResolvedValue([]);
    teamRepo.createQueryBuilder.mockReturnValue(teamQB);

    // Setup QueryBuilder for member repo (for member counts)
    const memberQB = createMockQueryBuilder([]);
    memberQB.getRawMany = jest.fn().mockResolvedValue([]);
    memberRepo.createQueryBuilder.mockReturnValue(memberQB);

    // Setup query runner for transactions
    const mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        save: jest.fn(async (entity: any) => entity),
        find: jest.fn(async () => []),
        findOne: jest.fn(async () => null),
        update: jest.fn(async () => ({ affected: 1 })),
        createQueryBuilder: jest.fn(() => teamQB),
      },
    };
    mockDataSource.createQueryRunner.mockReturnValue(mockQueryRunner);

    syncTeamContextSpy = jest
      .spyOn(StarCommsContextSyncService.prototype, 'syncTeamContext')
      .mockResolvedValue(undefined);

    service = new TeamService();
  });

  describe('getTeamTree', () => {
    it('returns empty array when no teams', async () => {
      const tree = await service.getTeamTree(ORG_ID);
      expect(tree).toEqual([]);
    });

    it('builds hierarchy from flat team list', async () => {
      const parent = makeTeam({
        id: 'team-parent',
        name: 'Division A',
        type: 'division',
        level: 0,
      });
      const child = makeTeam({
        id: 'team-child',
        name: 'Squad 1',
        parentTeamId: 'team-parent',
        level: 1,
      });
      mockTeams.push(parent, child);

      const tree = await service.getTeamTree(ORG_ID);

      expect(tree).toHaveLength(1);
      expect(tree[0].name).toBe('Division A');
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('Squad 1');
    });

    it('includes member counts per team', async () => {
      const team = makeTeam({ id: 'team-1', name: 'Alpha' });
      mockTeams.push(team);

      // Setup member count query on the describe-scoped memberRepo
      const memberQB = createMockQueryBuilder([]);
      memberQB.getRawMany = jest.fn().mockResolvedValue([{ teamId: 'team-1', count: '5' }]);
      memberRepo.createQueryBuilder.mockReturnValue(memberQB);

      const tree = await service.getTeamTree(ORG_ID);

      expect(tree).toHaveLength(1);
      expect(tree[0].memberCount).toBe(5);
    });

    it('handles multi-level hierarchy', async () => {
      const root = makeTeam({ id: 'root', name: 'Division', level: 0 });
      const mid = makeTeam({ id: 'mid', name: 'Crew', parentTeamId: 'root', level: 1 });
      const leaf = makeTeam({ id: 'leaf', name: 'Squadron', parentTeamId: 'mid', level: 2 });
      mockTeams.push(root, mid, leaf);

      const tree = await service.getTeamTree(ORG_ID);

      expect(tree).toHaveLength(1);
      expect(tree[0].children[0].children[0].name).toBe('Squadron');
    });
  });

  describe('createTeam', () => {
    it('creates a root-level team with default values', async () => {
      const result = await service.createTeam(ORG_ID, {
        name: 'New Squadron',
        type: 'squadron',
      });

      expect(result).toBeDefined();
      expect(result.name).toBe('New Squadron');
      expect(result.organizationId).toBe(ORG_ID);
      expect(result.level).toBe(0);
      expect(syncTeamContextSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          teamId: result.id,
          teamName: 'New Squadron',
          action: 'team-created',
        })
      );
    });

    it('creates a child team under a parent', async () => {
      const parent = makeTeam({ id: 'parent-id', name: 'Division', level: 0 });
      mockTeams.push(parent);

      const result = await service.createTeam(ORG_ID, {
        name: 'Child Squad',
        parentTeamId: 'parent-id',
      });

      expect(result).toBeDefined();
      expect(result.level).toBe(1);
      expect(result.parentTeamId).toBe('parent-id');
    });

    it('does not fail createTeam when StarComms team sync rejects', async () => {
      syncTeamContextSpy.mockRejectedValueOnce(new Error('sync unavailable'));

      await expect(
        service.createTeam(ORG_ID, {
          name: 'Resilient Team',
          type: 'squadron',
        })
      ).resolves.toBeDefined();
    });

    it('rejects nesting beyond 5 levels', async () => {
      const deepTeam = makeTeam({ id: 'deep', level: 4 });
      mockTeams.push(deepTeam);

      await expect(
        service.createTeam(ORG_ID, { name: 'Too Deep', parentTeamId: 'deep' })
      ).rejects.toThrow('Maximum nesting depth');

      const error = await service
        .createTeam(ORG_ID, { name: 'Too Deep', parentTeamId: 'deep' })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });
  });

  describe('addMember', () => {
    it('adds a member to a team', async () => {
      const team = makeTeam({ id: 'team-1' });
      mockTeams.push(team);

      const result = await service.addMember(ORG_ID, 'team-1', 'user-1', 'member');

      expect(result).toBeDefined();
      expect(result.teamId).toBe('team-1');
      expect(result.userId).toBe('user-1');
      expect(result.role).toBe('member');
      expect(result.status).toBe('active');
    });

    it('rejects when team is at capacity', async () => {
      const team = makeTeam({ id: 'team-1', maxMembers: 2 });
      mockTeams.push(team);

      // Mock count to return 2 (at capacity) on the describe-scoped memberRepo
      memberRepo.count.mockResolvedValue(2);

      await expect(service.addMember(ORG_ID, 'team-1', 'user-new', 'member')).rejects.toThrow(
        'maximum capacity'
      );

      const error = await service
        .addMember(ORG_ID, 'team-1', 'user-new', 'member')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('rejects duplicate active member', async () => {
      const team = makeTeam({ id: 'team-1' });
      mockTeams.push(team);

      const existing = makeMember({ teamId: 'team-1', userId: 'user-1', status: 'active' });
      mockMembers.push(existing);

      await expect(service.addMember(ORG_ID, 'team-1', 'user-1', 'member')).rejects.toThrow(
        'already a member'
      );

      const error = await service
        .addMember(ORG_ID, 'team-1', 'user-1', 'member')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ConflictError);
      expect((error as ConflictError).statusCode).toBe(409);
    });

    it('re-activates a removed member', async () => {
      const team = makeTeam({ id: 'team-1' });
      mockTeams.push(team);

      const removed = makeMember({
        teamId: 'team-1',
        userId: 'user-1',
        status: 'removed',
        leftAt: new Date(),
      });
      mockMembers.push(removed);

      const result = await service.addMember(ORG_ID, 'team-1', 'user-1', 'officer');

      expect(result.status).toBe('active');
      expect(result.role).toBe('officer');
    });
  });

  describe('removeMember', () => {
    it('soft-removes a member by setting status and leftAt', async () => {
      const member = makeMember({ id: 'mem-1', teamId: 'team-1', status: 'active' });
      mockMembers.push(member);

      await service.removeMember(ORG_ID, 'team-1', 'mem-1');

      expect(member.status).toBe('removed');
      expect(member.leftAt).toBeDefined();
    });

    it('throws when member not found', async () => {
      await expect(service.removeMember(ORG_ID, 'team-1', 'nonexistent')).rejects.toThrow(
        'Team member not found'
      );

      const error = await service
        .removeMember(ORG_ID, 'team-1', 'nonexistent')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
    });
  });

  describe('deleteTeam', () => {
    it('deletes an existing team', async () => {
      const team = makeTeam({ id: 'team-1' });
      mockTeams.push(team);

      await service.deleteTeam(ORG_ID, 'team-1');
      // Should not throw
      expect(syncTeamContextSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: ORG_ID,
          teamId: 'team-1',
          action: 'team-deleted',
        })
      );
    });

    it('throws when team not found', async () => {
      await expect(service.deleteTeam(ORG_ID, 'nonexistent')).rejects.toThrow('Team not found');
    });

    it('does not fail deleteTeam when StarComms team sync rejects', async () => {
      const team = makeTeam({ id: 'team-2' });
      mockTeams.push(team);
      syncTeamContextSpy.mockRejectedValueOnce(new Error('sync unavailable'));

      await expect(service.deleteTeam(ORG_ID, 'team-2')).resolves.toBeUndefined();
    });
  });

  // ── Ship Assignment & Auto-Nesting Tests ────────────────────────────────

  describe('assignTeamToShip', () => {
    it('sets assignedShipId on the team', async () => {
      const squadron = makeTeam({ id: 'squad-1', name: 'Alpha Squadron', type: 'squadron' });
      mockTeams.push(squadron);

      const result = await service.assignTeamToShip(ORG_ID, 'squad-1', 'ship-idris-1', false);

      expect(result.assignedShipId).toBe('ship-idris-1');
    });

    it('throws when team not found', async () => {
      await expect(service.assignTeamToShip(ORG_ID, 'nonexistent', 'ship-1')).rejects.toThrow(
        'Team not found'
      );
    });

    it('auto-nests under crew team when one exists for the ship', async () => {
      const crewTeam = makeTeam({
        id: 'crew-idris',
        name: 'Idris Crew',
        type: 'crew',
        assignedShipId: 'ship-idris-1',
        level: 1,
      });
      const squadron = makeTeam({
        id: 'squad-1',
        name: 'Alpha Squadron',
        type: 'squadron',
        level: 1,
      });
      mockTeams.push(crewTeam, squadron);

      // moveTeam reads the team + validates parent; need to handle the transaction
      const moveTeamSpy = jest
        .spyOn(service, 'moveTeam')
        .mockResolvedValue(
          squadron as unknown as ReturnType<typeof service.moveTeam> extends Promise<infer R>
            ? R
            : never
        );

      await service.assignTeamToShip(ORG_ID, 'squad-1', 'ship-idris-1', true);

      expect(moveTeamSpy).toHaveBeenCalledWith(ORG_ID, 'squad-1', 'crew-idris');
      moveTeamSpy.mockRestore();
    });

    it('does not auto-nest when autoNest is false', async () => {
      const crewTeam = makeTeam({
        id: 'crew-idris',
        name: 'Idris Crew',
        type: 'crew',
        assignedShipId: 'ship-idris-1',
      });
      const squadron = makeTeam({ id: 'squad-1', name: 'Alpha Squadron', type: 'squadron' });
      mockTeams.push(crewTeam, squadron);

      const moveTeamSpy = jest.spyOn(service, 'moveTeam');

      await service.assignTeamToShip(ORG_ID, 'squad-1', 'ship-idris-1', false);

      expect(moveTeamSpy).not.toHaveBeenCalled();
      moveTeamSpy.mockRestore();
    });

    it('does not nest when no crew team exists for the ship', async () => {
      const squadron = makeTeam({ id: 'squad-1', name: 'Alpha Squadron', type: 'squadron' });
      mockTeams.push(squadron);

      const moveTeamSpy = jest.spyOn(service, 'moveTeam');

      await service.assignTeamToShip(ORG_ID, 'squad-1', 'ship-carrier-1', true);

      expect(moveTeamSpy).not.toHaveBeenCalled();
      moveTeamSpy.mockRestore();
    });
  });

  describe('unassignTeamFromShip', () => {
    it('clears assignedShipId', async () => {
      const squadron = makeTeam({
        id: 'squad-1',
        name: 'Alpha Squadron',
        assignedShipId: 'ship-idris-1',
      });
      mockTeams.push(squadron);

      const result = await service.unassignTeamFromShip(ORG_ID, 'squad-1');

      expect(result.assignedShipId).toBeUndefined();
    });

    it('throws when team not found', async () => {
      await expect(service.unassignTeamFromShip(ORG_ID, 'nonexistent')).rejects.toThrow(
        'Team not found'
      );
    });
  });

  describe('assignTeamToDivision', () => {
    it('sets assignedDivisionId and auto-moves', async () => {
      const division = makeTeam({
        id: 'div-security',
        name: 'Security Division',
        type: 'division',
        level: 0,
      });
      const squadron = makeTeam({
        id: 'squad-1',
        name: 'Alpha Squadron',
        type: 'squadron',
        level: 0,
      });
      mockTeams.push(division, squadron);

      const moveTeamSpy = jest
        .spyOn(service, 'moveTeam')
        .mockResolvedValue(
          squadron as unknown as ReturnType<typeof service.moveTeam> extends Promise<infer R>
            ? R
            : never
        );

      await service.assignTeamToDivision(ORG_ID, 'squad-1', 'div-security', true);

      expect(moveTeamSpy).toHaveBeenCalledWith(ORG_ID, 'squad-1', 'div-security');
      moveTeamSpy.mockRestore();
    });

    it('throws when division not found', async () => {
      const squadron = makeTeam({ id: 'squad-1', name: 'Alpha Squadron' });
      mockTeams.push(squadron);

      await expect(service.assignTeamToDivision(ORG_ID, 'squad-1', 'nonexistent')).rejects.toThrow(
        'Division not found'
      );
    });

    it('does not auto-move when autoNest is false', async () => {
      const division = makeTeam({ id: 'div-1', name: 'T&I Division', type: 'division' });
      const squadron = makeTeam({ id: 'squad-1', name: 'Mining Crew' });
      mockTeams.push(division, squadron);

      const moveTeamSpy = jest.spyOn(service, 'moveTeam');

      await service.assignTeamToDivision(ORG_ID, 'squad-1', 'div-1', false);

      expect(moveTeamSpy).not.toHaveBeenCalled();
      moveTeamSpy.mockRestore();
    });
  });

  describe('populateCrewFromAssignment', () => {
    it('returns zeroes when no active assignment exists', async () => {
      const result = await service.populateCrewFromAssignment(ORG_ID, 'crew-team-1', 'ship-1');

      expect(result).toEqual({ added: 0, skipped: 0 });
    });

    it('adds crew members to the team', async () => {
      // Mock CrewAssignment repository to return an active assignment
      const mockCrewRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          organizationId: ORG_ID,
          shipId: 'ship-1',
          status: 'active',
          crew: [
            { userId: 'user-pilot', role: 'pilot' },
            { userId: 'user-gunner', role: 'gunner' },
          ],
        }),
      };
      mockDataSource.getRepository.mockImplementation((entity: any) => {
        const name = typeof entity === 'function' ? entity.name : String(entity);
        if (name === 'TeamMember') return memberRepo;
        if (name === 'CrewAssignment') return mockCrewRepo;
        return teamRepo;
      });

      // Mock addMember to succeed
      const addMemberSpy = jest.spyOn(service, 'addMember').mockResolvedValue({} as any);

      const crewTeam = makeTeam({ id: 'crew-team-1', name: 'Idris Crew', type: 'crew' });
      mockTeams.push(crewTeam);

      const result = await service.populateCrewFromAssignment(ORG_ID, 'crew-team-1', 'ship-1');

      expect(result.added).toBe(2);
      expect(result.skipped).toBe(0);
      expect(addMemberSpy).toHaveBeenCalledTimes(2);
      expect(addMemberSpy).toHaveBeenCalledWith(ORG_ID, 'crew-team-1', 'user-pilot', 'member', {
        specialization: 'pilot',
      });
      expect(addMemberSpy).toHaveBeenCalledWith(ORG_ID, 'crew-team-1', 'user-gunner', 'member', {
        specialization: 'gunner',
      });
      addMemberSpy.mockRestore();
    });

    it('counts skipped members when addMember fails', async () => {
      const mockCrewRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'assignment-1',
          organizationId: ORG_ID,
          shipId: 'ship-1',
          status: 'active',
          crew: [
            { userId: 'user-1', role: 'captain' },
            { userId: 'user-2', role: 'engineer' },
          ],
        }),
      };
      mockDataSource.getRepository.mockImplementation((entity: any) => {
        const name = typeof entity === 'function' ? entity.name : String(entity);
        if (name === 'TeamMember') return memberRepo;
        if (name === 'CrewAssignment') return mockCrewRepo;
        return teamRepo;
      });

      // First call succeeds, second fails (already in team)
      const addMemberSpy = jest
        .spyOn(service, 'addMember')
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error('User already in team'));

      const result = await service.populateCrewFromAssignment(ORG_ID, 'crew-team-1', 'ship-1');

      expect(result.added).toBe(1);
      expect(result.skipped).toBe(1);
      addMemberSpy.mockRestore();
    });
  });

  describe('bulk operations — typed error contract', () => {
    it('bulkAddMembers throws ValidationError (400) for an empty list', async () => {
      const error = await service.bulkAddMembers(ORG_ID, 'team-1', []).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkAddMembers throws ValidationError (400) for more than 100 members', async () => {
      const members = Array.from({ length: 101 }, (_, i) => ({ userId: `user-${i}` }));
      const error = await service
        .bulkAddMembers(ORG_ID, 'team-1', members)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkUpdateMembers throws ValidationError (400) for an empty list', async () => {
      const error = await service.bulkUpdateMembers(ORG_ID, []).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkDeleteMembers throws ValidationError (400) for an empty list', async () => {
      const error = await service.bulkDeleteMembers(ORG_ID, 'team-1', []).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('bulkUpdateStatus throws ValidationError (400) for an empty list', async () => {
      const error = await service
        .bulkUpdateStatus(ORG_ID, 'team-1', [], 'active')
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});
