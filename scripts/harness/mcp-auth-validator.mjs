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
  let teams = [];
  if (Array.isArray(caller?.teams)) {
    teams = caller.teams;
  } else if (typeof caller?.team === 'string') {
    teams = caller.team.split(',').map((item) => item.trim()).filter(Boolean);
  }

  // Phase 2a validation: Only check presence and format
  // Phase 2c will add JWT decode, token signing verification, etc.
  const errors = [];
  let valid = true;

  // Check 1: Token format (non-empty string if provided)
  if (token && typeof token !== 'string') {
    errors.push('auth.token must be a string');
    valid = false;
  }

  // Check 2: Role must be a non-empty string
  if (typeof role !== 'string' || role.trim().length === 0) {
    errors.push('auth.role must be a non-empty string');
    valid = false;
  }

  // Extract caller ID with explicit id/userId precedence
  let explicitId = null;
  if (typeof caller?.id === 'string' && caller.id.trim().length > 0) {
    explicitId = caller.id.trim();
  } else if (typeof caller?.userId === 'string' && caller.userId.trim().length > 0) {
    explicitId = caller.userId.trim();
  }
  const callerId = explicitId || ((token && typeof token === 'string') ? `caller-${token.substring(0, 16)}` : 'anonymous');

  return {
    callerId,
    token,
    role,
    teams,
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
    teams: Array.isArray(caller.teams) ? caller.teams : [],
    authorized: auth.authorized,
  };
}

/**
 * Validate issuer binding for OAuth client metadata.
 * Phase 2e: deterministic binding check used by HTTP adapter hardening endpoint.
 * @param {object} metadata - Client metadata payload.
 * @param {object} options - Validation options.
 * @returns {object} {ok, issuerBound, expectedIssuer, receivedIssuer, errors}
 */
function validateIssuerBinding(metadata = {}, options = {}) {
  const expectedIssuer = typeof options.expectedIssuer === 'string' ? options.expectedIssuer.trim() : '';
  const requireIssuerBinding = options.requireIssuerBinding !== false;

  let receivedIssuer = '';
  if (typeof metadata?.issuer === 'string') {
    receivedIssuer = metadata.issuer.trim();
  } else if (typeof metadata?.client_metadata_issuer === 'string') {
    receivedIssuer = metadata.client_metadata_issuer.trim();
  }

  const errors = [];

  if (!expectedIssuer) {
    errors.push('Expected issuer is not configured');
  }

  if (requireIssuerBinding && !receivedIssuer) {
    errors.push('Client metadata issuer is required when issuer binding is enabled');
  }

  if (requireIssuerBinding && expectedIssuer && receivedIssuer && receivedIssuer !== expectedIssuer) {
    errors.push(`Issuer mismatch. Expected ${expectedIssuer} but received ${receivedIssuer}`);
  }

  return {
    ok: errors.length === 0,
    issuerBound: errors.length === 0,
    expectedIssuer,
    receivedIssuer: receivedIssuer || null,
    errors,
  };
}

export { extractCallerIdentity, isAuthorized, getCallerAuditInfo, validateIssuerBinding };
