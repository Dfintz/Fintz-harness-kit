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

let cached;

/** Load harness.config.json once. Returns {} when absent or invalid. */
export function loadConfig() {
  if (cached) return cached;
  if (!existsSync(CONFIG_PATH)) {
    cached = {};
    return cached;
  }
  try {
    cached = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
  } catch (error) {
    process.stderr.write(
      `[harness-config] invalid harness.config.json: ${error instanceof Error ? error.message : String(error)}\n`,
    );
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
