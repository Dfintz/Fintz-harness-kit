#!/usr/bin/env node

/**
 * validate-governance-roles.mjs
 *
 * Validates governance role assignments against required structure.
 * Used by Phase 3+ governance workflows to prevent role-assignment errors.
 *
 * Usage:
 *   node validate-governance-roles.mjs --roles-file <path>
 *   node validate-governance-roles.mjs --roles-json <json>
 *   Programmatic: validateGovernanceRoles(rolesObject)
 */

import fs from 'fs';
import path from 'path';

const REQUIRED_ROLES = [
  'techLead',
  'productLead',
  'engineeringManager',
  'decisionAuthority',
];

const ROLE_CONTACT_FIELDS = {
  techLead: ['name', 'email', 'slack'],
  productLead: ['name', 'email'],
  engineeringManager: ['name', 'email'],
  decisionAuthority: ['name', 'email'],
};

/**
 * Validate governance roles object
 * @param {object} roles - Roles object to validate
 * @returns {object} Validation result: { passed, errors, warnings }
 */
export function validateGovernanceRoles(roles) {
  const errors = [];
  const warnings = [];

  if (!roles || typeof roles !== 'object') {
    return {
      passed: false,
      errors: ['Roles must be a non-empty object'],
      warnings: [],
    };
  }

  // Check all required roles present
  for (const role of REQUIRED_ROLES) {
    if (!roles[role]) {
      errors.push(`Missing required role: ${role}`);
    }
  }

  // Validate each role's contact information
  for (const [role, value] of Object.entries(roles)) {
    if (!REQUIRED_ROLES.includes(role)) {
      warnings.push(`Unknown role: ${role} (not in required roles list)`);
      continue;
    }

    if (typeof value !== 'object') {
      errors.push(`Role ${role} must be an object, got ${typeof value}`);
      continue;
    }

    // Check name field (required for all roles)
    if (!value.name || typeof value.name !== 'string' || !value.name.trim()) {
      errors.push(`Role ${role}: name field is required and must be non-empty string`);
    }

    // Check contact fields (email preferred, at minimum one contact method)
    const requiredFields = ROLE_CONTACT_FIELDS[role] || ['email'];
    const hasEmail = value.email && typeof value.email === 'string' && value.email.trim();
    const hasSlack = value.slack && typeof value.slack === 'string' && value.slack.trim();
    const hasPhone = value.phone && typeof value.phone === 'string' && value.phone.trim();

    if (!hasEmail && !hasSlack && !hasPhone) {
      errors.push(
        `Role ${role}: must have at least one contact method (email, slack, or phone)`,
      );
    } else if (!hasEmail) {
      warnings.push(`Role ${role}: email not provided (recommended)`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Load roles from file
 */
function loadRolesFromFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error loading roles file: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Parse command-line arguments
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

/**
 * Main CLI entry point
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));

  let roles;
  if (args['roles-file']) {
    roles = loadRolesFromFile(args['roles-file']);
  } else if (args['roles-json']) {
    try {
      roles = JSON.parse(args['roles-json']);
    } catch (err) {
      console.error(`Error parsing roles JSON: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.error(
      'Usage: node validate-governance-roles.mjs --roles-file <path> | --roles-json <json>',
    );
    process.exit(1);
  }

  const result = validateGovernanceRoles(roles);

  console.log(JSON.stringify(result, null, 2));

  // Exit codes:
  // 0 = PASS
  // 1 = FAIL (blocking error)
  // 2 = WARN (non-blocking warnings)
  if (result.passed && result.warnings.length === 0) {
    console.log('\n✅ All governance roles valid');
    process.exit(0);
  } else if (result.passed && result.warnings.length > 0) {
    console.log('\n⚠️ Governance roles valid with warnings');
    process.exit(2);
  } else {
    console.log('\n❌ Governance roles validation failed');
    process.exit(1);
  }
}
