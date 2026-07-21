/**
 * K6 Load Test: Database Query Performance
 *
 * Tests:
 * - Complex fleet queries with filters/pagination
 * - Aggregation queries (statistics)
 * - Join operations (fleet + ships)
 * - Search/full-text queries
 * - Concurrent query load
 *
 * Measures:
 * - Query response time
 * - N+1 query detection (via response times)
 * - Database connection pool stress
 * - Concurrent load capacity
 *
 * Run: k6 run backend/tests/load-testing/05-database-performance.js
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';

const simpleQueryDuration = new Trend('db_simple_query_duration');
const complexQueryDuration = new Trend('db_complex_query_duration');
const aggregationQueryDuration = new Trend('db_aggregation_query_duration');
const searchQueryDuration = new Trend('db_search_query_duration');
const dbErrors = new Counter('db_query_errors');

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '2m', target: 50 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    db_simple_query_duration: ['p(95) < 200', 'p(99) < 500'],
    db_complex_query_duration: ['p(95) < 800', 'p(99) < 2000'],
    db_aggregation_query_duration: ['p(95) < 1500', 'p(99) < 3000'],
    db_search_query_duration: ['p(95) < 1000', 'p(99) < 2500'],
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

export default function () {
  group('Database Performance Tests', () => {
    // Test 1: Simple Query (No Joins)
    group('Simple Fleet List Query', () => {
      const startTime = new Date();
      const res = http.get(`${BASE_URL}/api/v2/fleets?pageSize=10`, {
        headers: headers,
        tags: { name: 'Database' },
      });

      simpleQueryDuration.add(new Date() - startTime);

      check(res, {
        'Query succeeded': r => r.status === 200,
      });

      if (res.status !== 200) {
        dbErrors.add(1);
      }
    });

    sleep(0.3);

    // Test 2: Complex Query with Multiple Filters
    group('Complex Fleet Query with Filters', () => {
      const startTime = new Date();
      const filters = ['sort=name', 'order=asc', 'pageSize=50', 'status=active'].join('&');

      const res = http.get(`${BASE_URL}/api/v2/fleets?${filters}`, {
        headers: headers,
        tags: { name: 'Database' },
      });

      complexQueryDuration.add(new Date() - startTime);

      check(res, {
        'Complex query succeeded': r => r.status === 200,
        'Has pagination': r => r.json('pagination') !== undefined,
      });

      if (res.status !== 200) {
        dbErrors.add(1);
      }
    });

    sleep(0.3);

    // Test 3: Join Query (Fleet with Ships)
    group('Fleet with Ships Query', () => {
      const startTime = new Date();
      const res = http.get(`${BASE_URL}/api/v2/fleets?includeShips=true&pageSize=20`, {
        headers: headers,
        tags: { name: 'Database' },
      });

      complexQueryDuration.add(new Date() - startTime);

      check(res, {
        'Fleet-ship join succeeded': r => r.status === 200,
      });

      if (res.status !== 200) {
        dbErrors.add(1);
      }
    });

    sleep(0.3);

    // Test 4: Aggregation Query (Statistics)
    group('Fleet Statistics Aggregation', () => {
      const startTime = new Date();
      const res = http.get(`${BASE_URL}/api/v2/organizations/${ORG_ID}/statistics`, {
        headers: headers,
        tags: { name: 'Database' },
      });

      aggregationQueryDuration.add(new Date() - startTime);

      check(res, {
        'Statistics query succeeded': r => r.status === 200,
        'Has stats': r => {
          try {
            const data = r.json();
            return data.totalFleets !== undefined || data.statistics !== undefined;
          } catch {
            return false;
          }
        },
      });

      if (res.status !== 200) {
        dbErrors.add(1);
      }
    });

    sleep(0.3);

    // Test 5: Search Query (Full-Text or Pattern Match)
    group('Fleet Search Query', () => {
      const searchTerms = ['mining', 'trading', 'combat', 'exploration'];
      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)];

      const startTime = new Date();
      const res = http.get(`${BASE_URL}/api/v2/fleets/search?q=${term}&pageSize=25`, {
        headers: headers,
        tags: { name: 'Database' },
      });

      searchQueryDuration.add(new Date() - startTime);

      check(res, {
        'Search succeeded': r => r.status === 200 || r.status === 404,
        'Results returned': r => Array.isArray(r.json()) || r.json('results') !== undefined,
      });

      if (res.status > 299) {
        dbErrors.add(1);
      }
    });

    sleep(0.3);

    // Test 6: Deep Pagination (stress test pagination)
    group('Deep Pagination Query', () => {
      const page = Math.floor(Math.random() * 10) + 1; // Pages 1-10
      const startTime = new Date();
      const res = http.get(`${BASE_URL}/api/v2/fleets?page=${page}&pageSize=100`, {
        headers: headers,
        tags: { name: 'Database' },
      });

      complexQueryDuration.add(new Date() - startTime);

      check(res, {
        'Pagination query succeeded': r => r.status === 200 || r.status === 404,
      });

      if (res.status > 299 && res.status !== 404) {
        dbErrors.add(1);
      }
    });
  });

  sleep(Math.random() * 2 + 1);
}
