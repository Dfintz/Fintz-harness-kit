#!/usr/bin/env node
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  exportAgentPlugin,
  validateAgentPlugin,
} from "../agent-plugins-export.mjs";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..", "..");
const outputRoot = mkdtempSync(join(tmpdir(), "harness-agent-plugin-test-"));

try {
  const packageRoot = join(outputRoot, "plugin");
  const result = exportAgentPlugin({ outputRoot: packageRoot });

  assert.equal(result.pluginName, "harness-kit");
  assert.deepEqual(result.skills, ["wait-what"]);
  assert.equal(existsSync(join(packageRoot, "mcp.json")), false);
  assert.equal(existsSync(join(packageRoot, "skills", "wait-what", "SKILL.md")), true);

  const manifest = JSON.parse(readFileSync(join(packageRoot, "plugin.json"), "utf8"));
  assert.equal(
    manifest.$schema,
    "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
  );
  assert.equal(manifest.name, "harness-kit");
  assert.equal(validateAgentPlugin({ packageRoot }).ok, true);

  writeFileSync(join(packageRoot, "mcp.json"), "{}\n", "utf8");
  assert.equal(validateAgentPlugin({ packageRoot }).ok, false);
  rmSync(join(packageRoot, "mcp.json"));

  const exportedSkill = readFileSync(
    join(packageRoot, "skills", "wait-what", "SKILL.md"),
    "utf8",
  );
  assert.equal(
    exportedSkill,
    readFileSync(join(repoRoot, ".github", "skills", "wait-what", "SKILL.md"), "utf8"),
  );

  writeFileSync(join(packageRoot, "skills", "wait-what", "SKILL.md"), `${exportedSkill}\ntampered\n`, "utf8");
  assert.equal(validateAgentPlugin({ packageRoot }).ok, false);
  writeFileSync(join(packageRoot, "skills", "wait-what", "SKILL.md"), exportedSkill, "utf8");

  const manifestPath = join(packageRoot, "plugin.json");
  const originalManifest = readFileSync(manifestPath, "utf8");
  writeFileSync(manifestPath, originalManifest.replace("Portable skills-only", "Tampered skills-only"), "utf8");
  assert.equal(validateAgentPlugin({ packageRoot }).ok, false);
  writeFileSync(manifestPath, originalManifest, "utf8");

  rmSync(join(packageRoot, "skills", "wait-what", "SKILL.md"));
  assert.equal(validateAgentPlugin({ packageRoot }).ok, false);

  console.log("[agent-plugins-export-test] PASS");
} finally {
  rmSync(outputRoot, { recursive: true, force: true });
}
