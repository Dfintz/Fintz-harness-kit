import { eachLike, like } from '@pact-foundation/pact/src/dsl/matchers';
import axios from 'axios';
import { createPact } from './pact-setup';

// Unmock axios for pact tests - we need real HTTP requests to the mock server
jest.unmock('axios');

/**
 * Consumer contract tests for all APIs
 *
 * Updated for Pact v16 which uses PactV3 with the executeTest() pattern.
 * This pattern automatically handles:
 * - Starting the mock server
 * - Verifying interactions
 * - Writing the contract file
 * - Cleaning up the mock server
 *
 * The executeTest() method ensures proper lifecycle management and
 * eliminates the need for manual setup/teardown/verify calls.
 */

describe('API Consumer Contracts', () => {
  describe('Fleet API', () => {
    it('should return a list of fleets', async () => {
      const provider = createPact();

      await provider
        .given('fleets exist for organization')
        .uponReceiving('a request for all fleets')
        .withRequest({
          method: 'GET',
          path: '/api/v2/fleets',
          headers: {
            Accept: 'application/json',
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: eachLike({
            id: like('fleet-123'),
            name: like('Alpha Squadron'),
            organizationId: like('org-123'),
            createdAt: like('2024-01-01T00:00:00.000Z'),
            updatedAt: like('2024-01-01T00:00:00.000Z'),
          }),
        })
        .executeTest(async mockServer => {
          // Make the actual request to the mock server
          const response = await axios.get(`${mockServer.url}/api/v2/fleets`, {
            headers: {
              Accept: 'application/json',
            },
          });

          // Verify the response
          expect(response.status).toBe(200);
          expect(Array.isArray(response.data)).toBe(true);
          expect(response.data[0]).toHaveProperty('id');
          expect(response.data[0]).toHaveProperty('name');
          expect(response.data[0]).toHaveProperty('organizationId');
        });
    });
  });

  describe('Organization API', () => {
    it('should return a list of organizations', async () => {
      const provider = createPact();

      await provider
        .given('organizations exist')
        .uponReceiving('a request for all organizations')
        .withRequest({
          method: 'GET',
          path: '/api/v2/organizations',
          headers: {
            Accept: 'application/json',
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: eachLike({
            id: like('org-123'),
            name: like('Star Citizen Fleet'),
            type: like('FLEET'),
            status: like('ACTIVE'),
            createdAt: like('2024-01-01T00:00:00.000Z'),
          }),
        })
        .executeTest(async mockServer => {
          // Make the actual request to the mock server
          const response = await axios.get(`${mockServer.url}/api/v2/organizations`, {
            headers: {
              Accept: 'application/json',
            },
          });

          // Verify the response
          expect(response.status).toBe(200);
          expect(Array.isArray(response.data)).toBe(true);
          expect(response.data[0]).toHaveProperty('id');
          expect(response.data[0]).toHaveProperty('name');
          expect(response.data[0]).toHaveProperty('type');
          expect(response.data[0]).toHaveProperty('status');
        });
    });
  });

  describe('User API', () => {
    it('should return a specific user', async () => {
      const provider = createPact();

      await provider
        .given('user exists with id user-123')
        .uponReceiving('a request for a specific user')
        .withRequest({
          method: 'GET',
          path: '/api/v2/users/user-123',
          headers: {
            Accept: 'application/json',
          },
        })
        .willRespondWith({
          status: 200,
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: {
            id: like('user-123'),
            username: like('testuser'),
            email: like('testuser@example.com'),
            role: like('USER'),
            createdAt: like('2024-01-01T00:00:00.000Z'),
            updatedAt: like('2024-01-01T00:00:00.000Z'),
          },
        })
        .executeTest(async mockServer => {
          // Make the actual request to the mock server
          const response = await axios.get(`${mockServer.url}/api/v2/users/user-123`, {
            headers: {
              Accept: 'application/json',
            },
          });

          // Verify the response
          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('id');
          expect(response.data).toHaveProperty('username');
          expect(response.data).toHaveProperty('email');
          expect(response.data).toHaveProperty('role');
        });
    });
  });
});
