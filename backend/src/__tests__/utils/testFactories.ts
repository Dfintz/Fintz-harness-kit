/**
 * Test Factories
 *
 * Centralized factories for creating test data/mocks.
 * Reduces duplication across test files while maintaining readability.
 *
 * Usage:
 *   const user = createMockUser({ username: 'custom' });
 *   const org = createMockOrganization({ name: 'Test Org' });
 */

import type { Activity } from '../../models/Activity';
import type { Organization } from '../../models/Organization';
import type { Ship } from '../../models/Ship';
import type { User } from '../../models/User';
import type { PaginationOptions } from '../../utils/pagination';

/**
 * Create a mock user for testing
 */
export function createMockUser<T extends Partial<User>>(overrides: T = {} as T): User & T {
  return {
    id: 'test-user-id',
    username: 'testuser',
    email: 'test@example.com',
    discordId: 'test-discord-id',
    role: 'user',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isActive: true,
    profileViews: 0,
    loginCount: 0,
    failedLoginAttempts: 0,
    failedTwoFactorAttempts: 0,
    twoFactorEnabled: false,
    ...overrides,
  } as User & T;
}

/**
 * Create a mock organization for testing
 */
export function createMockOrganization<T extends Partial<Organization>>(
  overrides: T = {} as T
): Organization & T {
  return {
    id: 'test-org-id',
    name: 'Test Organization',
    tag: 'TEST',
    description: 'A test organization',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isActive: true,
    memberCount: 10,
    ...overrides,
  } as Organization & T;
}

/**
 * Create a mock activity for testing
 */
export function createMockActivity<T extends Partial<Activity>>(
  overrides: T = {} as T
): Activity & T {
  return {
    id: 'test-activity-id',
    title: 'Test Activity',
    description: 'A test activity',
    activityType: 'OPERATION',
    status: 'PLANNED',
    startTime: new Date('2024-12-01T10:00:00Z'),
    endTime: new Date('2024-12-01T12:00:00Z'),
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    creatorId: 'test-user-id',
    organizationId: 'test-org-id',
    ...overrides,
  } as Activity & T;
}

/**
 * Create a mock ship for testing
 */
export function createMockShip<T extends Partial<Ship>>(overrides: T = {} as T): Ship & T {
  return {
    id: 'test-ship-id',
    shipId: 'AEGS_AVENGER',
    shipName: 'Avenger Titan',
    manufacturer: 'Aegis Dynamics',
    focus: 'Multi-role',
    size: 'Small',
    crewMin: 1,
    crewMax: 1,
    status: 'OWNED',
    condition: 'EXCELLENT',
    isAvailable: true,
    isCapital: false,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  } as Ship & T;
}

/**
 * Create a mock authenticated request for testing
 */
export function createMockAuthRequest<T extends Partial<User>>(userOverrides: T = {} as T) {
  const user = createMockUser(userOverrides);
  return {
    user,
    body: {},
    params: {},
    query: {},
    headers: {},
    get: jest.fn(),
  };
}

/**
 * Create mock pagination parameters
 */
export function createMockPagination<T extends Partial<PaginationOptions>>(
  overrides: T = {} as T
): PaginationOptions & T {
  return {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'DESC' as const,
    ...overrides,
  } as PaginationOptions & T;
}

/**
 * Create a mock response object for controller testing
 */
export function createMockResponse() {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
  };
  return res;
}

/**
 * Assert that an object has valid timestamp fields
 */
export function expectValidTimestamps(obj: any) {
  expect(obj.createdAt).toBeDefined();
  expect(obj.updatedAt).toBeDefined();
  if (obj.createdAt instanceof Date) {
    expect(obj.createdAt.getTime()).not.toBeNaN();
  }
  if (obj.updatedAt instanceof Date) {
    expect(obj.updatedAt.getTime()).not.toBeNaN();
  }
}

/**
 * Assert that a pagination result is valid
 */
export function expectValidPagination(result: any, expectedPage = 1, expectedLimit = 20) {
  expect(result.pagination).toBeDefined();
  expect(result.pagination.page).toBe(expectedPage);
  expect(result.pagination.limit).toBe(expectedLimit);
  expect(result.pagination.total).toBeGreaterThanOrEqual(0);
  expect(result.pagination.totalPages).toBeGreaterThanOrEqual(0);
}
