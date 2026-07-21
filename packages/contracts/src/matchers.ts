/**
 * Custom Pact matchers for SC Fleet Manager API contracts
 */
import { Matchers } from '@pact-foundation/pact';

const { like, eachLike, regex, timestamp, uuid } = Matchers;
const ISO_8601_WITH_MILLIS = "yyyy-MM-dd'T'HH:mm:ss.SSSX";

const isoTimestamp = () => timestamp(ISO_8601_WITH_MILLIS, '2024-01-01T00:00:00.000Z');

/**
 * Matcher for Fleet entity
 */
export const fleetMatcher = {
  id: uuid(),
  name: like('Alpha Squadron'),
  description: like('Primary combat fleet'),
  organizationId: uuid(),
  maxCapacity: like(50),
  shipCount: like(12),
  totalValue: like(1250000),
  createdAt: isoTimestamp(),
  updatedAt: isoTimestamp(),
};

/**
 * Matcher for Ship entity
 */
export const shipMatcher = {
  id: uuid(),
  name: like('Aurora MR'),
  manufacturer: like('Roberts Space Industries'),
  model: like('Aurora'),
  role: regex('combat|exploration|trading|mining|support|transport', 'combat'),
  status: regex('active|maintenance|destroyed|retired', 'active'),
  value: like(25000),
  crewSize: like(1),
  fleetId: uuid(),
  ownerId: uuid(),
  createdAt: isoTimestamp(),
  updatedAt: isoTimestamp(),
};

/**
 * Matcher for Organization entity
 */
export const organizationMatcher = {
  id: uuid(),
  name: like('Test Organization'),
  sid: like('TESTORG'),
  description: like('A test organization'),
  memberCount: like(25),
  fleetCount: like(3),
  createdAt: isoTimestamp(),
  updatedAt: isoTimestamp(),
};

/**
 * Matcher for Activity entity
 */
export const activityMatcher = {
  id: uuid(),
  title: like('Mining Operation'),
  description: like('Group mining in Yela asteroid belt'),
  type: regex('mining|combat|exploration|trading|social|training', 'mining'),
  status: regex('scheduled|active|completed|cancelled', 'scheduled'),
  startTime: isoTimestamp(),
  endTime: isoTimestamp(),
  maxParticipants: like(20),
  currentParticipants: like(8),
  organizerId: uuid(),
  organizationId: uuid(),
  createdAt: isoTimestamp(),
  updatedAt: isoTimestamp(),
};

/**
 * Matcher for User entity
 */
export const userMatcher = {
  id: uuid(),
  username: like('StarCitizen42'),
  email: like('user@example.com'),
  displayName: like('Star Citizen'),
  avatar: like('https://example.com/avatar.png'),
  rsiHandle: like('StarCitizen42'),
  playStyle: regex('combat|exploration|trading|mining|social|all', 'combat'),
  timezone: like('America/New_York'),
  createdAt: isoTimestamp(),
  updatedAt: isoTimestamp(),
};

/**
 * Matcher for API response wrapper
 */
export function apiResponseMatcher<T>(dataMatcher: T) {
  return {
    success: like(true),
    data: dataMatcher,
    meta: {
      requestId: uuid(),
      timestamp: isoTimestamp(),
    },
  };
}

/**
 * Matcher for paginated API response
 */
export function paginatedResponseMatcher<T>(itemMatcher: T) {
  return {
    success: like(true),
    data: eachLike(itemMatcher),
    pagination: {
      page: like(1),
      limit: like(20),
      total: like(100),
      totalPages: like(5),
      hasNext: like(true),
      hasPrev: like(false),
    },
    meta: {
      requestId: uuid(),
      timestamp: isoTimestamp(),
    },
  };
}

/**
 * Matcher for API error response
 */
export const errorResponseMatcher = {
  success: like(false),
  error: {
    code: like('NOT_FOUND'),
    message: like('Resource not found'),
  },
  meta: {
    requestId: uuid(),
    timestamp: isoTimestamp(),
  },
};
