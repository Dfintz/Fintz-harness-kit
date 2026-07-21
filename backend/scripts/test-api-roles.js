/**
 * Comprehensive API endpoint tester for 3 user roles:
 * 1. Standalone user (no org) — rsi_verified
 * 2. Org member — star_cadet (member of Stardust Fleet)
 * 3. Org owner — admiral_chen (owner of Stardust Fleet)
 */
const http = require('http');
const https = require('https');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

function request(method, path, token, body) {
  return new Promise(resolve => {
    const url = new URL(path, BASE);
    const protocol = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };
    if (body) {
      const data = JSON.stringify(body);
      opts.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = protocol.request(opts, res => {
      let d = '';
      res.on('data', c => (d += c));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(d);
        } catch {
          parsed = d;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', e => resolve({ status: 0, data: e.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(username) {
  const res = await request('POST', '/api/v2/auth/demo', null, { username, role: 'user' });
  if (res.data?.data?.accessToken) return res.data.data.accessToken;
  if (res.data?.data?.token) return res.data.data.token;
  throw new Error(`Login failed for ${username}: ${JSON.stringify(res.data)}`);
}

const ENDPOINTS = [
  // Public routes (no auth)
  { method: 'GET', path: '/health', auth: false, label: 'Health check' },
  {
    method: 'GET',
    path: '/api/v2/directory/organizations',
    auth: false,
    label: 'Public: Directory orgs',
  },
  { method: 'GET', path: '/api/directory', auth: false, label: 'Public: Directory v1' },
  {
    method: 'GET',
    path: '/api/directory/contact/options',
    auth: false,
    label: 'Public: Contact options',
  },

  // Auth
  { method: 'GET', path: '/api/v2/auth/me', auth: true, label: 'Auth: Get current user' },

  // Dashboard / Personal
  { method: 'GET', path: '/api/v2/users/me', auth: true, label: 'Users: Get my profile' },
  { method: 'GET', path: '/api/v2/users/me/ships', auth: true, label: 'Users: Get my ships' },

  // Organization endpoints
  { method: 'GET', path: '/api/v2/organizations', auth: true, label: 'Orgs: List organizations' },

  // Fleet (org-scoped - tested dynamically below)
  // Will be tested with orgId for org users

  // Activities (v2 - no org required for search)
  { method: 'GET', path: '/api/v2/activities', auth: true, label: 'Activities: Search all' },
  { method: 'GET', path: '/api/v2/activities/upcoming', auth: true, label: 'Activities: Upcoming' },

  // GDPR / Privacy
  { method: 'GET', path: '/api/v2/gdpr/consent', auth: true, label: 'GDPR: Get consents' },
  { method: 'GET', path: '/api/v2/gdpr/dashboard', auth: true, label: 'GDPR: Dashboard' },

  // Notifications
  { method: 'GET', path: '/api/v2/notifications', auth: true, label: 'Notifications: List' },

  // Inbox (v1 paths)
  { method: 'GET', path: '/api/inbox/sent', auth: true, label: 'Inbox: Sent messages' },
  { method: 'GET', path: '/api/inbox/unread-count', auth: true, label: 'Inbox: Unread count' },
];

async function testUser(label, username) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label} (${username})`);
  console.log('='.repeat(60));

  const token = await login(username);

  // Get user info first
  const me = await request('GET', '/api/v2/auth/me', token);
  const user = me.data?.data || me.data?.user || me.data;
  console.log(
    `  User: ${user?.username || '?'} | OrgId: ${user?.organizationId || user?.activeOrgId || 'NONE'} | Role: ${user?.role || '?'}`
  );
  console.log('-'.repeat(60));

  for (const ep of ENDPOINTS) {
    const res = await request(ep.method, ep.path, ep.auth ? token : null);
    const ok = res.status >= 200 && res.status < 300;
    const icon = ok ? '✓' : '✗';
    const dataInfo = (() => {
      if (!ok) {
        const msg = res.data?.error?.message || res.data?.message || res.data?.error || '';
        return `ERR: ${msg}`.substring(0, 60);
      }
      const d = res.data?.data;
      if (Array.isArray(d)) return `${d.length} items`;
      if (d?.pagination) return `${d.pagination?.total || '?'} total`;
      if (d && typeof d === 'object') return 'OK';
      return 'OK';
    })();
    console.log(`  ${icon} ${res.status} ${ep.label.padEnd(35)} ${dataInfo}`);
  }

  // Test org-scoped endpoints if user has an org
  const orgId = user?.organizationId || user?.activeOrgId;
  if (orgId) {
    console.log(`\n  --- Org-scoped endpoints (${orgId}) ---`);
    const orgEndpoints = [
      {
        method: 'GET',
        path: `/api/v2/organizations/${orgId}/fleets`,
        label: 'Fleets: List org fleets',
      },
      {
        method: 'GET',
        path: `/api/v2/organizations/${orgId}/activities`,
        label: 'Activities: Org activities',
      },
      {
        method: 'GET',
        path: `/api/organizations/${orgId}/contact-requests`,
        label: 'Contact: Org requests',
      },
    ];
    for (const ep of orgEndpoints) {
      const res = await request(ep.method, ep.path, token);
      const ok = res.status >= 200 && res.status < 300;
      const icon = ok ? '✓' : '✗';
      const dataInfo = (() => {
        if (!ok) {
          const msg = res.data?.error?.message || res.data?.message || res.data?.error || '';
          return `ERR: ${msg}`.substring(0, 60);
        }
        const d = res.data?.data;
        if (Array.isArray(d)) return `${d.length} items`;
        if (d?.pagination) return `${d.pagination?.total || '?'} total`;
        if (d && typeof d === 'object') return 'OK';
        return 'OK';
      })();
      console.log(`  ${icon} ${res.status} ${ep.label.padEnd(35)} ${dataInfo}`);
    }
  } else {
    console.log(`\n  --- Skipping org-scoped endpoints (no org) ---`);
  }
}

async function main() {
  console.log('API Endpoint Test Suite for 3 User Roles');
  console.log('Testing against: ' + BASE);

  await testUser('1. STANDALONE USER (no org)', 'rsi_verified');
  await testUser('2. ORG MEMBER (Stardust Fleet member)', 'star_cadet');
  await testUser('3. ORG OWNER (Stardust Fleet owner)', 'admiral_chen');

  console.log('\n' + '='.repeat(60));
  console.log('  Test complete!');
  console.log('='.repeat(60));
}

main().catch(console.error);
