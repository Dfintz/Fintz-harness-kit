#!/usr/bin/env node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));

function runLoaderWithConfig(configPath) {
  const script = [
    "import { loadConfig } from './scripts/harness/config.mjs';",
    "const config = loadConfig();",
    "process.stdout.write(JSON.stringify(config));",
  ].join(" ");

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HARNESS_CONFIG_PATH: configPath,
    },
    encoding: "utf8",
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function main() {
  const workDir = mkdtempSync(join(tmpdir(), "harness-config-self-test-"));
  const failures = [];

  try {
    const validPath = join(workDir, "valid.config.json");
    const invalidSchemaPath = join(workDir, "invalid-schema.config.json");
    const missingPath = join(workDir, "missing.config.json");

    writeFileSync(
      validPath,
      `${JSON.stringify({
        project: { name: "demo", description: "demo" },
        commands: { smoke: "node -v" },
      })}\n`,
      "utf8",
    );

    writeFileSync(
      invalidSchemaPath,
      `${JSON.stringify({
        project: "not-an-object",
        commands: { smoke: 42 },
      })}\n`,
      "utf8",
    );

    const validResult = runLoaderWithConfig(validPath);
    assert(validResult.status === 0, "valid config should exit 0", failures);
    assert(
      validResult.stdout.trim().startsWith('{"project":'),
      "valid config should load as object",
      failures,
    );

    const invalidResult = runLoaderWithConfig(invalidSchemaPath);
    assert(invalidResult.status === 0, "schema-invalid config should not crash", failures);
    assert(
      invalidResult.stdout.trim() === "{}",
      "schema-invalid config should degrade to {}",
      failures,
    );
    assert(
      invalidResult.stderr.includes("schema validation failed"),
      "schema-invalid config should emit schema validation diagnostics",
      failures,
    );

    const missingResult = runLoaderWithConfig(missingPath);
    assert(missingResult.status === 0, "missing config should not crash", failures);
    assert(
      missingResult.stdout.trim() === "{}",
      "missing config should degrade to {}",
      failures,
    );
    assert(
      missingResult.stderr.includes("config file not found"),
      "missing config should emit actionable not-found diagnostics",
      failures,
    );

    if (failures.length > 0) {
      process.stderr.write("[config-self-test] FAIL\n");
      for (const failure of failures) {
        process.stderr.write(`- ${failure}\n`);
      }
      process.exit(1);
    }

    process.stdout.write("[config-self-test] PASS\n");
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

main();
