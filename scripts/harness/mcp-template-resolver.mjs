/**
 * Template expansion with var substitution and injection prevention
 * Implements shell escaping to prevent command injection
 * @module mcp-template-resolver
 */

/**
 * Shell-escape a value to prevent command injection
 * Uses Bash single-quote escaping: 'value' with internal quotes as '\''
 * @param {string} value - Value to escape
 * @returns {string} Shell-escaped value
 */
function shellEscape(value) {
  if (typeof value !== 'string') {
    throw new Error(`shellEscape: value must be string, got ${typeof value}`);
  }

  // Escape single quotes by ending quote, adding escaped quote, starting new quote
  // E.g., "it's" becomes 'it'"'"'s'
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * Validate template var name (alphanumeric + underscore only)
 * Prevents injection of shell metacharacters in var names
 * @param {string} varName - Variable name to validate
 * @returns {boolean} True if valid
 */
function isValidVarName(varName) {
  if (typeof varName !== 'string' || varName.length === 0) {
    return false;
  }
  // Pattern: must start with letter/underscore, followed by alphanumeric/underscore
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(varName);
}

/**
 * Parse command template for variables (${varName})
 * @param {string} template - Command template string
 * @returns {array} Array of var names found: ["filter", "timeout"]
 */
function parseVars(template) {
  if (typeof template !== 'string') {
    return [];
  }

  const vars = [];
  const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  let match;

  while ((match = varPattern.exec(template)) !== null) {
    vars.push(match[1]);
  }

  return [...new Set(vars)]; // Deduplicate
}

/**
 * Validate var request against command schema
 * Checks: required vars present, unknown vars rejected, type/range validation
 * @param {object} requestVars - Vars from request: {filter: "unit", timeout: 60}
 * @param {object} varSchema - Schema from command definition
 * @returns {object} {valid: boolean, errors: []}
 */
function validateVars(requestVars = {}, varSchema = {}) {
  const errors = [];
  const validated = {};

  // Check 1: All required vars present
  for (const [varName, varDef] of Object.entries(varSchema)) {
    if (varDef.required && !(varName in requestVars)) {
      errors.push(`required var missing: ${varName}`);
    }

    // Check 2: Validate type
    if (varName in requestVars) {
      const value = requestVars[varName];
      const expectedType = varDef.type || 'string';

      if (expectedType === 'string' && typeof value !== 'string') {
        errors.push(`var ${varName}: expected string, got ${typeof value}`);
      } else if (expectedType === 'number' && typeof value !== 'number') {
        errors.push(`var ${varName}: expected number, got ${typeof value}`);
      }

      // Check 3: Validate range (for numbers)
      if (expectedType === 'number' && typeof value === 'number') {
        if (varDef.min !== undefined && value < varDef.min) {
          errors.push(`var ${varName}: ${value} < min ${varDef.min}`);
        }
        if (varDef.max !== undefined && value > varDef.max) {
          errors.push(`var ${varName}: ${value} > max ${varDef.max}`);
        }
      }

      // Check 4: Validate pattern (for strings)
      if (expectedType === 'string' && typeof value === 'string' && varDef.pattern) {
        const pattern = new RegExp(`^${varDef.pattern}$`);
        if (!pattern.test(value)) {
          errors.push(`var ${varName}: "${value}" doesn't match pattern ${varDef.pattern}`);
        }
      }

      validated[varName] = value;
    }
  }

  // Check 5: Reject unknown vars (not in schema)
  for (const varName of Object.keys(requestVars)) {
    if (!(varName in varSchema)) {
      errors.push(`unknown var: ${varName} (not in schema)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validated,
  };
}

/**
 * Resolve template by substituting vars with shell-escaped values
 * @param {string} template - Command template with ${varName} placeholders
 * @param {object} vars - Variable values: {filter: "unit", timeout: 60}
 * @param {object} varSchema - Schema for type checking and escaping
 * @param {object} config - Optional config with .templates.maxVarSize
 * @returns {object} {resolved: string, error?: string}
 */
function resolveTemplate(template, vars = {}, varSchema = {}, config = {}) {
  if (typeof template !== 'string') {
    return { resolved: null, error: 'template must be string' };
  }

  // Enforce maxVarSize to prevent command-line overflow from large values
  const maxVarSize = config?.templates?.maxVarSize ?? 1000;
  for (const [k, v] of Object.entries(vars)) {
    if (String(v).length > maxVarSize) {
      return { resolved: null, error: `var ${k} exceeds maxVarSize (${maxVarSize})` };
    }
  }

  // Validate vars before substitution
  const validation = validateVars(vars, varSchema);
  if (!validation.valid) {
    return { resolved: null, error: validation.errors.join('; ') };
  }

  // Substitute ${varName} with shell-escaped value
  let resolved = template;
  const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

  resolved = resolved.replace(varPattern, (match, varName) => {
    const value = vars[varName];

    // Convert to string if needed (for numbers, booleans, etc.)
    const strValue = String(value);

    // Shell-escape the value to prevent injection
    return shellEscape(strValue);
  });

  return {
    resolved,
    error: null,
    varsUsed: Object.keys(validation.validated),
  };
}

/**
 * Get audit info for template resolution
 * Logs which vars were used (for compliance/debugging)
 * @param {string} template - Original template
 * @param {object} vars - Resolved var values
 * @param {object} resolved - Result from resolveTemplate()
 * @returns {object} Audit-safe template info
 */
function getTemplateAuditInfo(template, vars = {}, resolved = {}) {
  return {
    templateVars: parseVars(template),
    resolvedVars: Object.keys(vars),
    varCount: Object.keys(vars).length,
    success: !resolved.error,
  };
}

export {
  shellEscape,
  isValidVarName,
  parseVars,
  validateVars,
  resolveTemplate,
  getTemplateAuditInfo,
};
