/**
 * Comprehensive page testing script
 * Tests all frontend routes via API endpoints that each page depends on.
 * Tests 3 user roles: standalone (no org), org member, org owner
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
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) {
      opts.headers['Cookie'] = `access_token=${token}`;
    }
    const timer = setTimeout(() => {
      req.destroy();
      resolve({ status: 'TIMEOUT', data: { message: '10s timeout' } });
    }, 10000);
    const req = protocol.request(opts, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        clearTimeout(timer);
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });
    req.on('error', err => {
      clearTimeout(timer);
      resolve({ status: 0, data: err.message });
    });
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

// All frontend pages and their primary API dependencies
const PAGES = [
  // ===== PUBLIC PAGES =====
  { page: '/landing', apis: [{ method: 'GET', path: '/health', auth: false, label: 'Health' }] },
  { page: '/login', apis: [{ method: 'GET', path: '/health', auth: false, label: 'Health' }] },
  {
    page: '/directory',
    apis: [
      {
        method: 'GET',
        path: '/api/v2/directory/organizations',
        auth: false,
        label: 'Public dir v2',
      },
      { method: 'GET', path: '/api/directory', auth: false, label: 'Public dir v1' },
      { method: 'GET', path: '/api/directory/stats', auth: false, label: 'Dir stats' },
      { method: 'GET', path: '/api/directory/options', auth: false, label: 'Dir filter options' },
    ],
  },

  // ===== AUTHENTICATED PAGES =====
  {
    page: '/dashboard',
    apis: [
      { method: 'GET', path: '/api/v2/users/me', auth: true, label: 'User profile' },
      { method: 'GET', path: '/api/v2/users/me/ships', auth: true, label: 'User ships' },
      { method: 'GET', path: '/api/v2/notifications', auth: true, label: 'Notifications' },
    ],
  },
  {
    page: '/fleet',
    apis: [{ method: 'GET', path: '/api/v2/users/me', auth: true, label: 'User profile' }],
  },
  {
    page: '/fleet/ships',
    apis: [{ method: 'GET', path: '/api/v2/users/me', auth: true, label: 'User profile' }],
  },
  {
    page: '/hangar',
    apis: [{ method: 'GET', path: '/api/v2/users/me/ships', auth: true, label: 'My ships' }],
  },
  {
    page: '/activities',
    apis: [
      { method: 'GET', path: '/api/v2/activities', auth: true, label: 'Activities' },
      { method: 'GET', path: '/api/v2/activities/upcoming', auth: true, label: 'Upcoming' },
    ],
  },
  {
    page: '/calendar',
    apis: [{ method: 'GET', path: '/api/v2/activities', auth: true, label: 'Activities' }],
  },
  {
    page: '/directories',
    apis: [
      { method: 'GET', path: '/api/v2/directory/organizations', auth: true, label: 'Orgs dir' },
    ],
  },
  {
    page: '/directories?tab=alliances',
    apis: [
      { method: 'GET', path: '/api/v2/directory/federations', auth: true, label: 'Federations' },
    ],
  },
  {
    page: '/organizations',
    apis: [{ method: 'GET', path: '/api/v2/organizations', auth: true, label: 'Orgs list' }],
  },
  {
    page: '/recruitment',
    apis: [{ method: 'GET', path: '/api/v2/recruitment', auth: true, label: 'Recruitment' }],
  },
  {
    page: '/inbox',
    apis: [
      { method: 'GET', path: '/api/inbox/sent', auth: true, label: 'Sent messages' },
      { method: 'GET', path: '/api/inbox/unread-count', auth: true, label: 'Unread count' },
    ],
  },
  {
    page: '/trading',
    apis: [
      {
        method: 'GET',
        path: '/api/v2/trading/opportunities',
        auth: true,
        label: 'Trade opportunities',
      },
    ],
  },
  {
    page: '/bounties',
    apis: [{ method: 'GET', path: '/api/v2/bounties', auth: true, label: 'Bounties' }],
  },
  {
    page: '/settings',
    apis: [{ method: 'GET', path: '/api/v2/users/me', auth: true, label: 'Profile' }],
  },
  {
    page: '/settings/account',
    apis: [{ method: 'GET', path: '/api/v2/users/me', auth: true, label: 'Profile' }],
  },
  {
    page: '/settings/privacy',
    apis: [{ method: 'GET', path: '/api/v2/gdpr/consent', auth: true, label: 'GDPR consent' }],
  },
  {
    page: '/settings/security',
    apis: [{ method: 'GET', path: '/api/v2/users/me', auth: true, label: 'Profile' }],
  },
  {
    page: '/settings/notifications',
    apis: [
      { method: 'GET', path: '/api/v2/users/me/preferences', auth: true, label: 'Preferences' },
    ],
  },
  {
    page: '/notifications',
    apis: [{ method: 'GET', path: '/api/v2/notifications', auth: true, label: 'Notifications' }],
  },
  {
    page: '/org-settings',
    apis: [{ method: 'GET', path: '/api/v2/users/me', auth: true, label: 'Profile' }],
  },

  // ===== ORG-SCOPED PAGES =====
  {
    page: '/logistics',
    orgOnly: true,
    apis: [{ method: 'GET', path: '/api/v2/users/me', auth: true, label: 'Profile' }],
  },
  {
    page: '/briefings',
    orgOnly: true,
    apis: [{ method: 'GET', path: '/api/v2/briefings', auth: true, label: 'Briefings' }],
  },
];

// Add org-scoped fleet API test for users with orgs
const ORG_APIS = [
  { method: 'GET', path: '/api/v2/organizations/{orgId}/fleets', auth: true, label: 'Org fleets' },
  {
    method: 'GET',
    path: '/api/v2/organizations/{orgId}/activities',
    auth: true,
    label: 'Org activities',
  },
  {
    method: 'GET',
    path: '/api/v2/organizations/{orgId}/fleets',
    auth: true,
    label: 'Org fleets (2nd check)',
  },
];

async function testUser(username, description, orgId) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${description} (${username})`);
  console.log(`${'='.repeat(70)}`);

  let token;
  try {
    token = await login(username);
  } catch (e) {
    console.log(`  FATAL: ${e.message}`);
    return;
  }

  console.log(`  OrgId: ${orgId || 'NONE'}`);
  console.log(`${'─'.repeat(70)}`);

  let passed = 0,
    failed = 0,
    skipped = 0;

  for (const page of PAGES) {
    if (page.orgOnly && !orgId) {
      console.log(`  ⊘ SKIP  Page: ${page.page} (requires org)`);
      skipped++;
      continue;
    }

    let pageOk = true;
    for (const api of page.apis) {
      const tok = api.auth ? token : null;
      let path = api.path;
      if (orgId) path = path.replace('{orgId}', orgId);

      const res = await request(api.method, path, tok);
      const ok = res.status >= 200 && res.status < 300;
      if (!ok) pageOk = false;

      const symbol = ok ? '✓' : '✗';
      const errMsg = ok
        ? ''
        : ` — ${res.data?.message || res.data?.error || JSON.stringify(res.data).substring(0, 60)}`;
      console.log(`  ${symbol} ${res.status} [${page.page}] ${api.label}${errMsg}`);

      if (ok) passed++;
      else failed++;
    }
  }

  // Test org-scoped APIs if user has org
  if (orgId) {
    console.log(`  --- Org-scoped API checks ---`);
    for (const api of ORG_APIS) {
      const path = api.path.replace('{orgId}', orgId);
      const res = await request(api.method, path, token);
      const ok = res.status >= 200 && res.status < 300;
      const symbol = ok ? '✓' : '✗';
      const errMsg = ok ? '' : ` — ${res.data?.message || res.data?.error || ''}`;
      console.log(`  ${symbol} ${res.status} ${api.label}${errMsg}`);
      if (ok) passed++;
      else failed++;
    }
  }

  console.log(`  ─── Results: ${passed} passed, ${failed} failed, ${skipped} skipped ───`);
}

async function main() {
  console.log('Comprehensive Page & API Test Suite');
  console.log(`Testing against: ${BASE}\n`);

  // Test 3 roles
  await testUser('rsi_verified', '1. STANDALONE USER (no org)', null);
  await testUser(
    'star_cadet',
    '2. ORG MEMBER (Stardust Fleet)',
    '00000000-0000-4000-a000-000000000001'
  );
  await testUser(
    'admiral_chen',
    '3. ORG OWNER (Stardust Fleet)',
    '00000000-0000-4000-a000-000000000001'
  );

  // ===================== 4. DISCORD DASHBOARD (org owner) =====================
  console.log(`\n${'='.repeat(70)}`);
  console.log('  4. DISCORD DASHBOARD (admiral_chen — org owner)');
  console.log(`${'='.repeat(70)}`);
  {
    let token;
    try {
      token = await login('admiral_chen');
    } catch (e) {
      console.log(`  FATAL: ${e.message}`);
    }
    if (token) {
      const orgId = '00000000-0000-4000-a000-000000000001';
      const discordApis = [
        { method: 'GET', path: '/api/v2/users/me', label: 'User profile' },
        { method: 'GET', path: `/api/v2/organizations/${orgId}/fleets`, label: 'Org fleets' },
        // Discord settings page loads — frontend uses mock data, so we test the backend discord routes
        { method: 'GET', path: `/api/v2/discord/guilds/demo-guild`, label: 'Discord guild info' },
        {
          method: 'GET',
          path: `/api/orgs/${orgId}/discord/settings`,
          label: 'Discord org settings (v1)',
        },
      ];
      let passed = 0,
        failed = 0;
      for (const api of discordApis) {
        const res = await request(api.method, api.path, token);
        const ok = res.status >= 200 && res.status < 300;
        const symbol = ok ? '✓' : '✗';
        const errMsg = ok ? '' : ` — ${res.data?.message || res.data?.error || res.status}`;
        console.log(`  ${symbol} ${res.status} [/discord] ${api.label}${errMsg}`);
        if (ok) passed++;
        else failed++;
      }
      console.log(`  ─── Results: ${passed} passed, ${failed} failed ───`);
    }
  }

  // ===================== 5. ADMIN DASHBOARD =====================
  console.log(`\n${'='.repeat(70)}`);
  console.log('  5. ADMIN DASHBOARD (admin user)');
  console.log(`${'='.repeat(70)}`);
  {
    // Admin uses username/password login, not demo login
    let adminToken = null;
    const loginRes = await request('POST', '/api/v2/auth/login', null, {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'AdminPassword123!',
    });
    if (loginRes.data?.data?.accessToken) {
      adminToken = loginRes.data.data.accessToken;
    } else if (loginRes.data?.data?.token) {
      adminToken = loginRes.data.data.token;
    } else if (loginRes.data?.accessToken) {
      adminToken = loginRes.data.accessToken;
    } else if (loginRes.data?.token) {
      adminToken = loginRes.data.token;
    }

    if (!adminToken) {
      console.log(
        `  FATAL: Admin login failed: ${JSON.stringify(loginRes.data).substring(0, 120)}`
      );
    } else {
      const adminApis = [
        { method: 'GET', path: '/api/v2/users/me', label: 'Admin profile' },
        { method: 'GET', path: '/api/admin/dashboard', label: 'Admin dashboard' },
        { method: 'GET', path: '/api/v2/admin/metrics/system', label: 'System metrics' },
        { method: 'GET', path: '/api/v2/admin/metrics/user-actions', label: 'User action metrics' },
        {
          method: 'GET',
          path: '/api/v2/admin/metrics/timeseries?metric=users&timeRange=7d',
          label: 'Timeseries metrics',
        },
        { method: 'GET', path: '/api/v2/admin/security/logs', label: 'Security logs' },
        { method: 'GET', path: '/api/v2/admin/security/summary', label: 'Security summary' },
        { method: 'GET', path: '/api/v2/admin/feature-flags', label: 'Feature flags' },
        {
          method: 'GET',
          path: '/api/v2/admin/ship-data-fetcher/status',
          label: 'Ship data fetcher',
        },
        {
          method: 'GET',
          path: '/api/v2/admin/organizations/deletion-requests/pending',
          label: 'Pending deletions',
        },
      ];
      let passed = 0,
        failed = 0;
      for (const api of adminApis) {
        const res = await request(api.method, api.path, adminToken);
        const ok = res.status >= 200 && res.status < 300;
        const symbol = ok ? '✓' : '✗';
        const errMsg = ok ? '' : ` — ${res.data?.message || res.data?.error || res.status}`;
        console.log(`  ${symbol} ${res.status} [/admin] ${api.label}${errMsg}`);
        if (ok) passed++;
        else failed++;
      }
      console.log(`  ─── Results: ${passed} passed, ${failed} failed ───`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('  All page tests complete!');
  console.log(`${'='.repeat(70)}`);
}

main().catch(console.error);
