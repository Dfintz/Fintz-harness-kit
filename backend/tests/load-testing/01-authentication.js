/**
 * K6 Load Test: Authentication Endpoints
 *
 * Tests:
 * - Discord OAuth2 login flow
 * - Token refresh
 * - TOTP 2FA verification
 * - Session management
 *
 * Run: k6 run backend/tests/load-testing/01-authentication.js
 * Run with custom VUs: k6 run backend/tests/load-testing/01-authentication.js --vus 50 --duration 5m
 */

import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { Counter, Gauge, Trend } from 'k6/metrics';

// Custom metrics
const loginDuration = new Trend('login_duration');
const refreshDuration = new Trend('refresh_token_duration');
const tofaDuration = new Trend('tofa_verify_duration');
const loginErrors = new Counter('login_errors');
const sessionTimeout = new Gauge('session_timeout_errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 VUs
    { duration: '3m', target: 50 }, // Ramp up to 50 VUs
    { duration: '5m', target: 50 }, // Stay at 50 VUs
    { duration: '2m', target: 20 }, // Ramp down to 20 VUs
    { duration: '1m', target: 0 }, // Ramp down to 0 VUs
  ],
  thresholds: {
    login_duration: ['p(95) < 500', 'p(99) < 1000'], // Login < 500ms p95
    refresh_token_duration: ['p(95) < 300', 'p(99) < 600'], // Refresh < 300ms p95
    http_req_failed: ['rate < 0.05'], // <5% failure rate
    http_req_duration: ['p(95) < 1000'], // All requests < 1s p95
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const DISCORD_EMAIL = __ENV.DISCORD_EMAIL || 'test@example.com';
const DISCORD_PASSWORD = __ENV.DISCORD_PASSWORD || 'testpass';

// Helper: Discord OAuth simulation
function discordOAuthLogin() {
  // Step 1: Get OAuth state
  const stateRes = http.get(`${BASE_URL}/api/v2/auth/discord/state`, {
    tags: { name: 'Auth' },
  });

  check(stateRes, {
    'OAuth state retrieved': r => r.status === 200,
    'State is valid': r => r.body && r.body.includes('state'),
  });

  const state = JSON.parse(stateRes.body).state;

  // Step 2: Simulate Discord OAuth callback
  const callbackRes = http.post(
    `${BASE_URL}/api/v2/auth/discord/callback`,
    JSON.stringify({
      code: 'test_code_' + Math.random().toString(36).substring(7),
      state: state,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Auth' },
    }
  );

  if (callbackRes.status === 200 || callbackRes.status === 302) {
    const token = callbackRes.cookies.access_token
      ? callbackRes.cookies.access_token[0].value
      : null;
    return token || JSON.parse(callbackRes.body).accessToken;
  }

  return null;
}

// Helper: Native login
function nativeLogin(email, password) {
  const loginRes = http.post(
    `${BASE_URL}/api/v2/auth/login`,
    JSON.stringify({
      email: email,
      password: password,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'Auth' },
    }
  );

  check(loginRes, {
    'Native login successful': r => r.status === 200,
    'Token returned': r => r.json('accessToken') !== undefined,
  });

  if (loginRes.status === 200) {
    return loginRes.json('accessToken');
  }

  loginErrors.add(1);
  return null;
}

export default function () {
  group('Authentication Tests', () => {
    // Test 1: Discord OAuth Login
    group('Discord OAuth2 Login', () => {
      const startTime = new Date();
      const token = discordOAuthLogin();
      loginDuration.add(new Date() - startTime);

      check(token, {
        'JWT token obtained': t => t !== null && t.length > 20,
      });
    });

    sleep(1);

    // Test 2: Native Login
    group('Native Email/Password Login', () => {
      const startTime = new Date();
      const token = nativeLogin('user@example.com', 'SecurePass123!');
      loginDuration.add(new Date() - startTime);

      if (token) {
        // Test 3: Token Refresh
        group('Token Refresh', () => {
          const refreshStartTime = new Date();
          const refreshRes = http.post(
            `${BASE_URL}/api/v2/auth/refresh`,
            JSON.stringify({
              refreshToken: 'test_refresh_token',
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              tags: { name: 'Auth' },
            }
          );

          refreshDuration.add(new Date() - refreshStartTime);

          check(refreshRes, {
            'Token refresh successful': r => r.status === 200,
            'New token returned': r => r.json('accessToken') !== undefined,
          });
        });

        sleep(1);

        // Test 4: TOTP 2FA Verification (if enabled)
        group('TOTP 2FA Verification', () => {
          const totpStartTime = new Date();
          const totpRes = http.post(
            `${BASE_URL}/api/v2/auth/totp/verify`,
            JSON.stringify({
              token: '123456',
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              tags: { name: 'Auth' },
            }
          );

          tofaDuration.add(new Date() - totpStartTime);

          check(totpRes, {
            'TOTP verification attempted': r => r.status === 200 || r.status === 401,
          });
        });

        sleep(1);

        // Test 5: Session Management
        group('Session Listing', () => {
          const sessionRes = http.get(`${BASE_URL}/api/v2/auth/sessions`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            tags: { name: 'Auth' },
          });

          check(sessionRes, {
            'Sessions retrieved': r => r.status === 200,
            'Sessions is array': r => Array.isArray(r.json()),
          });
        });

        sleep(1);

        // Test 6: Logout
        group('Logout', () => {
          const logoutRes = http.post(`${BASE_URL}/api/v2/auth/logout`, JSON.stringify({}), {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            tags: { name: 'Auth' },
          });

          check(logoutRes, {
            'Logout successful': r => r.status === 200 || r.status === 204,
          });
        });
      }
    });
  });

  // Random sleep between 1-3 seconds
  sleep(Math.random() * 2 + 1);
}
