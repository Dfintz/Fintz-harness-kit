/**
 * Auth framework: Extract and validate caller identity from MCP context
 * Phase 2a: Logging only (no enforcement); enforcement in Phase 2c
 * @module mcp-auth-validator
 */

/**
 * Extract caller identity from MCP request context
 * Phase 2a: Extracts fields; validation logic added in Phase 2c
 * @param {object} mpcContext - MCP request context with caller metadata
 * @returns {object} {callerId, token, role, valid, errors}
 */
function extractCallerIdentity(mcpContext = {}) {
  const caller = mcpContext?.caller || {};
  const token = caller?.token || '';
  const role = caller?.role || 'auditor'; // Default to auditor (least privilege) for unauthenticated callers

  // Phase 2a validation: Only check presence and format
  // Phase 2c will add JWT decode, token signing verification, etc.
  const errors = [];
  let valid = true;

  // Check 1: Token format (non-empty string if provided)
  if (token && typeof token !== 'string') {
    errors.push('auth.token must be a string');
    valid = false;
  }

  // Check 2: Role must be one of known roles
  const validRoles = ['executor', 'auditor', 'restricted'];
  if (!validRoles.includes(role)) {
    errors.push(`auth.role must be one of: ${validRoles.join(', ')}`);
    valid = false;
  }

  // Extract caller ID (use first 16 chars of token if available, else 'anonymous')
  const callerId = (token && typeof token === 'string') ? `caller-${token.substring(0, 16)}` : 'anonymous';

  return {
    callerId,
    token,
    role,
    valid,
    errors,
  };
}

/**
 * Validate caller is authorized for a command
 * Phase 2a: Always returns true (no enforcement); enforcement in Phase 2c
 * @param {object} caller - Caller identity from extractCallerIdentity()
 * @param {string} commandName - Name of command being dispatched
 * @param {object} config - Config with .auth.rolePermissions
 * @returns {object} {authorized, reason}
 */
function isAuthorized(caller, commandName, config = {}) {
  // Phase 2a: Logging-only; all callers pass through
  // Phase 2c will check role permissions and command whitelist

  return {
    authorized: true,
    reason: 'phase-2a-logging-only',
  };
}

/**
 * Get caller info for audit logging
 * @param {object} caller - Caller identity from extractCallerIdentity()
 * @returns {object} Audit-safe caller object {id, tokenHash, role, authorized}
 */
function getCallerAuditInfo(caller, commandName, config) {
  const auth = isAuthorized(caller, commandName, config);

  // Hash token for audit (only show last 8 chars preceded by ..., not full token)
  const tokenHash = caller.token && typeof caller.token === 'string' 
    ? `...${caller.token.substring(caller.token.length - 8)}`
    : null;

  return {
    id: caller.callerId,
    tokenHash,
    role: caller.role,
    authorized: auth.authorized,
  };
}

export { extractCallerIdentity, isAuthorized, getCallerAuditInfo };
