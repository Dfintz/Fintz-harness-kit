/**
 * K6 Load Testing: Master Test Suite
 *
 * Orchestrates all load tests and generates consolidated report
 *
 * Run: k6 run backend/tests/load-testing/run-all-tests.js
 * Run with custom settings: k6 run backend/tests/load-testing/run-all-tests.js --vus 50 --duration 10m
 *
 * Output: ./load-test-results.json (can be imported into k6 Cloud)
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';

// Global metrics
const allDuration = new Trend('all_requests_duration');
const allErrors = new Counter('all_errors');
const activeVUs = new Gauge('active_vus');
const successRate = new Rate('success_rate');

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up
    { duration: '5m', target: 50 }, // High load
    { duration: '2m', target: 20 }, // Cool down
    { duration: '30s', target: 0 }, // Ramp down
  ],
  thresholds: {
    all_requests_duration: ['p(95) < 1000', 'p(99) < 2000'],
    success_rate: ['rate >= 0.95'],
    all_errors: ['count < 100'],
  },
  ext: {
    loadimpact: {
      projectID: 3556548,
      name: 'Fleet Manager Load Test',
    },
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN = __ENV.TOKEN || 'test_token_placeholder';
const ORG_ID = __ENV.ORG_ID || 'org-test-' + Math.random().toString(36).substring(7);

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
  'X-Organization-ID': ORG_ID,
};

// Test distribution across different API areas
const testDistribution = [
  { weight: 0.3, name: 'Authentication', test: authenticationTest },
  { weight: 0.4, name: 'Fleet API', test: fleetTest },
  { weight: 0.2, name: 'Activity API', test: activityTest },
  { weight: 0.1, name: 'Database', test: databaseTest },
];

export default function () {
  activeVUs.add(__VU);

  group('Fleet Manager Load Test Suite', () => {
    // Select test based on distribution weights
    const rand = Math.random();
    let cumWeight = 0;

    for (const { weight, name, test } of testDistribution) {
      cumWeight += weight;
      if (rand < cumWeight) {
        group(name, test);
        break;
      }
    }
  });

  sleep(Math.random() * 3 + 1);
}

function authenticationTest() {
  const testRes = http.get(`${BASE_URL}/api/v2/auth/me`, {
    headers: headers,
    tags: { name: 'Auth' },
  });

  const start = Date.now();
  allDuration.add(Date.now() - start);

  if (testRes.status !== 200) {
    allErrors.add(1);
    successRate.add(false);
  } else {
    successRate.add(true);
  }

  check(testRes, {
    'Auth check passed': r => r.status === 200,
  });

  sleep(0.5);
}

function fleetTest() {
  const start = Date.now();

  // List fleets
  const listRes = http.get(`${BASE_URL}/api/v2/fleets?pageSize=20`, {
    headers: headers,
    tags: { name: 'Fleet' },
  });

  allDuration.add(Date.now() - start);

  if (listRes.status !== 200) {
    allErrors.add(1);
    successRate.add(false);
  } else {
    successRate.add(true);
  }

  check(listRes, {
    'Fleet list retrieved': r => r.status === 200,
  });

  sleep(0.5);

  // Create fleet (10% of time)
  if (Math.random() > 0.9) {
    const createStart = Date.now();
    const createRes = http.post(
      `${BASE_URL}/api/v2/fleets`,
      JSON.stringify({
        name: `Fleet-${Date.now()}`,
        description: 'Load test fleet',
      }),
      {
        headers: headers,
        tags: { name: 'Fleet' },
      }
    );

    allDuration.add(Date.now() - createStart);

    if (createRes.status !== 201) {
      allErrors.add(1);
      successRate.add(false);
    } else {
      successRate.add(true);
    }
  }

  sleep(0.5);
}

function activityTest() {
  const start = Date.now();

  const listRes = http.get(`${BASE_URL}/api/v2/activities?pageSize=30`, {
    headers: headers,
    tags: { name: 'Activity' },
  });

  allDuration.add(Date.now() - start);

  if (listRes.status !== 200) {
    allErrors.add(1);
    successRate.add(false);
  } else {
    successRate.add(true);
  }

  check(listRes, {
    'Activity list retrieved': r => r.status === 200,
  });

  sleep(0.5);
}

function databaseTest() {
  const start = Date.now();

  const statsRes = http.get(`${BASE_URL}/api/v2/organizations/${ORG_ID}/statistics`, {
    headers: headers,
    tags: { name: 'Database' },
  });

  allDuration.add(Date.now() - start);

  if (statsRes.status !== 200) {
    allErrors.add(1);
    successRate.add(false);
  } else {
    successRate.add(true);
  }

  check(statsRes, {
    'Stats query succeeded': r => r.status === 200 || r.status === 404,
  });

  sleep(0.5);
}
