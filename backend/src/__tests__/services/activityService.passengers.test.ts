/**
 * ActivityService passenger-slot tests.
 * Covers configuring passenger slots and join/leave for non-crew passengers
 * (e.g. marines), including authorization and capacity guardrails.
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
import { domainEvents } from '../../services/shared/DomainEventBus';
import { emitToOrganization } from '../../websocket/websocketServer';

describe('ActivityService passenger slots', () => {
  let activityService: ActivityService;
  let mockRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let mockParticipantService: {
    isLeader: jest.Mock;
    isParticipant: jest.Mock;
  };

  const buildActivity = (): Partial<Activity> => ({
    id: 'activity-1',
    title: 'Drop Op',
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
        shipType: 'Anvil Valkyrie',
        shipName: 'Valk',
        ownerId: 'owner-a',
        ownerName: 'Owner A',
        role: 'support',
        crewCapacity: 4,
        crewAssigned: 1,
        crewMembers: [{ userId: 'owner-a', userName: 'Owner A', position: 'pilot' }],
        capabilities: [],
        status: 'assigned',
        passengers: [
          { role: 'marine', capacity: 2, filled: 0, assignedUserIds: [], assignedUserNames: [] },
        ],
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
      // Passenger slot operations are participant-only unless actor is creator.
      isParticipant: jest.fn().mockResolvedValue(true),
    };

    (activityService as unknown as { repository: typeof mockRepository }).repository =
      mockRepository;
    (
      activityService as unknown as { _participantService: typeof mockParticipantService }
    )._participantService = mockParticipantService;

    jest.clearAllMocks();
  });

  describe('setPassengerSlots', () => {
    it('lets the ship owner define passenger slots', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.setPassengerSlots('activity-1', 'owner-a', 'ship-a', [
        { role: 'marine', capacity: 4 },
        { role: 'medic', capacity: 1 },
      ]);

      const slots = result.shipAssignments?.[0].passengers ?? [];
      expect(slots).toHaveLength(2);
      expect(slots.find(s => s.role === 'marine')?.capacity).toBe(4);
      expect(slots.find(s => s.role === 'medic')?.capacity).toBe(1);
    });

    it('lets the activity creator define passenger slots', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      const result = await activityService.setPassengerSlots('activity-1', 'creator-1', 'ship-a', [
        { role: 'guest', capacity: 3 },
      ]);

      expect(result.shipAssignments?.[0].passengers?.[0].role).toBe('guest');
    });

    it('rejects a non-owner / non-creator / non-leader actor', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());
      mockParticipantService.isLeader.mockResolvedValue(false);

      await expect(
        activityService.setPassengerSlots('activity-1', 'outsider', 'ship-a', [
          { role: 'marine', capacity: 1 },
        ])
      ).rejects.toThrow(/owner, activity creator, or a leader/i);
    });

    it('preserves already-filled assignments when editing', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 2,
          filled: 1,
          assignedUserIds: ['u1'],
          assignedUserNames: ['One'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      const result = await activityService.setPassengerSlots('activity-1', 'owner-a', 'ship-a', [
        { role: 'marine', capacity: 5 },
      ]);

      const slot = result.shipAssignments?.[0].passengers?.[0];
      expect(slot?.capacity).toBe(5);
      expect(slot?.filled).toBe(1);
      expect(slot?.assignedUserIds).toEqual(['u1']);
    });

    it('rejects reducing capacity below the filled count', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 2,
          filled: 2,
          assignedUserIds: ['u1', 'u2'],
          assignedUserNames: ['One', 'Two'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      await expect(
        activityService.setPassengerSlots('activity-1', 'owner-a', 'ship-a', [
          { role: 'marine', capacity: 1 },
        ])
      ).rejects.toThrow(/already assigned/i);
    });

    it('rejects dropping a role that still has passengers', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 2,
          filled: 1,
          assignedUserIds: ['u1'],
          assignedUserNames: ['One'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      await expect(
        activityService.setPassengerSlots('activity-1', 'owner-a', 'ship-a', [
          { role: 'guest', capacity: 2 },
        ])
      ).rejects.toThrow(/still assigned/i);
    });
  });

  describe('joinShipAsPassenger', () => {
    it('fills an open passenger slot without touching crew totals', async () => {
      const activity = buildActivity();
      mockRepository.findOne.mockResolvedValue(activity);

      const result = await activityService.joinShipAsPassenger(
        'activity-1',
        'rider-1',
        'Rider One',
        'ship-a',
        'marine'
      );

      const slot = result.shipAssignments?.[0].passengers?.[0];
      expect(slot?.filled).toBe(1);
      expect(slot?.assignedUserIds).toContain('rider-1');
      expect(slot?.assignedUserNames).toContain('Rider One');
      // Passengers must not be counted toward crew totals
      expect(result.totalCrewAssigned).toBe(1);
    });

    it('rejects joining a full slot', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 1,
          filled: 1,
          assignedUserIds: ['x'],
          assignedUserNames: ['X'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      await expect(
        activityService.joinShipAsPassenger('activity-1', 'rider-1', 'Rider', 'ship-a', 'marine')
      ).rejects.toThrow(/full/i);
    });

    it('rejects an unknown passenger role', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(
        activityService.joinShipAsPassenger('activity-1', 'rider-1', 'Rider', 'ship-a', 'security')
      ).rejects.toThrow();
    });

    it('rejects a duplicate passenger on the same ship', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 3,
          filled: 1,
          assignedUserIds: ['rider-1'],
          assignedUserNames: ['Rider'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      await expect(
        activityService.joinShipAsPassenger('activity-1', 'rider-1', 'Rider', 'ship-a', 'marine')
      ).rejects.toThrow(/already.*passenger/i);
    });

    it('rejects when the user already occupies a passenger seat on another ship', async () => {
      const activity = buildActivity();
      activity.shipAssignments?.push({
        id: 'ship-b',
        shipId: 'ship-b',
        shipType: 'Anvil C8 Pisces',
        shipName: 'Pisces',
        ownerId: 'owner-b',
        ownerName: 'Owner B',
        role: 'support',
        crewCapacity: 2,
        crewAssigned: 1,
        crewMembers: [{ userId: 'owner-b', userName: 'Owner B', position: 'pilot' }],
        capabilities: [],
        status: 'assigned',
        passengers: [
          { role: 'guest', capacity: 2, filled: 0, assignedUserIds: [], assignedUserNames: [] },
        ],
      });
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 2,
          filled: 1,
          assignedUserIds: ['rider-1'],
          assignedUserNames: ['Rider One'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      await expect(
        activityService.joinShipAsPassenger('activity-1', 'rider-1', 'Rider', 'ship-b', 'guest')
      ).rejects.toThrow(/already.*passenger/i);
    });
  });

  describe('leaveShipAsPassenger', () => {
    it('removes the user from their passenger slot', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 3,
          filled: 2,
          assignedUserIds: ['rider-1', 'rider-2'],
          assignedUserNames: ['Rider One', 'Rider Two'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      const result = await activityService.leaveShipAsPassenger('activity-1', 'rider-1');

      const slot = result.shipAssignments?.[0].passengers?.[0];
      expect(slot?.filled).toBe(1);
      expect(slot?.assignedUserIds).toEqual(['rider-2']);
      expect(slot?.assignedUserNames).toEqual(['Rider Two']);
    });

    it('rejects when the user is not a passenger anywhere', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());

      await expect(activityService.leaveShipAsPassenger('activity-1', 'nobody')).rejects.toThrow(
        /not a passenger/i
      );
    });

    it('removes legacy duplicate assignments across multiple ships in one leave call', async () => {
      const activity = buildActivity();
      activity.shipAssignments?.push({
        id: 'ship-b',
        shipId: 'ship-b',
        shipType: 'Drake Cutlass Red',
        shipName: 'Cutlass Red',
        ownerId: 'owner-b',
        ownerName: 'Owner B',
        role: 'support',
        crewCapacity: 2,
        crewAssigned: 1,
        crewMembers: [{ userId: 'owner-b', userName: 'Owner B', position: 'pilot' }],
        capabilities: [],
        status: 'assigned',
        passengers: [
          {
            role: 'medic',
            capacity: 2,
            filled: 1,
            assignedUserIds: ['rider-1'],
            assignedUserNames: ['Rider One'],
          },
        ],
      });
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 3,
          filled: 2,
          assignedUserIds: ['rider-1', 'rider-2'],
          assignedUserNames: ['Rider One', 'Rider Two'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      const result = await activityService.leaveShipAsPassenger('activity-1', 'rider-1');

      const shipA = result.shipAssignments?.find(ship => ship.shipId === 'ship-a');
      const shipB = result.shipAssignments?.find(ship => ship.shipId === 'ship-b');
      expect(shipA?.passengers?.[0].assignedUserIds).toEqual(['rider-2']);
      expect(shipA?.passengers?.[0].filled).toBe(1);
      expect(shipB?.passengers?.[0].assignedUserIds).toEqual([]);
      expect(shipB?.passengers?.[0].filled).toBe(0);
    });
  });

  describe('getAvailablePassengerSlots', () => {
    it('lists ships with open passenger slots', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 3,
          filled: 1,
          assignedUserIds: ['a'],
          assignedUserNames: ['A'],
        },
        { role: 'medic', capacity: 1, filled: 1, assignedUserIds: ['b'], assignedUserNames: ['B'] },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      const slots = await activityService.getAvailablePassengerSlots('activity-1');

      // Only the marine slot has remaining capacity (2)
      expect(slots).toHaveLength(1);
      expect(slots[0]).toMatchObject({ shipId: 'ship-a', role: 'marine', availableSlots: 2 });
    });
  });

  // Regression: crew/passenger/role mutations must tell BOTH surfaces to
  // re-render. Previously they persisted silently, leaving the Discord embed
  // and web app showing a stale roster.
  describe('roster change broadcast (Discord + web sync)', () => {
    it('emits a WebSocket update and a domain event when a passenger joins', async () => {
      mockRepository.findOne.mockResolvedValue(buildActivity());
      const emitSpy = jest.spyOn(domainEvents, 'emit');

      try {
        await activityService.joinShipAsPassenger(
          'activity-1',
          'rider-1',
          'Rider One',
          'ship-a',
          'marine'
        );

        // Web app: realtime WebSocket update so the roster card re-renders.
        expect(emitToOrganization as jest.Mock).toHaveBeenCalledWith(
          'org-1',
          'activity:updated',
          expect.objectContaining({ activityId: 'activity-1' })
        );
        // Discord: domain event so the bot re-renders the origin event embed.
        expect(emitSpy).toHaveBeenCalledWith(
          'activity:updated',
          expect.objectContaining({
            activityId: 'activity-1',
            updatedFields: ['shipAssignments'],
          })
        );
      } finally {
        emitSpy.mockRestore();
      }
    });

    it('emits a WebSocket update when a passenger leaves', async () => {
      const activity = buildActivity();
      activity.shipAssignments![0].passengers = [
        {
          role: 'marine',
          capacity: 3,
          filled: 1,
          assignedUserIds: ['rider-1'],
          assignedUserNames: ['Rider One'],
        },
      ];
      mockRepository.findOne.mockResolvedValue(activity);

      await activityService.leaveShipAsPassenger('activity-1', 'rider-1');

      expect(emitToOrganization as jest.Mock).toHaveBeenCalledWith(
        'org-1',
        'activity:updated',
        expect.objectContaining({ activityId: 'activity-1' })
      );
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
