/**
 * Pact interaction definitions for SC Fleet Manager API
 */
import { V3Interaction } from '@pact-foundation/pact';
import {
  activityMatcher,
  apiResponseMatcher,
  errorResponseMatcher,
  fleetMatcher,
  organizationMatcher,
  paginatedResponseMatcher,
  shipMatcher,
} from './matchers';

/**
 * Fleet API Interactions
 */
export const fleetInteractions: Record<string, V3Interaction> = {
  getFleets: {
    states: [{ description: 'fleets exist for organization' }],
    uponReceiving: 'a request for all fleets',
    withRequest: {
      method: 'GET',
      path: '/api/v2/fleets',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: paginatedResponseMatcher(fleetMatcher),
    },
  },

  getFleetById: {
    states: [{ description: 'a fleet exists' }],
    uponReceiving: 'a request for a specific fleet',
    withRequest: {
      method: 'GET',
      path: '/api/v2/fleets/fleet-123',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: apiResponseMatcher(fleetMatcher),
    },
  },

  getFleetNotFound: {
    states: [{ description: 'no fleet exists with given id' }],
    uponReceiving: 'a request for a non-existent fleet',
    withRequest: {
      method: 'GET',
      path: '/api/v2/fleets/non-existent',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
      },
      body: errorResponseMatcher,
    },
  },

  createFleet: {
    states: [{ description: 'user can create fleets' }],
    uponReceiving: 'a request to create a fleet',
    withRequest: {
      method: 'POST',
      path: '/api/v2/fleets',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: 'Bearer valid-token',
      },
      body: {
        name: 'New Fleet',
        description: 'A new fleet description',
        maxCapacity: 25,
      },
    },
    willRespondWith: {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
      },
      body: apiResponseMatcher(fleetMatcher),
    },
  },

  getFleetShips: {
    states: [{ description: 'a fleet exists with ships' }],
    uponReceiving: 'a request for fleet ships',
    withRequest: {
      method: 'GET',
      path: '/api/v2/fleets/fleet-123/ships',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: paginatedResponseMatcher(shipMatcher),
    },
  },
};

/**
 * Activity API Interactions
 */
export const activityInteractions: Record<string, V3Interaction> = {
  getActivities: {
    states: [{ description: 'activities exist' }],
    uponReceiving: 'a request for all activities',
    withRequest: {
      method: 'GET',
      path: '/api/v2/activities',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: paginatedResponseMatcher(activityMatcher),
    },
  },

  getActivityById: {
    states: [{ description: 'an activity exists' }],
    uponReceiving: 'a request for a specific activity',
    withRequest: {
      method: 'GET',
      path: '/api/v2/activities/activity-123',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: apiResponseMatcher(activityMatcher),
    },
  },

  joinActivity: {
    states: [{ description: 'an activity exists and user can join' }],
    uponReceiving: 'a request to join an activity',
    withRequest: {
      method: 'POST',
      path: '/api/v2/activities/activity-123/join',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: apiResponseMatcher(activityMatcher),
    },
  },
};

/**
 * Organization API Interactions
 */
export const organizationInteractions: Record<string, V3Interaction> = {
  getOrganizations: {
    states: [{ description: 'user belongs to organizations' }],
    uponReceiving: 'a request for user organizations',
    withRequest: {
      method: 'GET',
      path: '/api/v2/organizations/me',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: paginatedResponseMatcher(organizationMatcher),
    },
  },

  getOrganizationById: {
    states: [{ description: 'an organization exists' }],
    uponReceiving: 'a request for a specific organization',
    withRequest: {
      method: 'GET',
      path: '/api/v2/organizations/org-123',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer valid-token',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: apiResponseMatcher(organizationMatcher),
    },
  },
};

/**
 * Health API Interactions
 */
export const healthInteractions: Record<string, V3Interaction> = {
  getHealth: {
    states: [{ description: 'server is healthy' }],
    uponReceiving: 'a health check request',
    withRequest: {
      method: 'GET',
      path: '/health',
      headers: {
        Accept: 'application/json',
      },
    },
    willRespondWith: {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: {
        status: 'healthy',
        uptime: 12345,
        timestamp: '2024-01-01T00:00:00.000Z',
      },
    },
  },
};
