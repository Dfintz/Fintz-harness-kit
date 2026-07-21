#!/usr/bin/env node
/**
 * Quick script to set the admin password for sysop_nexus in the database.
 * Run inside Docker: docker exec -e ADMIN_PASSWORD=YourPass sc-fleet-manager-backend-1 node /app/backend/scripts/set-admin-password.js
 */
const bcrypt = require('bcrypt');
const { Client } = require('pg');

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error('ADMIN_PASSWORD environment variable is required.');
    console.error('Usage: ADMIN_PASSWORD=YourSecurePass node set-admin-password.js');
    process.exit(1);
  }
  const hash = await bcrypt.hash(password, 10);
  console.log('Generated hash:', hash.substring(0, 10) + '...');

  const client = new Client({
    host: process.env.DB_HOST || 'db',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'dev_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'star_citizen_db',
  });

  if (!client.password) {
    console.error('DB_PASSWORD environment variable is required.');
    process.exit(1);
  }

  await client.connect();
  const result = await client.query('UPDATE users SET password = $1 WHERE username = $2', [
    hash,
    'sysop_nexus',
  ]);
  console.log('Updated rows:', result.rowCount);

  // Verify
  const verify = await client.query(
    'SELECT username, password IS NOT NULL as has_password FROM users WHERE username = $1',
    ['sysop_nexus']
  );
  console.log('Verify:', verify.rows[0]);

  await client.end();
  console.log('Done! Admin password updated for username=sysop_nexus');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
