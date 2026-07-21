/**
 * ActivityService.leaveShipCrew Tests
 *
 * Verifies that any crew member — including pilots and ship owners — can leave
 * a ship's crew. The previous captain-block guard was removed so that captains
 * are no longer forced to "transfer captaincy first".
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

jest.spyOn(activityAuditLogger, 'log').mockImplementation(() => undefined);

describe('ActivityService.leaveShipCrew', () => {
  let activityService: ActivityService;
  let mockRepository: { findOne: jest.Mock; save: jest.Mock };
  let mockParticipantService: {
    isParticipant: jest.Mock;
    updateParticipant: jest.Mock;
    getParticipant: jest.Mock;
  };

  const makeActivity = (overrides: Partial<Activity> = {}): Partial<Activity> => ({
    id: 'activity-1',
    title: 'Test Mission',
    activityType: ActivityType.MISSION,
    status: ActivityStatus.OPEN,
    visibility: ActivityVisibility.PUBLIC,
    organizationId: 'org-1',
    organizationName: 'Test Org',
    creatorId: 'creator-1',
    creatorName: 'Creator',
    currentParticipants: 2,
    totalCrewAssigned: 2,
    participants: [
      {
        userId: 'creator-1',
        userName: 'Creator',
        role: 'leader' as never,
        status: 'accepted',
        joinedAt: new Date(),
      },
      {
        userId: 'pilot-user',
        userName: 'The Pilot',
        role: 'member' as never,
        status: 'accepted',
        joinedAt: new Date(),
      },
    ],
    ships: [],
    ...overrides,
  });

  beforeEach(() => {
    activityService = new ActivityService();

    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((entity: unknown) => Promise.resolve(entity)),
    };
    (activityService as unknown as { repository: typeof mockRepository }).repository =
      mockRepository;

    mockParticipantService = {
      isParticipant: jest.fn().mockResolvedValue(true),
      updateParticipant: jest.fn().mockResolvedValue(undefined),
      getParticipant: jest.fn().mockResolvedValue({ userName: 'The Pilot', avatarUrl: undefined }),
    };
    (activityService as unknown as { _participantService: unknown })._participantService =
      mockParticipantService;
  });

  // ── Happy path: regular crew member ──────────────────────────────────────

  it('removes a regular crew member from a ship', async () => {
    const activity = makeActivity({
      shipAssignments: [
        {
          id: 'ship-1',
          shipType: 'Cutlass Black',
          ownerId: 'owner-1',
          ownerName: 'Owner',
          role: 'combat',
          crewCapacity: 3,
          crewAssigned: 2,
          crewMembers: [
            { userId: 'owner-1', userName: 'Owner', position: 'pilot' },
            { userId: 'crew-member', userName: 'Crew', position: 'gunner' },
          ],
          capabilities: [],
          status: 'assigned',
        },
      ],
    });
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.leaveShipCrew('activity-1', 'crew-member');

    expect(result.shipAssignments![0].crewAssigned).toBe(1);
    expect(result.shipAssignments![0].crewMembers).toHaveLength(1);
    expect(result.shipAssignments![0].crewMembers[0].userId).toBe('owner-1');
  });

  // ── Pilot can leave ───────────────────────────────────────────────────────

  it('allows a pilot to leave their own ship', async () => {
    const activity = makeActivity({
      shipAssignments: [
        {
          id: 'ship-1',
          shipType: 'Terrapin',
          ownerId: 'pilot-user',
          ownerName: 'The Pilot',
          role: 'scout',
          crewCapacity: 2,
          crewAssigned: 1,
          crewMembers: [{ userId: 'pilot-user', userName: 'The Pilot', position: 'pilot' }],
          capabilities: [],
          status: 'assigned',
        },
      ],
    });
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.leaveShipCrew('activity-1', 'pilot-user');

    expect(result.shipAssignments![0].crewAssigned).toBe(0);
    expect(result.shipAssignments![0].crewMembers).toHaveLength(0);
  });

  // ── Captain (ownerId) can leave ───────────────────────────────────────────

  it('allows a ship owner (captain) to leave crew even with other crew aboard', async () => {
    const activity = makeActivity({
      shipAssignments: [
        {
          id: 'ship-1',
          shipType: 'Perseus',
          ownerId: 'captain-user',
          ownerName: 'Captain',
          captainId: 'captain-user',
          role: 'combat',
          crewCapacity: 7,
          crewAssigned: 3,
          crewMembers: [
            { userId: 'captain-user', userName: 'Captain', position: 'Captain' },
            { userId: 'gunner-1', userName: 'Gunner A', position: 'gunner' },
            { userId: 'gunner-2', userName: 'Gunner B', position: 'gunner' },
          ],
          capabilities: [],
          status: 'assigned',
        },
      ],
    });
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.leaveShipCrew('activity-1', 'captain-user');

    expect(result.shipAssignments![0].crewAssigned).toBe(2);
    expect(result.shipAssignments![0].crewMembers.map(c => c.userId)).not.toContain('captain-user');
  });

  // ── Pilot via legacy ships[] array ───────────────────────────────────────

  it('allows a pilot to leave from the legacy ships[] array', async () => {
    const activity = makeActivity({
      ships: [
        {
          id: 'ship-legacy',
          shipType: 'Arrow',
          ownerId: 'pilot-user',
          ownerName: 'The Pilot',
          role: 'combat',
          crewCapacity: 1,
          crewAssigned: 1,
          crew: [{ userId: 'pilot-user', userName: 'The Pilot', position: 'pilot' }],
          crewMembers: [{ userId: 'pilot-user', userName: 'The Pilot', position: 'pilot' }],
          capabilities: [],
          status: 'assigned',
        },
      ] as never,
      shipAssignments: [],
    });
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.leaveShipCrew('activity-1', 'pilot-user');

    // Ships returned by the legacy path
    const ships = (result.ships ?? []) as Array<{ crewAssigned: number; crewMembers: unknown[] }>;
    expect(ships[0].crewAssigned).toBe(0);
    expect(ships[0].crewMembers).toHaveLength(0);
  });

  // ── participant row is cleared ────────────────────────────────────────────

  it('clears the participant ship info after leaving', async () => {
    const activity = makeActivity({
      shipAssignments: [
        {
          id: 'ship-1',
          shipType: 'Terrapin',
          ownerId: 'pilot-user',
          ownerName: 'The Pilot',
          role: 'scout',
          crewCapacity: 2,
          crewAssigned: 1,
          crewMembers: [{ userId: 'pilot-user', userName: 'The Pilot', position: 'pilot' }],
          capabilities: [],
          status: 'assigned',
        },
      ],
    });
    mockRepository.findOne.mockResolvedValue(activity);

    await activityService.leaveShipCrew('activity-1', 'pilot-user');

    expect(mockParticipantService.updateParticipant).toHaveBeenCalledWith(
      'activity-1',
      'pilot-user',
      expect.objectContaining({ crewPosition: null, crewShipId: null })
    );
  });

  // ── decrements totalCrewAssigned ──────────────────────────────────────────

  it('decrements totalCrewAssigned after pilot leaves', async () => {
    const activity = makeActivity({
      totalCrewAssigned: 3,
      shipAssignments: [
        {
          id: 'ship-1',
          shipType: 'Hammerhead',
          ownerId: 'pilot-user',
          ownerName: 'The Pilot',
          role: 'combat',
          crewCapacity: 9,
          crewAssigned: 3,
          crewMembers: [
            { userId: 'pilot-user', userName: 'The Pilot', position: 'pilot' },
            { userId: 'g1', userName: 'G1', position: 'gunner' },
            { userId: 'g2', userName: 'G2', position: 'gunner' },
          ],
          capabilities: [],
          status: 'assigned',
        },
      ],
    });
    mockRepository.findOne.mockResolvedValue(activity);

    const result = await activityService.leaveShipCrew('activity-1', 'pilot-user');

    expect(result.totalCrewAssigned).toBe(2);
  });

  // ── error paths ────────────────────────────────────────────────────────────

  it('throws if activity not found', async () => {
    mockRepository.findOne.mockResolvedValue(null);

    await expect(activityService.leaveShipCrew('nonexistent', 'pilot-user')).rejects.toThrow();
  });

  it('throws if user is not crew on any ship', async () => {
    const activity = makeActivity({
      shipAssignments: [
        {
          id: 'ship-1',
          shipType: 'Cutlass Black',
          ownerId: 'owner-1',
          ownerName: 'Owner',
          role: 'combat',
          crewCapacity: 3,
          crewAssigned: 1,
          crewMembers: [{ userId: 'owner-1', userName: 'Owner', position: 'pilot' }],
          capabilities: [],
          status: 'assigned',
        },
      ],
    });
    mockRepository.findOne.mockResolvedValue(activity);

    await expect(activityService.leaveShipCrew('activity-1', 'nobody')).rejects.toThrow(
      'User is not crew on any ship in this activity'
    );
  });
});
