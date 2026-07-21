/**
 * K6 Load Test: Fleet API Endpoints
 *
 * Tests:
 * - List fleets (with pagination, filtering)
 * - Create fleet
 * - Get fleet details
 * - Update fleet
 * - Add ship to fleet
 * - Remove ship from fleet
 * - Delete fleet
 *
 * Run: k6 run backend/tests/load-testing/02-fleet-api.js
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const listFleetsDuration = new Trend('list_fleets_duration');
const createFleetDuration = new Trend('create_fleet_duration');
const getFleetDuration = new Trend('get_fleet_duration');
const updateFleetDuration = new Trend('update_fleet_duration');
const addShipDuration = new Trend('add_ship_duration');
const fleetErrors = new Counter('fleet_api_errors');
const fleetErrorRate = new Rate('fleet_error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '2m', target: 30 },
    { duration: '3m', target: 30 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    list_fleets_duration: ['p(95) < 500', 'p(99) < 1000'],
    create_fleet_duration: ['p(95) < 800', 'p(99) < 2000'],
    get_fleet_duration: ['p(95) < 200', 'p(99) < 500'],
    update_fleet_duration: ['p(95) < 400', 'p(99) < 1000'],
    add_ship_duration: ['p(95) < 300', 'p(99) < 800'],
    fleet_error_rate: ['rate < 0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ORG_ID = __ENV.ORG_ID || 'org-test-' + Math.random().toString(36).substring(7);
const TOKEN = __ENV.TOKEN || 'test_token_placeholder';

const ships = [
  { id: 'ship-001', name: 'Aurora' },
  { id: 'ship-002', name: 'Mustang' },
  { id: 'ship-003', name: 'Hornet' },
  { id: 'ship-004', name: 'Constellation' },
  { id: 'ship-005', name: 'Freelancer' },
];

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
  'X-Organization-ID': ORG_ID,
};

export default function () {
  group('Fleet API Tests', () => {
    // Test 1: List Fleets
    group('List Fleets', () => {
      const startTime = new Date();
      const listRes = http.get(`${BASE_URL}/api/v2/fleets?page=1&pageSize=20&sort=name`, {
        headers: headers,
        tags: { name: 'Fleet' },
      });

      listFleetsDuration.add(new Date() - startTime);

      check(listRes, {
        'List fleets successful': r => r.status === 200,
        'Response is valid JSON': r => {
          try {
            return r.json() !== undefined;
          } catch {
            return false;
          }
        },
        'Pagination present': r => r.json('pagination') !== undefined,
      });

      if (listRes.status !== 200) {
        fleetErrors.add(1);
        fleetErrorRate.add(false);
      } else {
        fleetErrorRate.add(true);
      }
    });

    sleep(0.5);

    // Test 2: Create Fleet
    let fleetId = null;
    group('Create Fleet', () => {
      const fleetName = `Fleet-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const startTime = new Date();

      const createRes = http.post(
        `${BASE_URL}/api/v2/fleets`,
        JSON.stringify({
          name: fleetName,
          description: `Load test fleet ${fleetName}`,
          tags: ['load-test'],
        }),
        {
          headers: headers,
          tags: { name: 'Fleet' },
        }
      );

      createFleetDuration.add(new Date() - startTime);

      check(createRes, {
        'Fleet created': r => r.status === 201,
        'Fleet ID returned': r => r.json('id') !== undefined,
      });

      if (createRes.status === 201) {
        fleetId = createRes.json('id');
        fleetErrorRate.add(true);
      } else {
        fleetErrors.add(1);
        fleetErrorRate.add(false);
      }
    });

    sleep(0.5);

    if (fleetId) {
      // Test 3: Get Fleet Details
      group('Get Fleet Details', () => {
        const startTime = new Date();
        const getRes = http.get(`${BASE_URL}/api/v2/fleets/${fleetId}`, {
          headers: headers,
          tags: { name: 'Fleet' },
        });

        getFleetDuration.add(new Date() - startTime);

        check(getRes, {
          'Fleet retrieved': r => r.status === 200,
          'Fleet name present': r => r.json('name') !== undefined,
        });
      });

      sleep(0.5);

      // Test 4: Update Fleet
      group('Update Fleet', () => {
        const startTime = new Date();
        const updateRes = http.patch(
          `${BASE_URL}/api/v2/fleets/${fleetId}`,
          JSON.stringify({
            description: `Updated description at ${new Date().toISOString()}`,
            tags: ['load-test', 'updated'],
          }),
          {
            headers: headers,
            tags: { name: 'Fleet' },
          }
        );

        updateFleetDuration.add(new Date() - startTime);

        check(updateRes, {
          'Fleet updated': r => r.status === 200 || r.status === 204,
        });
      });

      sleep(0.5);

      // Test 5: Add Ship to Fleet (multiple ships)
      group('Add Ships to Fleet', () => {
        const randomShip = ships[Math.floor(Math.random() * ships.length)];
        const startTime = new Date();

        const addRes = http.post(
          `${BASE_URL}/api/v2/fleets/${fleetId}/ships`,
          JSON.stringify({
            shipId: randomShip.id,
            role: 'Primary',
            notes: 'Added during load test',
          }),
          {
            headers: headers,
            tags: { name: 'Fleet' },
          }
        );

        addShipDuration.add(new Date() - startTime);

        check(addRes, {
          'Ship added': r => r.status === 201 || r.status === 200,
          'Assignment created': r => r.json('id') !== undefined || r.json('shipId') !== undefined,
        });
      });

      sleep(0.5);

      // Test 6: Get Fleet Ships
      group('Get Fleet Ships', () => {
        const shipsRes = http.get(`${BASE_URL}/api/v2/fleets/${fleetId}/ships`, {
          headers: headers,
          tags: { name: 'Fleet' },
        });

        check(shipsRes, {
          'Fleet ships retrieved': r => r.status === 200,
          'Ships array returned': r => Array.isArray(r.json()) || r.json('ships') !== undefined,
        });
      });

      sleep(0.5);

      // Test 7: Remove Ship from Fleet (if ships exist)
      group('Remove Ship from Fleet', () => {
        const shipsRes = http.get(`${BASE_URL}/api/v2/fleets/${fleetId}/ships?limit=1`, {
          headers: headers,
          tags: { name: 'Fleet' },
        });

        if (shipsRes.status === 200) {
          const ships = shipsRes.json('data') || shipsRes.json();
          if (Array.isArray(ships) && ships.length > 0) {
            const shipId = ships[0].id || ships[0].shipId;
            const removeRes = http.delete(`${BASE_URL}/api/v2/fleets/${fleetId}/ships/${shipId}`, {
              headers: headers,
              tags: { name: 'Fleet' },
            });

            check(removeRes, {
              'Ship removed': r => r.status === 200 || r.status === 204,
            });
          }
        }
      });

      sleep(0.5);

      // Test 8: Delete Fleet (50% of the time to avoid excessive deletions)
      if (Math.random() > 0.5) {
        group('Delete Fleet', () => {
          const deleteRes = http.delete(`${BASE_URL}/api/v2/fleets/${fleetId}`, {
            headers: headers,
            tags: { name: 'Fleet' },
          });

          check(deleteRes, {
            'Fleet deleted': r => r.status === 200 || r.status === 204,
          });
        });
      }
    }
  });

  sleep(Math.random() * 2 + 1);
}
