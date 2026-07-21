/**
 * Entity Factory Utilities
 *
 * Factory functions for creating test entities with sensible defaults.
 * Uses the Builder pattern for flexible test data generation.
 */

import type { Ship, User } from '@sc-fleet-manager/shared-types';

// Counter for generating unique IDs
let idCounter = 0;

/**
 * Generates a unique test ID
 */
export function generateId(prefix = 'test'): string {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

/**
 * Generates a UUID-like string for testing
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.trunc(Math.random() * 16);
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Creates a factory function with default values
 */
export function createFactory<T>(defaults: T): (overrides?: Partial<T>) => T {
  return (overrides: Partial<T> = {}): T => ({
    ...defaults,
    ...overrides,
  });
}

/**
 * Creates multiple items using a factory
 */
export function createMany<T>(
  factory: (overrides?: Partial<T>) => T,
  count: number,
  customizer?: (index: number) => Partial<T>
): T[] {
  return Array.from({ length: count }, (_, index) =>
    factory(customizer ? customizer(index) : undefined)
  );
}

/**
 * User factory
 */
export const createUser = createFactory<User>({
  id: '',
  username: 'testuser',
  email: 'test@example.com',
  displayName: 'Test User',
  rsiVerified: false,
  twoFactorEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Fleet factory
 */
export const createFleet = createFactory({
  id: '',
  name: 'Test Fleet',
  description: 'A test fleet',
  organizationId: '',
  ownerId: '',
  isPublic: false,
  maxShips: 100,
  shipCount: 0,
  totalValue: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Ship factory
 */
export const createShip = createFactory<Ship>({
  id: '',
  manufacturer: 'RSI',
  model: 'Aurora',
  name: 'Aurora MR',
  role: 'Multi-role',
  size: 'small',
  ownerId: '',
  status: 'ACTIVE',
  value: 25000,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Legacy ship fixture factory for tests that still rely on non-shared ship fields.
 */
export const createLegacyShip = createFactory({
  id: '',
  name: 'Aurora MR',
  manufacturer: 'RSI',
  model: 'Aurora',
  variant: 'MR',
  size: 'small',
  role: 'starter',
  status: 'active',
  fleetId: null,
  ownerId: '',
  value: 25000,
  crew: 1,
  cargo: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Organization factory
 */
export const createOrganization = createFactory({
  id: '',
  name: 'Test Org',
  sid: 'TESTORG',
  description: 'A test organization',
  logo: null,
  memberCount: 1,
  fleetCount: 0,
  isRecruiting: true,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

/**
 * Activity factory
 */
export const createActivity = createFactory({
  id: '',
  name: 'Test Activity',
  description: 'A test activity',
  type: 'mission',
  status: 'scheduled',
  startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  endTime: null,
  organizationId: '',
  createdById: '',
  participantCount: 0,
  maxParticipants: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export { generateId as createId };
