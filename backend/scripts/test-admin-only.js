const http = require('http');
const https = require('https');
const BASE = process.env.BASE_URL || 'http://localhost:3000';

function request(method, path, token, body) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ status: 'TIMEOUT', data: '30s timeout' }), 30000);
    const url = new URL(path, BASE);
    const protocol = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (token) opts.headers.Authorization = `Bearer ${token}`;
    const payload = body ? JSON.stringify(body) : null;
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = protocol.request(opts, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => {
        clearTimeout(timer);
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', e => {
      clearTimeout(timer);
      resolve({ status: 0, data: e.message });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

async function main() {
  console.log('=== Admin-only endpoint test ===\n');

  // Get admin password from environment variable
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error(
      'FATAL: ADMIN_PASSWORD environment variable is not set.\n' +
        'Example usage: ADMIN_PASSWORD=your_password node scripts/test-admin-only.js'
    );
    process.exit(1);
  }

  // Login as admin
  const loginRes = await request('POST', '/api/v2/auth/login', null, {
    username: 'admin',
    password: adminPassword,
  });

  const token =
    loginRes.data?.data?.accessToken ||
    loginRes.data?.data?.token ||
    loginRes.data?.accessToken ||
    loginRes.data?.token;

  if (!token) {
    console.log('FATAL: Login failed:', JSON.stringify(loginRes.data).slice(0, 200));
    process.exit(1);
  }
  console.log('Admin login OK\n');

  const apis = [
    { method: 'GET', path: '/api/v2/users/me', label: 'Admin profile' },
    { method: 'GET', path: '/api/admin/dashboard', label: 'Admin dashboard' },
    { method: 'GET', path: '/api/v2/admin/metrics/system', label: 'System metrics' },
    { method: 'GET', path: '/api/v2/admin/metrics/user-actions', label: 'User action metrics' },
    { method: 'GET', path: '/api/v2/admin/metrics/timeseries', label: 'Timeseries metrics' },
    { method: 'GET', path: '/api/v2/admin/security/logs', label: 'Security logs' },
    { method: 'GET', path: '/api/v2/admin/security/summary', label: 'Security summary' },
    { method: 'GET', path: '/api/v2/admin/feature-flags', label: 'Feature flags' },
    { method: 'GET', path: '/api/v2/admin/ship-data-fetcher/status', label: 'Ship data fetcher' },
    {
      method: 'GET',
      path: '/api/v2/admin/organizations/deletion-requests/pending',
      label: 'Pending deletions',
    },
  ];

  let passed = 0,
    failed = 0;
  for (const api of apis) {
    const start = Date.now();
    const res = await request(api.method, api.path, token);
    const ms = Date.now() - start;
    const ok = typeof res.status === 'number' && res.status >= 200 && res.status < 300;
    const sym = ok ? 'PASS' : 'FAIL';
    const detail = ok ? '' : ` -- ${JSON.stringify(res.data).slice(0, 100)}`;
    console.log(`  ${sym} ${res.status} (${ms}ms) ${api.label} [${api.path}]${detail}`);
    if (ok) passed++;
    else failed++;
  }
  console.log(`\n  Results: ${passed} passed, ${failed} failed`);
}

main().catch(console.error);
