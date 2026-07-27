#!/usr/bin/env node
/**
 * Harness configuration loader + token resolver.
 *
 * Makes the harness project-agnostic: loop definitions and scripts reference
 * `{{dotted.path}}` tokens that are resolved from harness.config.json at run time.
 * A project adopts the harness by editing harness.config.json only — no script edits.
 *
 * Unresolved tokens are left intact (with a stderr warning) so that:
 *   - a loop can still inline a literal command instead of a token, and
 *   - a partial/missing config degrades gracefully instead of crashing a loop.
 *
 * Part of the harness-kit. See CREDITS.md for upstream inspirations.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// repoRoot defaults to harness-kit root, but can be overridden at runtime.
// Resolution order:
// 1) HARNESS_REPO_ROOT (absolute or relative)
// 2) process.cwd() when it contains harness.config.json
// 3) script default (two levels up from scripts/harness)
const defaultRepoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
export const harnessRuntimeRoot = defaultRepoRoot;

function resolveRuntimeRepoRoot() {
  const envRoot = process.env.HARNESS_REPO_ROOT;
  if (typeof envRoot === "string" && envRoot.trim().length > 0) {
    return resolve(envRoot.trim());
  }

  const cwdRoot = resolve(process.cwd());
  if (existsSync(join(cwdRoot, "harness.config.json"))) {
    return cwdRoot;
  }

  return defaultRepoRoot;
}

export const repoRoot = resolveRuntimeRepoRoot();

const configuredConfigPath = process.env.HARNESS_CONFIG_PATH;
export const CONFIG_PATH =
  typeof configuredConfigPath === "string" &&
  configuredConfigPath.trim().length > 0
    ? resolve(configuredConfigPath.trim())
    : join(repoRoot, "harness.config.json");
const SCHEMA_PATH = join(repoRoot, "harness.config.schema.json");

let cached;
let cachedSchema;

function parseBooleanEnv(value) {
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function strictConfigModeEnabled() {
  return parseBooleanEnv(process.env.HARNESS_CONFIG_STRICT);
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function normalizePath(path) {
  return path.length > 0 ? path : "$";
}

function readSchema() {
  if (cachedSchema) return cachedSchema;
  if (!existsSync(SCHEMA_PATH)) {
    throw new Error(`schema file not found at ${SCHEMA_PATH}`);
  }
  const parsed = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  if (!isPlainObject(parsed)) {
    throw new Error("schema root must be an object");
  }
  cachedSchema = parsed;
  return cachedSchema;
}

function addIssue(issues, path, expected, actual, reason) {
  issues.push({ path: normalizePath(path), expected, actual, reason });
}

function childPath(path, key) {
  return path ? `${path}.${key}` : key;
}

function validateEnum(value, schema, path, issues) {
  if (!Array.isArray(schema.enum) || schema.enum.length === 0) return true;
  if (schema.enum.includes(value)) return true;
  addIssue(
    issues,
    path,
    `one of [${schema.enum.join(", ")}]`,
    JSON.stringify(value),
    "value is not in the allowed enum set",
  );
  return false;
}

function validateExpectedType(value, schema, path, issues) {
  if (typeof schema.type !== "string") return true;

  const expectedType = schema.type;
  const actualType = describeType(value);

  if (expectedType === "object" && !isPlainObject(value)) {
    addIssue(issues, path, "object", actualType, "type mismatch");
    return false;
  }

  if (expectedType === "array" && !Array.isArray(value)) {
    addIssue(issues, path, "array", actualType, "type mismatch");
    return false;
  }

  if (expectedType !== "object" && expectedType !== "array" && actualType !== expectedType) {
    addIssue(issues, path, expectedType, actualType, "type mismatch");
    return false;
  }

  return true;
}

function validateRequiredObjectProperties(value, schema, path, issues) {
  if (schema.type !== "object" || !isPlainObject(value) || !Array.isArray(schema.required)) {
    return;
  }

  for (const key of schema.required) {
    if (typeof key !== "string" || key in value) continue;
    addIssue(
      issues,
      childPath(path, key),
      "present",
      "missing",
      "required property is missing",
    );
  }
}

function validateObjectChildren(value, schema, path, issues) {
  if (schema.type !== "object" || !isPlainObject(value)) return;

  const knownProperties = isPlainObject(schema.properties) ? schema.properties : {};
  for (const [key, childSchema] of Object.entries(knownProperties)) {
    if (!(key in value)) continue;
    validateSchemaNode(value[key], childSchema, childPath(path, key), issues);
  }

  const additionalProperties = schema.additionalProperties;
  for (const [key, childValue] of Object.entries(value)) {
    if (Object.hasOwn(knownProperties, key)) continue;
    const pathForChild = childPath(path, key);
    if (additionalProperties === false) {
      addIssue(
        issues,
        pathForChild,
        "no additional properties",
        "present",
        "property is not allowed",
      );
      continue;
    }
    if (isPlainObject(additionalProperties)) {
      validateSchemaNode(childValue, additionalProperties, pathForChild, issues);
    }
  }
}

function validateArrayItems(value, schema, path, issues) {
  if (schema.type !== "array" || !Array.isArray(value) || !isPlainObject(schema.items)) {
    return;
  }

  for (let index = 0; index < value.length; index += 1) {
    validateSchemaNode(value[index], schema.items, `${path}[${index}]`, issues);
  }
}

function validateSchemaNode(value, schema, path, issues) {
  if (!isPlainObject(schema)) return;
  if (!validateEnum(value, schema, path, issues)) return;
  if (!validateExpectedType(value, schema, path, issues)) return;
  validateRequiredObjectProperties(value, schema, path, issues);
  validateObjectChildren(value, schema, path, issues);
  validateArrayItems(value, schema, path, issues);
}

function renderValidationIssues(issues) {
  return issues
    .map((issue) => {
      const reasonText = issue.reason ? ` (${issue.reason})` : "";
      return `  - ${issue.path}: expected ${issue.expected}, got ${issue.actual}${reasonText}`;
    })
    .join("\n");
}

export function validateConfigObject(config, schema = readSchema()) {
  const issues = [];
  validateSchemaNode(config, schema, "", issues);
  return {
    valid: issues.length === 0,
    issues,
  };
}

/** Load harness.config.json once. Returns {} when absent or invalid. */
export function loadConfig() {
  if (cached) return cached;
  if (!existsSync(CONFIG_PATH)) {
    process.stderr.write(
      `[harness-config] config file not found at ${CONFIG_PATH}; using empty config {}\n`,
    );
    cached = {};
    return cached;
  }

  const strictMode = strictConfigModeEnabled();

  try {
    const parsed = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
    try {
      const verdict = validateConfigObject(parsed);
      if (!verdict.valid) {
        process.stderr.write(
          `[harness-config] schema validation failed for ${CONFIG_PATH}\n${renderValidationIssues(verdict.issues)}\n[harness-config] fix harness.config.json or set HARNESS_CONFIG_STRICT=1 to fail fast\n`,
        );
        if (strictMode) {
          throw new Error("schema validation failed");
        }
        cached = {};
        return cached;
      }
      cached = parsed;
      return cached;
    } catch (validationError) {
      process.stderr.write(
        `[harness-config] validator error: ${validationError instanceof Error ? validationError.message : String(validationError)}\n`,
      );
      if (strictMode) {
        throw validationError;
      }
      cached = {};
      return cached;
    }
  } catch (error) {
    process.stderr.write(
      `[harness-config] invalid harness.config.json: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    if (strictMode) {
      throw error;
    }
    cached = {};
  }
  return cached;
}

function getByPath(object, dottedKey) {
  return dottedKey
    .split(".")
    .reduce(
      (acc, key) => (acc === null || acc === undefined ? undefined : acc[key]),
      object,
    );
}

/**
 * Replace `{{ dotted.path }}` tokens in a string using the loaded config.
 * Non-string input is returned unchanged. Unmatched tokens are preserved and warned about.
 */
export function resolveTokens(input, config = loadConfig()) {
  if (typeof input !== "string" || !input.includes("{{")) return input;
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key) => {
    const value = getByPath(config, key);
    if (value === undefined || value === null) {
      process.stderr.write(
        `[harness-config] unresolved token ${whole} — set "${key}" in harness.config.json\n`,
      );
      return whole;
    }
    return String(value);
  });
}

/** Convenience accessor: resolveValue('ollama.model', 'fallback'). */
export function resolveValue(
  dottedKey,
  fallback = undefined,
  config = loadConfig(),
) {
  const value = getByPath(config, dottedKey);
  return value === undefined || value === null ? fallback : value;
}
