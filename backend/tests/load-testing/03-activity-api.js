/**
 * K6 Load Test: Activity Endpoints
 *
 * Tests:
 * - List activities (with complex filters)
 * - Create activity
 * - Join/RSVP to activity
 * - Get activity details
 * - Update activity
 *
 * Run: k6 run backend/tests/load-testing/03-activity-api.js
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Rate, Trend } from 'k6/metrics';

const listActivitiesDuration = new Trend('list_activities_duration');
const createActivityDuration = new Trend('create_activity_duration');
const joinActivityDuration = new Trend('join_activity_duration');
const activityErrors = new Counter('activity_api_errors');
const activityErrorRate = new Rate('activity_error_rate');

export const options = {
  stages: [
    { duration: '30s', target: 3 },
    { duration: '2m', target: 20 },
    { duration: '3m', target: 20 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    list_activities_duration: ['p(95) < 800', 'p(99) < 2000'],
    create_activity_duration: ['p(95) < 1000', 'p(99) < 2500'],
    join_activity_duration: ['p(95) < 300', 'p(99) < 800'],
    activity_error_rate: ['rate < 0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ORG_ID = __ENV.ORG_ID || 'org-test-' + Math.random().toString(36).substring(7);
const TOKEN = __ENV.TOKEN || 'test_token_placeholder';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
  'X-Organization-ID': ORG_ID,
};

const activityTypes = [
  'Mining Operation',
  'Trading Route',
  'Combat Operation',
  'Exploration',
  'Event',
];
const locations = ['Stanton', 'Pyro', 'Nyx', 'Vanduul Space'];

export default function () {
  group('Activity API Tests', () => {
    // Test 1: List Activities with Filters
    group('List Activities with Filters', () => {
      const startTime = new Date();
      const filters = [
        `status=scheduled`,
        `type=${activityTypes[Math.floor(Math.random() * activityTypes.length)]}`,
        `minParticipants=2`,
        `sort=scheduledAt&order=desc`,
      ].join('&');

      const listRes = http.get(`${BASE_URL}/api/v2/activities?${filters}&page=1&pageSize=50`, {
        headers: headers,
        tags: { name: 'Activity' },
      });

      listActivitiesDuration.add(new Date() - startTime);

      check(listRes, {
        'Activities listed': r => r.status === 200,
        'Pagination present': r => r.json('pagination') !== undefined || Array.isArray(r.json()),
      });

      if (listRes.status !== 200) {
        activityErrors.add(1);
        activityErrorRate.add(false);
      } else {
        activityErrorRate.add(true);
      }
    });

    sleep(0.5);

    // Test 2: Create Activity
    let activityId = null;
    group('Create Activity', () => {
      const type = activityTypes[Math.floor(Math.random() * activityTypes.length)];
      const scheduledAt = new Date(Date.now() + 86400000).toISOString(); // Tomorrow
      const startTime = new Date();

      const createRes = http.post(
        `${BASE_URL}/api/v2/activities`,
        JSON.stringify({
          title: `${type}-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          description: `Load test ${type} activity`,
          type: type,
          location: locations[Math.floor(Math.random() * locations.length)],
          scheduledAt: scheduledAt,
          duration: Math.floor(Math.random() * 180) + 30, // 30-210 minutes
          minParticipants: Math.floor(Math.random() * 5) + 2,
          maxParticipants: Math.floor(Math.random() * 10) + 5,
        }),
        {
          headers: headers,
          tags: { name: 'Activity' },
        }
      );

      createActivityDuration.add(new Date() - startTime);

      check(createRes, {
        'Activity created': r => r.status === 201,
        'Activity ID returned': r => r.json('id') !== undefined,
      });

      if (createRes.status === 201) {
        activityId = createRes.json('id');
        activityErrorRate.add(true);
      } else {
        activityErrors.add(1);
        activityErrorRate.add(false);
      }
    });

    sleep(0.5);

    if (activityId) {
      // Test 3: Get Activity Details
      group('Get Activity Details', () => {
        const detailRes = http.get(`${BASE_URL}/api/v2/activities/${activityId}`, {
          headers: headers,
          tags: { name: 'Activity' },
        });

        check(detailRes, {
          'Activity retrieved': r => r.status === 200,
          'Activity has title': r => r.json('title') !== undefined,
        });
      });

      sleep(0.5);

      // Test 4: Join Activity (RSVP)
      group('Join Activity', () => {
        const startTime = new Date();
        const joinRes = http.post(
          `${BASE_URL}/api/v2/activities/${activityId}/join`,
          JSON.stringify({
            rsvpStatus: 'confirmed',
            notes: 'Joining for load test',
          }),
          {
            headers: headers,
            tags: { name: 'Activity' },
          }
        );

        joinActivityDuration.add(new Date() - startTime);

        check(joinRes, {
          'Join successful': r => r.status === 200 || r.status === 201,
        });
      });

      sleep(0.5);

      // Test 5: Update Activity (owner only, will likely fail)
      group('Update Activity', () => {
        const updateRes = http.patch(
          `${BASE_URL}/api/v2/activities/${activityId}`,
          JSON.stringify({
            description: `Updated at ${new Date().toISOString()}`,
          }),
          {
            headers: headers,
            tags: { name: 'Activity' },
          }
        );

        check(updateRes, {
          'Update attempted': r => [200, 201, 403].includes(r.status),
        });
      });

      sleep(0.5);

      // Test 6: Get Activity Participants
      group('Get Activity Participants', () => {
        const participantsRes = http.get(
          `${BASE_URL}/api/v2/activities/${activityId}/participants`,
          {
            headers: headers,
            tags: { name: 'Activity' },
          }
        );

        check(participantsRes, {
          'Participants retrieved': r => r.status === 200,
          'Participants array': r =>
            Array.isArray(r.json()) || Array.isArray(r.json('participants')),
        });
      });

      sleep(0.5);

      // Test 7: Leave Activity (50% of the time)
      if (Math.random() > 0.5) {
        group('Leave Activity', () => {
          const leaveRes = http.delete(`${BASE_URL}/api/v2/activities/${activityId}/join`, {
            headers: headers,
            tags: { name: 'Activity' },
          });

          check(leaveRes, {
            'Leave successful': r => r.status === 200 || r.status === 204,
          });
        });
      }
    }
  });

  sleep(Math.random() * 2 + 1);
}
