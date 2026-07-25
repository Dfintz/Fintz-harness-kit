#!/usr/bin/env node

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const validateScript = path.join(__dirname, "validate-skills.mjs");

function printUsage() {
  console.log(`Phase 5 operations

Usage:
  node scripts/harness/phase5/ops.mjs validate-all
  node scripts/harness/phase5/ops.mjs check-tier-shifts
  node scripts/harness/phase5/ops.mjs cascade-health
  node scripts/harness/phase5/ops.mjs monitor [--interval 30s]
  node scripts/harness/phase5/ops.mjs compare-baseline
  node scripts/harness/phase5/ops.mjs model-consistency`);
}

function parseInterval(rawValue) {
  if (!rawValue) {
    return null;
  }

  const match = /^(\d+)(ms|s|m)?$/i.exec(rawValue);
  if (!match) {
    throw new Error(`Unsupported interval value: ${rawValue}`);
  }

  const value = Number.parseInt(match[1], 10);
  const unit = (match[2] || "ms").toLowerCase();

  if (unit === "ms") {
    return value;
  }
  if (unit === "s") {
    return value * 1000;
  }
  if (unit === "m") {
    return value * 60_000;
  }

  throw new Error(`Unsupported interval unit: ${unit}`);
}

function runValidator(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [validateScript, ...args], {
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Phase 5 validator exited with code ${code ?? "unknown"}`));
    });

    child.on("error", reject);
  });
}

async function runMonitor(restArgs) {
  const intervalIndex = restArgs.indexOf("--interval");
  const interval = intervalIndex >= 0 ? parseInterval(restArgs[intervalIndex + 1]) : null;
  let keepRunning = true;

  process.on("SIGINT", () => {
    keepRunning = false;
  });
  process.on("SIGTERM", () => {
    keepRunning = false;
  });

  if (!interval) {
    await runValidator(["--metrics"]);
    return;
  }

  console.log(`Phase 5 monitor active. Refresh interval: ${interval}ms`);
  while (keepRunning) {
    console.log(`\n[${new Date().toISOString()}] Phase 5 status`);
    await runValidator(["--metrics"]);
    await delay(interval);
  }
}

async function main() {
  const [command, ...restArgs] = process.argv.slice(2);

  switch (command) {
    case "validate-all":
      await runValidator([]);
      return;
    case "check-tier-shifts":
      console.log("Inspecting Phase 5 tier-shift metrics from the latest validation results...");
      await runValidator(["--metrics"]);
      return;
    case "cascade-health":
      console.log("Checking Phase 5 fallback cascade health from the latest validation results...");
      await runValidator(["--collect-only"]);
      return;
    case "monitor":
      await runMonitor(restArgs);
      return;
    case "compare-baseline":
      console.log("Reviewing Phase 5 performance against the Phase 4 baseline from the latest validation results...");
      await runValidator(["--metrics"]);
      return;
    case "model-consistency":
      console.log("Reviewing Phase 5 model consistency from the latest validation results...");
      await runValidator(["--metrics"]);
      return;
    default:
      printUsage();
      process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(`❌ ${error.message}`);
  process.exit(1);
}