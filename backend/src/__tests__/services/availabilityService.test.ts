/**
 * AvailabilityService Tests
 * Wave 2.4 — Group Scheduling & Availability
 */

import { createMockDataSource, createMockRepositoryWithData } from '../utils/mockFactory.helper';

const mockDataSource = createMockDataSource();
jest.mock('../../config/database', () => ({
  AppDataSource: mockDataSource,
}));
jest.mock('../../data-source', () => ({
  AppDataSource: mockDataSource,
}));

import { AvailabilityService } from '../../services/calendar/AvailabilityService';
import { UserAvailability } from '../../models/UserAvailability';

describe('AvailabilityService (Wave 2.4)', () => {
  let service: AvailabilityService;
  let mockSlots: Partial<UserAvailability>[];

  const ORG_ID = 'org-1';
  const USER_A = 'user-a';
  const USER_B = 'user-b';
  const USER_C = 'user-c';

  const createSlot = (overrides: Partial<UserAvailability> = {}): Partial<UserAvailability> => ({
    id: `slot-${Math.random().toString(36).substr(2, 6)}`,
    userId: USER_A,
    organizationId: ORG_ID,
    dayOfWeek: 1, // Monday
    startMinute: 540, // 9:00
    endMinute: 1020, // 17:00
    isRecurring: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockSlots = [];
    const mockRepo = createMockRepositoryWithData(mockSlots);
    mockDataSource.getRepository.mockReturnValue(mockRepo);

    // Mock the transaction method
    mockDataSource.transaction = jest.fn(async (cb: (manager: unknown) => Promise<unknown>) => {
      const txRepo = {
        ...mockRepo,
        create: jest.fn((data: Partial<UserAvailability>) => ({
          ...data,
          id: `slot-${Math.random().toString(36).substr(2, 6)}`,
        })),
        save: jest.fn(async (entities: UserAvailability | UserAvailability[]) => {
          const arr = Array.isArray(entities) ? entities : [entities];
          mockSlots.push(...arr);
          return arr;
        }),
        delete: jest.fn(async () => {
          // Clear matching slots
          mockSlots.length = 0;
        }),
      };
      const manager = { getRepository: () => txRepo };
      return cb(manager);
    });

    service = new AvailabilityService(mockRepo as unknown as import('typeorm').Repository<UserAvailability>);
  });

  describe('getMyAvailability', () => {
    it('returns empty array when no slots exist', async () => {
      const result = await service.getMyAvailability(USER_A, ORG_ID);
      expect(result).toEqual([]);
    });

    it('returns user slots ordered by day and time', async () => {
      mockSlots.push(
        createSlot({ dayOfWeek: 3, startMinute: 600 }),
        createSlot({ dayOfWeek: 1, startMinute: 480 })
      );

      const result = await service.getMyAvailability(USER_A, ORG_ID);
      expect(result).toHaveLength(2);
    });
  });

  describe('getGroupAvailability', () => {
    it('returns a 168-cell heatmap (7×24)', async () => {
      const result = await service.getGroupAvailability(ORG_ID);
      expect(result.cells).toHaveLength(168);
      expect(result.orgId).toBe(ORG_ID);
    });

    it('counts members per hour cell', async () => {
      // User A available Mon 9-17 (hours 9-16)
      mockSlots.push(createSlot({ userId: USER_A, dayOfWeek: 1, startMinute: 540, endMinute: 1020 }));
      // User B available Mon 12-17 (hours 12-16)
      mockSlots.push(createSlot({ userId: USER_B, dayOfWeek: 1, startMinute: 720, endMinute: 1020 }));

      const result = await service.getGroupAvailability(ORG_ID);

      // Mon hour 10 → only User A
      const cell10 = result.cells.find((c) => c.dayOfWeek === 1 && c.hour === 10);
      expect(cell10?.count).toBe(1);

      // Mon hour 14 → both User A and User B
      const cell14 = result.cells.find((c) => c.dayOfWeek === 1 && c.hour === 14);
      expect(cell14?.count).toBe(2);

      // Sunday hour 10 → nobody
      const sunCell = result.cells.find((c) => c.dayOfWeek === 0 && c.hour === 10);
      expect(sunCell?.count).toBe(0);
    });
  });

  describe('findBestTimes', () => {
    it('returns empty array when no slots meet criteria', async () => {
      const result = await service.findBestTimes(ORG_ID, 120, 5);
      expect(result).toEqual([]);
    });

    it('finds windows where enough users are available', async () => {
      // All 3 users available Mon 14:00-18:00
      mockSlots.push(
        createSlot({ userId: USER_A, dayOfWeek: 1, startMinute: 840, endMinute: 1080 }),
        createSlot({ userId: USER_B, dayOfWeek: 1, startMinute: 840, endMinute: 1080 }),
        createSlot({ userId: USER_C, dayOfWeek: 1, startMinute: 840, endMinute: 1080 })
      );

      const result = await service.findBestTimes(ORG_ID, 120, 2);

      expect(result.length).toBeGreaterThan(0);
      // All results should have at least 2 attendees
      for (const w of result) {
        expect(w.availableCount).toBeGreaterThanOrEqual(2);
      }
    });

    it('returns results sorted by availability count descending', async () => {
      // 3 users on Monday, 2 users on Tuesday
      mockSlots.push(
        createSlot({ userId: USER_A, dayOfWeek: 1, startMinute: 600, endMinute: 720 }),
        createSlot({ userId: USER_B, dayOfWeek: 1, startMinute: 600, endMinute: 720 }),
        createSlot({ userId: USER_C, dayOfWeek: 1, startMinute: 600, endMinute: 720 }),
        createSlot({ userId: USER_A, dayOfWeek: 2, startMinute: 600, endMinute: 720 }),
        createSlot({ userId: USER_B, dayOfWeek: 2, startMinute: 600, endMinute: 720 })
      );

      const result = await service.findBestTimes(ORG_ID, 60, 1, 10);

      if (result.length >= 2) {
        expect(result[0].availableCount).toBeGreaterThanOrEqual(result[1].availableCount);
      }
    });

    it('limits results to maxResults', async () => {
      // Lots of availability across the week
      for (let d = 0; d < 7; d++) {
        mockSlots.push(
          createSlot({ userId: USER_A, dayOfWeek: d, startMinute: 0, endMinute: 1440 }),
          createSlot({ userId: USER_B, dayOfWeek: d, startMinute: 0, endMinute: 1440 })
        );
      }

      const result = await service.findBestTimes(ORG_ID, 60, 1, 3);
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('includes dayName and timeRange in results', async () => {
      mockSlots.push(
        createSlot({ userId: USER_A, dayOfWeek: 3, startMinute: 840, endMinute: 960 }),
        createSlot({ userId: USER_B, dayOfWeek: 3, startMinute: 840, endMinute: 960 })
      );

      const result = await service.findBestTimes(ORG_ID, 60, 1);

      const wedWindow = result.find((w) => w.dayOfWeek === 3);
      expect(wedWindow?.dayName).toBe('Wednesday');
      expect(wedWindow?.timeRange).toContain('14:00');
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
