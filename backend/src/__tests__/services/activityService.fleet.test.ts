/**
 * ActivityService fleet-operation tests.
 * Covers a fleet leader bringing fleet ships into an event and inviting fleet
 * members (status INVITED), including authorization and membership guardrails.
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
import { ActivityService } from '../../services/activity/ActivityService';

describe('ActivityService fleet operations', () => {
  // Capture the genuine in-memory getRepository once so per-test overrides can
  // delegate to it (and be restored) without recursing into themselves.
  const realGetRepository = mockAppDataSource.getRepository.bind(mockAppDataSource);
  const realTransaction = mockAppDataSource.transaction.bind(mockAppDataSource);

  let activityService: ActivityService;
  let mockRepository: { findOne: jest.Mock; save: jest.Mock };
  let mockParticipantService: { inviteMembers: jest.Mock };
  let mockRouteCalcService: { enrichShipMetadata: jest.Mock; calculateRoute: jest.Mock };
  let fleetRepo: { findOne: jest.Mock };
  let shipRepo: { findBy: jest.Mock };
  let userRepo: { findBy: jest.Mock };
  let fleetShipRepo: { find: jest.Mock };

  const buildActivity = (): Partial<Activity> => ({
    id: 'activity-1',
    title: 'Fleet Op',
    activityType: ActivityType.MISSION,
    status: ActivityStatus.OPEN,
    visibility: ActivityVisibility.PUBLIC,
    organizationId: 'org-1',
    creatorId: 'creator-1',
    creatorName: 'Creator',
    shipAssignments: [],
    totalCrewCapacity: 0,
    totalCrewAssigned: 0,
  });

  const fleet = {
    id: 'fleet-1',
    organizationId: 'org-1',
    leaderId: 'leader-1',
    secondInCommandId: '2ic-1',
    members: ['leader-1', 'm1', 'm2'],
    shipIds: ['s1', 's2'],
  };

  beforeEach(() => {
    activityService = new ActivityService();

    mockRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (entity: unknown) => entity),
    };
    mockParticipantService = {
      inviteMembers: jest
        .fn()
        .mockImplementation(async (_activityId: string, members: Array<{ userId: string }>) => ({
          invited: members.map(m => m.userId),
          skipped: [],
        })),
    };
    mockRouteCalcService = {
      enrichShipMetadata: jest.fn().mockResolvedValue(undefined),
      calculateRoute: jest.fn().mockResolvedValue({
        totalCargoCapacity: 0,
        totalQuantumFuel: 0,
        totalQuantumFuelRequired: 0,
        maxJumpRange: 0,
        hasRefuelShip: false,
      }),
    };
    fleetRepo = { findOne: jest.fn().mockResolvedValue(fleet) };
    // Canonical fleet→ship membership lives in the FleetShip join table; default
    // to empty so existing tests exercise the legacy `shipIds` fallback.
    fleetShipRepo = { find: jest.fn().mockResolvedValue([]) };
    shipRepo = {
      findBy: jest.fn().mockResolvedValue([
        { id: 's1', name: 'Cutlass Black', maxCrew: 3 },
        { id: 's2', name: 'Gladius', maxCrew: 1 },
      ]),
    };
    userRepo = {
      findBy: jest.fn().mockResolvedValue([
        { id: 'leader-1', username: 'Leader' },
        { id: 'm1', username: 'Mike' },
        { id: 'm2', username: 'Mary' },
      ]),
    };

    mockAppDataSource.getRepository = jest.fn((entity: { name?: string }) => {
      switch (entity?.name) {
        case 'Fleet':
          return fleetRepo;
        case 'FleetShip':
          return fleetShipRepo;
        case 'Ship':
          return shipRepo;
        case 'User':
          return userRepo;
        default:
          // Delegate to the real in-memory mock so unrelated repos (e.g. the
          // activity repo used by TenantService) keep their metadata.
          return realGetRepository(entity);
      }
    });

    mockAppDataSource.transaction = jest
      .fn()
      .mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: jest.fn((entity: { name?: string }) => {
            switch (entity?.name) {
              case 'Activity':
                return mockRepository;
              case 'Fleet':
                return fleetRepo;
              case 'FleetShip':
                return fleetShipRepo;
              case 'Ship':
                return shipRepo;
              case 'User':
                return userRepo;
              default:
                return realGetRepository(entity);
            }
          }),
        };

        return cb(manager);
      });

    (activityService as unknown as { repository: typeof mockRepository }).repository =
      mockRepository;
    (
      activityService as unknown as { _participantService: typeof mockParticipantService }
    )._participantService = mockParticipantService;
    (
      activityService as unknown as { _routeCalcService: typeof mockRouteCalcService }
    )._routeCalcService = mockRouteCalcService;
  });

  afterEach(() => {
    // Restore so the per-test override never leaks into other suites.
    mockAppDataSource.getRepository = realGetRepository as typeof mockAppDataSource.getRepository;
    mockAppDataSource.transaction = realTransaction as typeof mockAppDataSource.transaction;
  });

  describe('bringFleetToActivity', () => {
    it('lets the fleet leader bring all fleet ships as loaners with crew slots', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.bringFleetToActivity(
        'activity-1',
        'leader-1',
        'fleet-1'
      );

      expect(result.shipAssignments).toHaveLength(2);
      const cutlass = result.shipAssignments?.find(s => s.shipId === 's1');
      expect(cutlass).toMatchObject({
        isLoaner: true,
        contributedByUserId: 'leader-1',
        contributedBy: 'Leader',
        crewCapacity: 3,
      });
      // Crew slots auto-derived from the 3-crew complement
      expect(cutlass?.crewSlots?.reduce((sum, s) => sum + s.capacity, 0)).toBe(3);
      // totalCrewCapacity accrues both ships (3 + 1)
      expect(result.totalCrewCapacity).toBe(4);
    });

    it('brings only the requested subset of fleet ships', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());
      shipRepo.findBy.mockResolvedValue([{ id: 's2', name: 'Gladius', maxCrew: 1 }]);

      const result = await activityService.bringFleetToActivity('activity-1', '2ic-1', 'fleet-1', [
        's2',
      ]);

      expect(result.shipAssignments).toHaveLength(1);
      expect(result.shipAssignments?.[0].shipId).toBe('s2');
    });

    it('rejects a ship that is not part of the fleet', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.bringFleetToActivity('activity-1', 'leader-1', 'fleet-1', ['s9'])
      ).rejects.toThrow(/do not belong to this fleet/i);
    });

    it('rejects a non-leader / non-creator actor', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.bringFleetToActivity('activity-1', 'outsider', 'fleet-1')
      ).rejects.toThrow(/fleet leader or activity creator/i);
    });

    it('lets the activity creator bring a fleet even if not the fleet leader', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.bringFleetToActivity(
        'activity-1',
        'creator-1',
        'fleet-1'
      );

      expect(result.shipAssignments).toHaveLength(2);
    });

    it('sources ships from the FleetShip join table when shipIds is empty', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());
      // Modern fleets keep ships in the join table, not the denormalized array.
      fleetRepo.findOne.mockResolvedValue({ ...fleet, shipIds: [] });
      fleetShipRepo.find.mockResolvedValue([{ shipId: 's1' }, { shipId: 's2' }]);

      const result = await activityService.bringFleetToActivity(
        'activity-1',
        'leader-1',
        'fleet-1'
      );

      expect(result.shipAssignments).toHaveLength(2);
      expect(result.shipAssignments?.map(s => s.shipId).sort((a, b) => a.localeCompare(b))).toEqual(
        ['s1', 's2']
      );
    });

    it('rejects bring-fleet for org-less events', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...buildActivity(),
        organizationId: null,
      });

      await expect(
        activityService.bringFleetToActivity('activity-1', 'leader-1', 'fleet-1')
      ).rejects.toThrow(/organization-bound activity/i);
    });

    it('is idempotent per ship and skips ships already in the activity', async () => {
      const seeded = {
        ...buildActivity(),
        shipAssignments: [
          {
            shipId: 's1',
            shipType: 'Cutlass Black',
            shipName: 'Cutlass Black',
            ownerId: 'existing-owner',
            ownerName: 'Existing Owner',
            role: 'support' as const,
            crewCapacity: 3,
            crewAssigned: 1,
            crewMembers: [
              { userId: 'existing-owner', userName: 'Existing Owner', position: 'pilot' },
            ],
            crewSlots: [
              { role: 'pilot', capacity: 1 },
              { role: 'gunner', capacity: 2 },
            ],
            capabilities: [],
            status: 'available' as const,
          },
        ],
        totalCrewCapacity: 3,
      };

      mockRepository.findOne.mockResolvedValue(seeded);

      const first = await activityService.bringFleetToActivity('activity-1', 'leader-1', 'fleet-1');

      expect(first.shipAssignments).toHaveLength(2);
      expect(first.shipAssignments?.map(s => s.shipId).sort((a, b) => a.localeCompare(b))).toEqual([
        's1',
        's2',
      ]);
      expect(first.totalCrewCapacity).toBe(4);

      mockRepository.findOne.mockResolvedValue(first);

      const second = await activityService.bringFleetToActivity(
        'activity-1',
        'leader-1',
        'fleet-1'
      );

      expect(second.shipAssignments).toHaveLength(2);
      expect(second.shipAssignments?.map(s => s.shipId).sort((a, b) => a.localeCompare(b))).toEqual(
        ['s1', 's2']
      );
      expect(second.totalCrewCapacity).toBe(4);
    });

    it('serializes concurrent bring calls and keeps ship assignments unique', async () => {
      const clone = <T>(value: T): T => structuredClone(value);

      let persistedActivity = {
        ...buildActivity(),
        shipAssignments: [],
        totalCrewCapacity: 0,
      };

      const activityFindOneCalls: Array<Record<string, unknown>> = [];

      let txQueue = Promise.resolve();
      mockAppDataSource.transaction = jest
        .fn()
        .mockImplementation(async (cb: (manager: unknown) => Promise<unknown>) => {
          const previous = txQueue;
          let release!: () => void;
          txQueue = new Promise<void>(resolve => {
            release = resolve;
          });

          await previous;

          const activityTxRepo = {
            findOne: jest.fn().mockImplementation(async (args: Record<string, unknown>) => {
              activityFindOneCalls.push(args);
              return clone(persistedActivity);
            }),
            save: jest.fn().mockImplementation(async (entity: unknown) => {
              persistedActivity = clone(entity as typeof persistedActivity);
              return clone(persistedActivity);
            }),
          };

          const manager = {
            getRepository: jest.fn((entity: { name?: string }) => {
              switch (entity?.name) {
                case 'Activity':
                  return activityTxRepo;
                case 'Fleet':
                  return fleetRepo;
                case 'Ship':
                  return shipRepo;
                case 'User':
                  return userRepo;
                default:
                  return realGetRepository(entity);
              }
            }),
          };

          try {
            return await cb(manager);
          } finally {
            release();
          }
        });

      const [first, second] = await Promise.all([
        activityService.bringFleetToActivity('activity-1', 'leader-1', 'fleet-1'),
        activityService.bringFleetToActivity('activity-1', 'leader-1', 'fleet-1'),
      ]);

      const persistedShipIds = persistedActivity.shipAssignments?.map(ship => ship.shipId) ?? [];
      expect(new Set(persistedShipIds).size).toBe(persistedShipIds.length);
      const uniqueSortedShipIds = [...new Set(persistedShipIds)].sort((a, b) => a.localeCompare(b));
      expect(uniqueSortedShipIds).toEqual(['s1', 's2']);
      expect(persistedActivity.totalCrewCapacity).toBe(4);

      expect(
        first.shipAssignments?.map(ship => ship.shipId).sort((a, b) => a.localeCompare(b))
      ).toEqual(['s1', 's2']);
      expect(
        second.shipAssignments?.map(ship => ship.shipId).sort((a, b) => a.localeCompare(b))
      ).toEqual(['s1', 's2']);
      expect(mockAppDataSource.transaction).toHaveBeenCalledTimes(2);

      for (const call of activityFindOneCalls) {
        expect(call).toEqual(
          expect.objectContaining({
            lock: expect.objectContaining({ mode: 'pessimistic_write' }),
          })
        );
      }
    });
  });

  describe('inviteFleetMembers', () => {
    it('invites all fleet members except the actor with resolved names', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.inviteFleetMembers('activity-1', 'leader-1', 'fleet-1');

      expect(result.invited).toEqual(['m1', 'm2']);
      expect(mockParticipantService.inviteMembers).toHaveBeenCalledWith(
        'activity-1',
        expect.arrayContaining([
          expect.objectContaining({ userId: 'm1', userName: 'Mike' }),
          expect.objectContaining({ userId: 'm2', userName: 'Mary' }),
        ])
      );
    });

    it('invites only the requested subset', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.inviteFleetMembers('activity-1', 'leader-1', 'fleet-1', [
        'm1',
      ]);

      expect(result.invited).toEqual(['m1']);
    });

    it('rejects a user that is not a fleet member', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.inviteFleetMembers('activity-1', 'leader-1', 'fleet-1', ['stranger'])
      ).rejects.toThrow(/not members of this fleet/i);
    });

    it('rejects a non-leader / non-creator actor', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.inviteFleetMembers('activity-1', 'outsider', 'fleet-1')
      ).rejects.toThrow(/fleet leader or activity creator/i);
    });

    it('rejects invite-fleet for org-less events', async () => {
      mockRepository.findOne.mockResolvedValue({
        ...buildActivity(),
        organizationId: null,
      });

      await expect(
        activityService.inviteFleetMembers('activity-1', 'leader-1', 'fleet-1')
      ).rejects.toThrow(/organization-bound activity/i);
    });
  });

  describe('bringFleetAndInviteMembers', () => {
    it('returns full status when ships and invites succeed', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.bringFleetAndInviteMembers(
        'activity-1',
        'leader-1',
        'fleet-1'
      );

      expect(result.status).toBe('full');
      expect(result.invited).toEqual(['m1', 'm2']);
      expect(result.skipped).toEqual([]);
      expect(result.activity.shipAssignments).toHaveLength(2);
    });

    it('returns ships_only status when invite step fails after ships are added', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());
      mockParticipantService.inviteMembers.mockRejectedValueOnce(new Error('invite failed'));

      const result = await activityService.bringFleetAndInviteMembers(
        'activity-1',
        'leader-1',
        'fleet-1'
      );

      expect(result.status).toBe('ships_only');
      expect(result.invited).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.inviteError).toMatch(/invite failed/i);
      expect(result.activity.shipAssignments).toHaveLength(2);
    });
  });

  describe('getFleetBringPlan', () => {
    it('attributes each ship to the member who added it and flags orphans', async () => {
      // m1 added s1; an ex-member ('ghost', not in fleet.members) added s2 → orphan.
      fleetShipRepo.find.mockResolvedValue([
        { shipId: 's1', assignedBy: 'm1' },
        { shipId: 's2', assignedBy: 'ghost' },
      ]);

      const plan = await activityService.getFleetBringPlan('fleet-1');

      expect(plan.memberShips.get('m1')).toEqual([
        { shipId: 's1', shipName: 'Cutlass Black', maxCrew: 3 },
      ]);
      expect(plan.memberShips.has('ghost')).toBe(false);
      expect(plan.orphanShipIds).toEqual(['s2']);
    });

    it('treats ships with no assigner as orphans', async () => {
      fleetShipRepo.find.mockResolvedValue([{ shipId: 's1', assignedBy: undefined }]);

      const plan = await activityService.getFleetBringPlan('fleet-1');

      expect(plan.memberShips.size).toBe(0);
      expect(plan.orphanShipIds).toEqual(['s1']);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
