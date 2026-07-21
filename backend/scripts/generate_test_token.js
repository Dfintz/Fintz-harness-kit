#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
// Load environment variables from backend/.env if present, then fallback to process env
try {
  const dotenvPath = path.resolve(__dirname, '..', '.env');
  if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath });
  } else {
    require('dotenv').config();
  }
} catch (e) {
  // ignore
}

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate Test JWT Token
 * 
 * Usage:
 *   node scripts/generate_test_token.js [options]
 * 
 * Options:
 *   --id=<user-id>           User ID (default: 'test-user')
 *   --userId=<user-id>       Alias for --id
 *   --username=<username>    Username (default: 'testuser')
 *   --role=<role>            User role (default: 'user')
 *   --expiresIn=<duration>   Token expiration (default: '24h')
 *   --expiry=<duration>      Alias for --expiresIn
 *   --secret=<secret>        JWT secret (falls back to JWT_SECRET env var)
 * 
 * Development Workflow:
 *   1. Create a .env file in backend/ directory with JWT_SECRET
 *   2. Run this script to generate tokens for testing
 *   3. Use the token in Authorization header for API requests
 * 
 * Example:
 *   echo "JWT_SECRET=$(openssl rand -base64 32)" > backend/.env
 *   node scripts/generate_test_token.js --id=user-123 --username=testuser
 * 
 * Security Note:
 *   Hardcoded secrets are disallowed per CWE-798. Always use environment
 *   variables or command-line arguments for the JWT secret.
 */

// Simple arg parsing
const args = process.argv.slice(2);
const opts = {};
args.forEach(a => {
  const m = a.match(/^--([^=]+)=?(.*)$/);
  if (m) opts[m[1]] = m[2] || true;
});

const id = opts.id || opts.userId || 'test-user';
const username = opts.username || 'testuser';
const role = opts.role || 'user';
const expiresIn = opts.expiresIn || opts.expiry || '24h';

const jwtSecret = opts.secret || process.env.JWT_SECRET;

if (!jwtSecret) {
  console.error(
    'Missing JWT secret. Provide via env JWT_SECRET or --secret=your-32-char-secret. Hardcoded defaults are disallowed (CWE-798).'
  );
  process.exit(1);
}

if (jwtSecret.length < 32) {
  console.error('JWT secret must be at least 32 characters for security.');
  process.exit(1);
}

const payload = { id, username, role };
const jti = crypto.randomUUID();

const token = jwt.sign(payload, jwtSecret, {
  expiresIn,
  jwtid: jti,
});

console.log('\n=== Test JWT Token Generated ===\n');
console.log(token);
console.log('\n=== Details ===');
console.log('user id:', id);
console.log('username:', username);
console.log('role:', role);
console.log('expiresIn:', expiresIn);
console.log('\nUse with Authorization header:');
console.log('  Authorization: Bearer ' + token + '\n');
console.log('Example curl (GET user ships):');
console.log(
  `  curl -H "Authorization: Bearer ${token}" http://localhost:3000/api/users/${id}/ships`
);
