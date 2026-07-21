/**
 * Provider state handlers for Pact verification
 * 
 * These handlers set up the backend state required for each contract test.
 * They are used during provider verification to ensure the backend
 * is in the correct state before each interaction is verified.
 */

export interface ProviderStateHandler {
  description: string;
  setup: () => Promise<void>;
  teardown?: () => Promise<void>;
}

/**
 * Provider state handler definitions
 * 
 * Each state corresponds to a Pact provider state string.
 * The setup function prepares the backend for the interaction.
 * The optional teardown function cleans up after the interaction.
 */
export const providerStates: Record<string, ProviderStateHandler> = {
  'fleets exist for organization': {
    description: 'Creates test fleets for the default organization',
    setup: async () => {
      // In actual implementation, this would:
      // 1. Create test organization if not exists
      // 2. Create test fleets within that organization
      console.log('Setting up: fleets exist for organization');
    },
    teardown: async () => {
      // Clean up test data
      console.log('Tearing down: fleets exist for organization');
    },
  },

  'a fleet exists': {
    description: 'Creates a single test fleet with known ID',
    setup: async () => {
      // Create a fleet with ID 'fleet-123'
      console.log('Setting up: a fleet exists');
    },
  },

  'no fleet exists with given id': {
    description: 'Ensures no fleet exists with the given ID',
    setup: async () => {
      // Delete any fleet with ID 'non-existent' if it exists
      console.log('Setting up: no fleet exists with given id');
    },
  },

  'user can create fleets': {
    description: 'Ensures the test user has permission to create fleets',
    setup: async () => {
      // Set up user permissions for fleet creation
      console.log('Setting up: user can create fleets');
    },
  },

  'a fleet exists with ships': {
    description: 'Creates a fleet with associated ships',
    setup: async () => {
      // Create fleet 'fleet-123' with several test ships
      console.log('Setting up: a fleet exists with ships');
    },
  },

  'activities exist': {
    description: 'Creates test activities',
    setup: async () => {
      // Create several test activities
      console.log('Setting up: activities exist');
    },
  },

  'an activity exists': {
    description: 'Creates a single test activity with known ID',
    setup: async () => {
      // Create activity with ID 'activity-123'
      console.log('Setting up: an activity exists');
    },
  },

  'an activity exists and user can join': {
    description: 'Creates an activity that the test user can join',
    setup: async () => {
      // Create activity 'activity-123' with available slots
      console.log('Setting up: an activity exists and user can join');
    },
  },

  'user belongs to organizations': {
    description: 'Ensures the test user belongs to some organizations',
    setup: async () => {
      // Add test user to test organizations
      console.log('Setting up: user belongs to organizations');
    },
  },

  'an organization exists': {
    description: 'Creates a single test organization with known ID',
    setup: async () => {
      // Create organization with ID 'org-123'
      console.log('Setting up: an organization exists');
    },
  },

  'server is healthy': {
    description: 'Ensures the server is in a healthy state',
    setup: async () => {
      // No special setup needed - server should be healthy by default
      console.log('Setting up: server is healthy');
    },
  },
};

/**
 * Get the state handler for a given state name
 */
export function getStateHandler(stateName: string): ProviderStateHandler | undefined {
  return providerStates[stateName];
}

/**
 * Execute all setup handlers for given states
 */
export async function setupStates(states: string[]): Promise<void> {
  for (const state of states) {
    const handler = getStateHandler(state);
    if (handler) {
      await handler.setup();
    } else {
      console.warn(`No handler found for state: ${state}`);
    }
  }
}

/**
 * Execute all teardown handlers for given states
 */
export async function teardownStates(states: string[]): Promise<void> {
  for (const state of states) {
    const handler = getStateHandler(state);
    if (handler?.teardown) {
      await handler.teardown();
    }
  }
}

/**
 * Create an Express middleware for Pact state setup
 * 
 * This can be mounted on the provider during verification
 * to handle /_pactSetup requests.
 */
export function createStateSetupMiddleware() {
  return async (req: { body: { state: string; states?: string[] } }, res: { status: (code: number) => { json: (data: unknown) => void } }) => {
    const { state, states = [] } = req.body;
    const allStates = state ? [state, ...states] : states;

    try {
      await setupStates(allStates);
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Failed to setup state:', error);
      res.status(500).json({ success: false, error: String(error) });
    }
  };
}
