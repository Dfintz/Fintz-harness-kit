/**
 * ActivityService.loanShips Tests
 *
 * Tests for the ship loaning functionality in activities.
 * Verifies multiple ships can be loaned with proper flags and audit logging.
 */

import { mockAppDataSource } from '../helpers/database-mock';

jest.mock('../../config/database', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../data-source', () => ({
  AppDataSource: mockAppDataSource,
}));

jest.mock('../../websocket/websocketServer', () => ({
  emitToOrganization: jest.fn(),
}));

import { Activity, ActivityStatus, ActivityType, ActivityVisibility } from '../../models/Activity';
import { activityAuditLogger } from '../../services/activity/ActivityAuditLogger';
import { ActivityService } from '../../services/activity/ActivityService';

// Mock the audit logger
jest.spyOn(activityAuditLogger, 'log').mockImplementation(() => undefined);

describe('ActivityService.loanShips', () => {
  let activityService: ActivityService;
  let mockRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };

  const baseActivity: Partial<Activity> = {
    id: 'activity-1',
    title: 'Test Mission',
    activityType: ActivityType.MISSION,
    status: ActivityStatus.OPEN,
    visibility: ActivityVisibility.PUBLIC,
    organizationId: 'org-1',
    organizationName: 'Test Org',
    creatorId: 'user-1',
    creatorName: 'Creator',
    currentParticipants: 2,
    participants: [
      {
        userId: 'user-1',
        userName: 'Creator',
        role: 'leader' as never,
        status: 'accepted',
        joinedAt: new Date(),
      },
      {
        userId: 'user-2',
        userName: 'Pilot2',
        role: 'member' as never,
        status: 'accepted',
        joinedAt: new Date(),
      },
    ],
    shipAssignments: [],
    totalCrewCapacity: 0,
  };

  beforeEach(() => {
    activityService = new ActivityService();

    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(entity => Promise.resolve(entity)),
    };

    // Replace the repository used by the service
    (activityService as unknown as { repository: typeof mockRepository }).repository =
      mockRepository;

    // Mock participant service for normalized table queries
    const mockParticipantService = {
      isParticipant: jest.fn().mockImplementation(async (_activityId: string, userId: string) => {
        // Return true only for known participants from baseActivity
        return userId === 'user-1' || userId === 'user-2';
      }),
      isLeader: jest.fn().mockResolvedValue(false),
      updateParticipant: jest.fn().mockResolvedValue(undefined),
      getParticipant: jest.fn().mockResolvedValue(null),
    };
    (activityService as unknown as { _participantService: unknown })._participantService =
      mockParticipantService;

    jest.clearAllMocks();

    // Re-attach mocks after clearAllMocks
    mockParticipantService.isParticipant.mockImplementation(
      async (_activityId: string, userId: string) => userId === 'user-1' || userId === 'user-2'
    );
    mockParticipantService.updateParticipant.mockResolvedValue(undefined);
    (activityService as unknown as { _participantService: unknown })._participantService =
      mockParticipantService;
  });

  it('should loan a single ship to an activity', async () => {
    const activity = { ...baseActivity, shipAssignments: [] };
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.loanShips('activity-1', 'user-2', 'Pilot2', [
      { shipId: 'ship-1', shipType: 'Cutlass Black', shipName: 'My Cutlass' },
    ]);

    expect(result.shipAssignments).toHaveLength(1);
    const ship = result.shipAssignments![0];
    expect(ship.isLoaner).toBe(true);
    expect(ship.contributedBy).toBe('Pilot2');
    expect(ship.contributedByUserId).toBe('user-2');
    expect(ship.ownerId).toBe('user-2');
    expect(ship.shipType).toBe('Cutlass Black');
    expect(ship.shipName).toBe('My Cutlass');
    expect(ship.crewAssigned).toBe(0);
    expect(ship.crewMembers).toEqual([]);
    expect(ship.status).toBe('available');
  });

  it('should loan multiple ships at once', async () => {
    const activity = { ...baseActivity, shipAssignments: [] };
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.loanShips('activity-1', 'user-2', 'Pilot2', [
      { shipId: 'ship-1', shipType: 'Cutlass Black', shipName: 'Ship A' },
      { shipId: 'ship-2', shipType: 'Constellation Andromeda', shipName: 'Ship B' },
      { shipId: 'ship-3', shipType: 'Freelancer MAX', shipName: 'Ship C' },
    ]);

    expect(result.shipAssignments).toHaveLength(3);
    for (const ship of result.shipAssignments!) {
      expect(ship.isLoaner).toBe(true);
      expect(ship.contributedByUserId).toBe('user-2');
      expect(ship.crewAssigned).toBe(0);
    }
  });

  it('should increase totalCrewCapacity for loaned ships', async () => {
    const activity = { ...baseActivity, shipAssignments: [], totalCrewCapacity: 5 };
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.loanShips('activity-1', 'user-2', 'Pilot2', [
      { shipType: 'Hammerhead', crewCapacity: 8 },
      { shipType: 'Polaris', crewCapacity: 14 },
    ]);

    expect(result.totalCrewCapacity).toBe(5 + 8 + 14);
  });

  it('should throw if activity not found', async () => {
    mockRepository.findOne.mockResolvedValue(null);

    await expect(
      activityService.loanShips('nonexistent', 'user-2', 'Pilot2', [{ shipType: 'Aurora MR' }])
    ).rejects.toThrow();
  });

  it('should throw if user is not a participant', async () => {
    const activity = { ...baseActivity };
    mockRepository.findOne.mockResolvedValue(activity);

    await expect(
      activityService.loanShips('activity-1', 'user-999', 'Nobody', [{ shipType: 'Aurora MR' }])
    ).rejects.toThrow('User is not a participant');
  });

  it('should throw if ships array is empty', async () => {
    await expect(activityService.loanShips('activity-1', 'user-2', 'Pilot2', [])).rejects.toThrow(
      'At least one ship is required'
    );
  });

  it('should throw if too many ships are loaned', async () => {
    const tooManyShips = Array.from({ length: 21 }, (_, i) => ({
      shipType: `Ship Type ${String(i)}`,
    }));

    await expect(
      activityService.loanShips('activity-1', 'user-2', 'Pilot2', tooManyShips)
    ).rejects.toThrow('Cannot loan more than 20 ships at once');
  });

  it('should append to existing shipAssignments', async () => {
    const activity = {
      ...baseActivity,
      shipAssignments: [
        {
          shipType: 'Existing Ship',
          ownerId: 'user-1',
          ownerName: 'Creator',
          role: 'combat',
          crewCapacity: 2,
          crewAssigned: 1,
          crewMembers: [{ userId: 'user-1', userName: 'Creator', position: 'pilot' }],
          capabilities: [],
          status: 'assigned',
        },
      ],
    };
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.loanShips('activity-1', 'user-2', 'Pilot2', [
      { shipType: 'Cutlass Black', shipName: 'Loaner' },
    ]);

    expect(result.shipAssignments).toHaveLength(2);
    expect(result.shipAssignments![0].shipType).toBe('Existing Ship');
    expect(result.shipAssignments![1].isLoaner).toBe(true);
    expect(result.shipAssignments![1].shipType).toBe('Cutlass Black');
  });

  it('should log audit event with loaner details', async () => {
    const activity = { ...baseActivity, shipAssignments: [] };
    mockRepository.findOne.mockResolvedValue(activity);

    await activityService.loanShips('activity-1', 'user-2', 'Pilot2', [
      { shipId: 'ship-1', shipType: 'Cutlass Black' },
    ]);

    expect(activityAuditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        activityId: 'activity-1',
        performedById: 'user-2',
        performedByName: 'Pilot2',
        details: expect.objectContaining({
          isLoaner: true,
          shipCount: 1,
        }),
      })
    );
  });

  it('should default crewCapacity to 1 when not specified', async () => {
    const activity = { ...baseActivity, shipAssignments: [], totalCrewCapacity: 0 };
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.loanShips('activity-1', 'user-2', 'Pilot2', [
      { shipType: 'Aurora MR' },
    ]);

    expect(result.shipAssignments![0].crewCapacity).toBe(1);
    expect(result.totalCrewCapacity).toBe(1);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });
});

// ============================================================================
// ActivityService.addShip — auto-loaner promotion tests
// ============================================================================

describe('ActivityService.addShip — auto-loaner promotion', () => {
  let activityService: ActivityService;
  let mockRepository: { findOne: jest.Mock; save: jest.Mock };
  let mockParticipantService: {
    isParticipant: jest.Mock;
    updateParticipant: jest.Mock;
    getParticipant: jest.Mock;
  };

  const baseShip = {
    shipType: 'Cutlass Black',
    shipName: 'Black Widow',
    role: 'combat' as const,
    crewCapacity: 3,
    capabilities: [] as string[],
  };

  const existingCrewedAssignment = {
    shipId: 'ship-existing',
    shipType: 'Terrapin',
    shipName: 'The Scout',
    ownerId: 'user-2',
    ownerName: 'Pilot2',
    role: 'scout',
    crewCapacity: 2,
    crewAssigned: 1,
    crewMembers: [{ userId: 'user-2', userName: 'Pilot2', position: 'pilot' }],
    capabilities: [],
    status: 'assigned',
    isLoaner: false,
  };

  beforeEach(() => {
    activityService = new ActivityService();

    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    };
    (activityService as unknown as { repository: typeof mockRepository }).repository =
      mockRepository;

    mockParticipantService = {
      isParticipant: jest
        .fn()
        .mockImplementation((_: string, uid: string) =>
          Promise.resolve(uid === 'user-1' || uid === 'user-2')
        ),
      updateParticipant: jest.fn().mockResolvedValue(undefined),
      getParticipant: jest.fn().mockResolvedValue({ userName: 'Pilot2', avatarUrl: undefined }),
    };
    (activityService as unknown as { _participantService: unknown })._participantService =
      mockParticipantService;
  });

  it('adds the user as pilot when they have no existing crewed ship', async () => {
    mockRepository.findOne.mockResolvedValue({
      id: 'activity-1',
      organizationId: 'org-1',
      ships: [],
      shipAssignments: [],
      totalCrewCapacity: 0,
      totalCrewAssigned: 0,
    });

    const result = await activityService.addShip('activity-1', 'user-2', baseShip);

    const added = result.shipAssignments![0];
    expect(added.isLoaner).toBeFalsy();
    expect(added.status).toBe('assigned');
    expect(added.crewAssigned).toBe(1);
    expect(added.crewMembers).toHaveLength(1);
    expect(added.crewMembers[0].position).toBe('pilot');
    expect(added.crewMembers[0].userId).toBe('user-2');
    expect(result.totalCrewAssigned).toBe(1);
    expect(mockParticipantService.updateParticipant).toHaveBeenCalledWith(
      'activity-1',
      'user-2',
      expect.objectContaining({ shipType: baseShip.shipType })
    );
  });

  it('promotes to loaner when user already has a crewed ship (shipAssignments path)', async () => {
    mockRepository.findOne.mockResolvedValue({
      id: 'activity-1',
      organizationId: 'org-1',
      ships: [],
      shipAssignments: [existingCrewedAssignment],
      totalCrewCapacity: 2,
      totalCrewAssigned: 1,
    });

    const result = await activityService.addShip('activity-1', 'user-2', baseShip);

    const added = result.shipAssignments![1];
    expect(added.isLoaner).toBe(true);
    expect(added.status).toBe('available');
    expect(added.crewAssigned).toBe(0);
    expect(added.crewMembers).toEqual([]);
    expect(added.contributedBy).toBe('Pilot2');
    expect(added.contributedByUserId).toBe('user-2');
    // totalCrewAssigned must NOT be incremented for a loaner
    expect(result.totalCrewAssigned).toBe(1);
    // participant ship info must NOT be overwritten with the loaner ship
    expect(mockParticipantService.updateParticipant).not.toHaveBeenCalled();
  });

  it('promotes to loaner when user already has a crewed ship (legacy ships[] path)', async () => {
    const legacyShip = {
      ...existingCrewedAssignment,
      // legacy ships array uses the same ownerId field
    };
    mockRepository.findOne.mockResolvedValue({
      id: 'activity-1',
      organizationId: 'org-1',
      ships: [legacyShip],
      shipAssignments: [],
      totalCrewCapacity: 2,
      totalCrewAssigned: 1,
    });

    const result = await activityService.addShip('activity-1', 'user-2', baseShip);

    const added = result.shipAssignments![0];
    expect(added.isLoaner).toBe(true);
    expect(added.crewMembers).toEqual([]);
    expect(added.crewAssigned).toBe(0);
  });

  it('does NOT promote to loaner when the existing ship is already a loaner', async () => {
    const existingLoaner = { ...existingCrewedAssignment, isLoaner: true };
    mockRepository.findOne.mockResolvedValue({
      id: 'activity-1',
      organizationId: 'org-1',
      ships: [],
      shipAssignments: [existingLoaner],
      totalCrewCapacity: 2,
      totalCrewAssigned: 0,
    });

    const result = await activityService.addShip('activity-1', 'user-2', baseShip);

    const added = result.shipAssignments![1];
    // The existing ship is a loaner (user isn't crewing it), so the new ship
    // is the user's first personally-crewed ship and should be assigned normally.
    expect(added.isLoaner).toBeFalsy();
    expect(added.crewAssigned).toBe(1);
    expect(added.crewMembers).toHaveLength(1);
  });

  it('does NOT auto-loaner for nested ships — isNested overrides the check', async () => {
    mockRepository.findOne.mockResolvedValue({
      id: 'activity-1',
      organizationId: 'org-1',
      ships: [],
      shipAssignments: [
        existingCrewedAssignment,
        {
          ...existingCrewedAssignment,
          shipId: 'parent-ship',
          shipType: 'Caterpillar',
          shipName: 'The Cat',
        },
      ],
      totalCrewCapacity: 4,
      totalCrewAssigned: 1,
    });

    const nestedShip = { ...baseShip, parentShipId: 'parent-ship' };
    const result = await activityService.addShip('activity-1', 'user-2', nestedShip);

    const added = result.shipAssignments![result.shipAssignments!.length - 1];
    // Nested ships always have no crew regardless of auto-loaner logic
    expect(added.crewMembers).toEqual([]);
    expect(added.crewAssigned).toBe(0);
    // Critically: isLoaner should NOT be set just because the user has another ship
    expect(added.isLoaner).toBeFalsy();
  });
});
