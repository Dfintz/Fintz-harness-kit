/**
 * ActivityService crew-slot tests.
 * Covers the auto-derive heuristic, editing typed crew slots, per-role join
 * enforcement, and slot availability.
 */

import { deriveDefaultCrewSlots } from '@sc-fleet-manager/shared-types';

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
import { ActivityService } from '../../services/activity/ActivityService';

describe('deriveDefaultCrewSlots (pilot + balanced mix)', () => {
  it('returns a single pilot for a 1-crew ship', () => {
    expect(deriveDefaultCrewSlots(1)).toEqual([{ role: 'pilot', capacity: 1 }]);
  });

  it('adds a co-pilot for a 2-crew ship', () => {
    expect(deriveDefaultCrewSlots(2)).toEqual([
      { role: 'pilot', capacity: 1 },
      { role: 'copilot', capacity: 1 },
    ]);
  });

  it('splits remaining seats across gunner/engineer (gunner takes the odd one)', () => {
    expect(deriveDefaultCrewSlots(5)).toEqual([
      { role: 'pilot', capacity: 1 },
      { role: 'copilot', capacity: 1 },
      { role: 'gunner', capacity: 2 },
      { role: 'engineer', capacity: 1 },
    ]);
  });

  it('always sums to the crew complement', () => {
    for (const n of [1, 2, 3, 4, 6, 8, 10]) {
      const total = deriveDefaultCrewSlots(n).reduce((s, slot) => s + slot.capacity, 0);
      expect(total).toBe(n);
    }
  });
});

describe('ActivityService crew slots', () => {
  let activityService: ActivityService;
  let mockRepository: { findOne: jest.Mock; save: jest.Mock };
  let mockParticipantService: { isLeader: jest.Mock; getParticipant: jest.Mock };

  const buildActivity = (): Partial<Activity> => ({
    id: 'activity-1',
    title: 'Op',
    activityType: ActivityType.MISSION,
    status: ActivityStatus.OPEN,
    visibility: ActivityVisibility.PUBLIC,
    organizationId: 'org-1',
    creatorId: 'creator-1',
    creatorName: 'Creator',
    shipAssignments: [
      {
        id: 'ship-a',
        shipId: 'ship-a',
        shipType: 'Constellation Andromeda',
        shipName: 'Andromeda',
        ownerId: 'owner-a',
        ownerName: 'Owner A',
        role: 'combat',
        crewCapacity: 4,
        crewAssigned: 1,
        crewMembers: [{ userId: 'owner-a', userName: 'Owner A', position: 'pilot' }],
        crewSlots: [
          { role: 'pilot', capacity: 1 },
          { role: 'copilot', capacity: 1 },
          { role: 'gunner', capacity: 2 },
        ],
        capabilities: [],
        status: 'assigned',
      },
    ],
    totalCrewAssigned: 1,
    totalCrewCapacity: 4,
  });

  beforeEach(() => {
    activityService = new ActivityService();
    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entity: unknown) => entity),
    };
    mockParticipantService = {
      isLeader: jest.fn().mockResolvedValue(false),
      getParticipant: jest.fn().mockResolvedValue({ userId: 'u', userName: 'U' }),
      updateParticipant: jest.fn().mockResolvedValue(undefined),
    };
    (activityService as unknown as { repository: typeof mockRepository }).repository =
      mockRepository;
    (
      activityService as unknown as { _participantService: typeof mockParticipantService }
    )._participantService = mockParticipantService;
    jest.clearAllMocks();
  });

  describe('setCrewSlots', () => {
    it('lets the owner reshape slots and recomputes capacity', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.setCrewSlots('activity-1', 'owner-a', 'ship-a', [
        { role: 'pilot', capacity: 1 },
        { role: 'gunner', capacity: 4 },
        { role: 'engineer', capacity: 1 },
      ]);

      const ship = result.shipAssignments?.[0];
      expect(ship?.crewSlots).toHaveLength(3);
      expect(ship?.crewCapacity).toBe(6);
      // totalCrewCapacity adjusted by delta (was 4, ship grew 4 -> 6)
      expect(result.totalCrewCapacity).toBe(6);
    });

    it('rejects a non-owner / non-creator / non-leader actor', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.setCrewSlots('activity-1', 'outsider', 'ship-a', [
          { role: 'pilot', capacity: 1 },
        ])
      ).rejects.toThrow(/owner, activity creator, or a leader/i);
    });

    it('rejects reducing a role below its filled count', async () => {
      // pilot slot is filled by the owner
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.setCrewSlots('activity-1', 'creator-1', 'ship-a', [
          { role: 'pilot', capacity: 0 },
        ])
      ).rejects.toThrow(/already assigned/i);
    });

    it('rejects dropping a role that still has crew', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      // Omitting 'pilot' while the owner occupies it must fail
      await expect(
        activityService.setCrewSlots('activity-1', 'creator-1', 'ship-a', [
          { role: 'gunner', capacity: 4 },
        ])
      ).rejects.toThrow(/still assigned/i);
    });
  });

  describe('joinShipAsCrew per-role enforcement', () => {
    it('rejects joining a role whose slots are full', async () => {
      const activity = buildActivity();
      // copilot capacity 1, already taken
      activity.shipAssignments![0].crewMembers.push({
        userId: 'co-1',
        userName: 'Co One',
        position: 'copilot',
      });
      mockRepository.findOne.mockResolvedValue(activity);

      await expect(
        activityService.joinShipAsCrew('activity-1', 'new-1', 'New', 'ship-a', 'copilot')
      ).rejects.toThrow(/copilot slots are full/i);
    });

    it('rejects a role that has no slot on the ship', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.joinShipAsCrew('activity-1', 'new-1', 'New', 'ship-a', 'medical')
      ).rejects.toThrow(/no medical slot/i);
    });

    it('allows joining an open role slot', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.joinShipAsCrew(
        'activity-1',
        'gun-1',
        'Gunner One',
        'ship-a',
        'gunner'
      );

      const ship = result.shipAssignments?.[0];
      expect(ship?.crewMembers.some(m => m.userId === 'gun-1' && m.position === 'gunner')).toBe(
        true
      );
    });
  });

  describe('getCrewSlotAvailability', () => {
    it('reports filled/available per role', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const ships = await activityService.getCrewSlotAvailability('activity-1');

      expect(ships).toHaveLength(1);
      const slots = ships[0].slots;
      expect(slots.find(s => s.role === 'pilot')).toMatchObject({
        capacity: 1,
        filled: 1,
        available: 0,
      });
      expect(slots.find(s => s.role === 'gunner')).toMatchObject({
        capacity: 2,
        filled: 0,
        available: 2,
      });
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
