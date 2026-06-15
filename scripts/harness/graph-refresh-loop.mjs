#!/usr/bin/env node
/**
 * Continuous refresh loop for deterministic graph updates.
 * Intended for optional Docker sidecar usage.
 */
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const refreshScript = resolve(
  repoRoot,
  "scripts",
  "harness",
  "refresh-graph.mjs",
);

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      flags._.push(arg);
      continue;
    }

    if (arg === "--help") {
      flags.help = true;
      continue;
    }

    if (
      arg === "--run-once" ||
      arg === "--commit" ||
      arg === "--with-local-state" ||
      arg === "--preflight-only"
    ) {
      flags[arg.slice(2)] = true;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] = next;
    i += 1;
  }
  return flags;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "y"
  ) {
    return true;
  }
  if (
    normalized === "0" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "n"
  ) {
    return false;
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((resolveSleep) => {
    setTimeout(resolveSleep, ms);
  });
}

function runRefresh(options) {
  const args = [refreshScript, "--plugin-root", options.pluginRoot];
  if (options.commit) args.push("--commit");
  if (options.withLocalState) args.push("--with-local-state");
  if (options.commitMessage)
    args.push("--commit-message", options.commitMessage);

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 256 * 1024 * 1024,
  });

  const stamp = new Date().toISOString();
  if (result.status === 0) {
    process.stdout.write(`[graph-refresh-loop] ${stamp} refresh succeeded\n`);
    const output = (result.stdout || "").trim();
    if (output) process.stdout.write(`${output}\n`);
    return 0;
  }

  const reason =
    result.signal === undefined || result.signal === null
      ? `exit ${result.status ?? "unknown"}`
      : `signal ${result.signal}`;
  process.stderr.write(
    `[graph-refresh-loop] ${stamp} refresh failed (${reason})\n`,
  );
  if (result.error) process.stderr.write(`${result.error.message}\n`);
  if (result.stdout) process.stderr.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  return result.status ?? 1;
}

function runPluginInstall(runtimePluginRoot) {
  const timeoutMs = Number(
    process.env.GRAPH_REFRESH_BOOTSTRAP_INSTALL_TIMEOUT_MS || 120000,
  );
  process.stdout.write(
    "[graph-refresh-loop] installing plugin dependencies (corepack pnpm)\n",
  );
  const started = Date.now();
  const install = spawnSync(
    "corepack",
    ["pnpm", "install", "--frozen-lockfile"],
    {
      cwd: runtimePluginRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      timeout: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 120000,
    },
  );

  if (install.status !== 0) {
    if (install.signal) {
      throw new Error(
        `Plugin bootstrap install interrupted by signal: ${install.signal}. ` +
          "Action: verify plugin lockfile integrity and run corepack pnpm install in plugin checkout.",
      );
    }
    const details = (install.stderr || install.stdout || "")
      .trim()
      .slice(-2000);
    throw new Error(
      `Plugin bootstrap install failed: ${details || install.status}`,
    );
  }

  process.stdout.write(
    `[graph-refresh-loop] plugin dependency install completed in ${Date.now() - started}ms\n`,
  );
}

function probePluginDependencyResolution(pluginRoot) {
  const schemaPath = resolve(
    pluginRoot,
    "packages",
    "core",
    "dist",
    "schema.js",
  );
  if (!existsSync(schemaPath)) {
    return {
      ok: false,
      error: `Missing schema entry for dependency probe: ${schemaPath}`,
    };
  }

  const schemaUrl = pathToFileURL(schemaPath).href;
  const probeScript =
    "import(process.argv[1]).then(()=>process.exit(0)).catch(err=>{console.error(err && err.message ? err.message : String(err));process.exit(1);});";
  const probe = spawnSync(process.execPath, ["-e", probeScript, schemaUrl], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (probe.status === 0) {
    return { ok: true };
  }

  return {
    ok: false,
    error:
      (probe.stderr || probe.stdout || "").trim() ||
      `exit ${probe.status ?? "unknown"}`,
  };
}

function runPreflight(options) {
  const requiredPluginPaths = [
    resolve(options.pluginRoot, "skills", "understand", "scan-project.mjs"),
    resolve(
      options.pluginRoot,
      "skills",
      "understand",
      "extract-import-map.mjs",
    ),
    resolve(options.pluginRoot, "packages", "core", "dist", "index.js"),
  ];

  for (const requiredPath of requiredPluginPaths) {
    if (!existsSync(requiredPath)) {
      throw new Error(
        `Missing required plugin file: ${requiredPath}. ` +
          "Action: verify UNDERSTAND_PLUGIN_ROOT points to a built Understand plugin checkout.",
      );
    }
  }

  const bootstrapByDefault = options.pluginRoot.startsWith(
    "/opt/understand-plugin",
  );
  const shouldBootstrap = parseBoolean(
    process.env.GRAPH_REFRESH_BOOTSTRAP_PLUGIN,
    bootstrapByDefault,
  );
  const sourceResolution = probePluginDependencyResolution(options.pluginRoot);

  if (!sourceResolution.ok && !shouldBootstrap) {
    throw new Error(
      `Plugin dependencies are not resolvable from source root: ${sourceResolution.error}. ` +
        "Action: run corepack pnpm install in plugin checkout or enable GRAPH_REFRESH_BOOTSTRAP_PLUGIN=true.",
    );
  }

  if (!sourceResolution.ok && shouldBootstrap) {
    throw new Error(
      `Plugin dependencies are not resolvable from source root: ${sourceResolution.error}. ` +
        "Action: run corepack pnpm install in plugin checkout so source plugin resolves directly, or use host execution for graph refresh.",
    );
  }

  if (!shouldBootstrap) {
    process.stdout.write(
      "[graph-refresh-loop] preflight ok (bootstrap disabled)\n",
    );
    return { sourceDepsResolvable: sourceResolution.ok };
  }

  const corepackCheck = spawnSync("corepack", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (corepackCheck.status !== 0) {
    throw new Error(
      "corepack is not available in runtime. Action: use image with corepack or disable bootstrap and run host refresh.",
    );
  }

  const runtimePluginRoot = resolve(
    process.env.GRAPH_REFRESH_RUNTIME_PLUGIN_ROOT ||
      resolve(repoRoot, ".cache", "understand-plugin-runtime"),
  );
  mkdirSync(runtimePluginRoot, { recursive: true });
  const probePath = resolve(runtimePluginRoot, ".preflight-write-probe");
  writeFileSync(probePath, "ok\n");
  rmSync(probePath, { force: true });

  process.stdout.write(
    `[graph-refresh-loop] preflight ok (bootstrap=${shouldBootstrap ? "on" : "off"}, runtimeRoot=${runtimePluginRoot})\n`,
  );

  return { sourceDepsResolvable: sourceResolution.ok };
}

function preparePluginRuntime(options) {
  const sourcePluginRoot = options.pluginRoot;
  const bootstrapByDefault = sourcePluginRoot.startsWith(
    "/opt/understand-plugin",
  );
  const shouldBootstrap = parseBoolean(
    process.env.GRAPH_REFRESH_BOOTSTRAP_PLUGIN,
    bootstrapByDefault,
  );

  if (!shouldBootstrap) {
    return sourcePluginRoot;
  }

  const forceBootstrap = parseBoolean(
    process.env.GRAPH_REFRESH_FORCE_BOOTSTRAP,
    false,
  );
  const sourceNodeModulesPath = resolve(sourcePluginRoot, "node_modules");
  if (
    !forceBootstrap &&
    options.sourceDepsResolvable &&
    existsSync(sourceNodeModulesPath)
  ) {
    process.stdout.write(
      "[graph-refresh-loop] source plugin already has node_modules; skipping runtime bootstrap copy\n",
    );
    return sourcePluginRoot;
  }

  const runtimePluginRoot = resolve(
    process.env.GRAPH_REFRESH_RUNTIME_PLUGIN_ROOT ||
      resolve(repoRoot, ".cache", "understand-plugin-runtime"),
  );
  const markerPath = resolve(runtimePluginRoot, ".bootstrap-meta.json");

  let marker = null;
  if (existsSync(markerPath)) {
    try {
      marker = JSON.parse(readFileSync(markerPath, "utf8"));
    } catch {
      marker = null;
    }
  }

  const nodeModulesPath = resolve(runtimePluginRoot, "node_modules");
  const alreadyHydrated =
    marker?.sourcePluginRoot === sourcePluginRoot &&
    existsSync(nodeModulesPath);
  if (alreadyHydrated) {
    process.stdout.write(
      "[graph-refresh-loop] reusing hydrated plugin runtime\n",
    );
    return runtimePluginRoot;
  }

  process.stdout.write(
    "[graph-refresh-loop] bootstrapping plugin runtime copy\n",
  );
  const copyStart = Date.now();
  rmSync(runtimePluginRoot, { recursive: true, force: true });
  mkdirSync(runtimePluginRoot, { recursive: true });
  cpSync(sourcePluginRoot, runtimePluginRoot, {
    recursive: true,
    filter: (sourcePath) => {
      const normalized = sourcePath.replaceAll("\\", "/");
      if (
        normalized.endsWith("/node_modules") ||
        normalized.includes("/node_modules/")
      ) {
        return false;
      }
      if (normalized.endsWith("/.git") || normalized.includes("/.git/")) {
        return false;
      }
      return true;
    },
  });
  process.stdout.write(
    `[graph-refresh-loop] plugin runtime copy completed in ${Date.now() - copyStart}ms\n`,
  );
  runPluginInstall(runtimePluginRoot);

  writeFileSync(
    markerPath,
    `${JSON.stringify({ sourcePluginRoot, preparedAt: new Date().toISOString() }, null, 2)}\n`,
  );

  return runtimePluginRoot;
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: {
          command:
            "node scripts/harness/graph-refresh-loop.mjs --plugin-root <path> [options]",
          options: {
            "--interval-seconds <n>":
              "Interval between refresh cycles (default 600).",
            "--run-once": "Run a single refresh and exit.",
            "--commit": "Enable auto-commit for graph file changes.",
            "--with-local-state":
              "Also write meta/fingerprints local artifacts.",
            "--preflight-only":
              "Validate plugin/bootstrap prerequisites and exit.",
            "--commit-message <text>": "Auto-commit message override.",
          },
          envFallbacks: {
            UNDERSTAND_PLUGIN_ROOT:
              "Plugin root when --plugin-root is not set.",
            GRAPH_REFRESH_INTERVAL_SECONDS: "Default refresh interval.",
            GRAPH_REFRESH_RUN_ONCE: "true/false toggle for one-shot mode.",
            GRAPH_REFRESH_AUTO_COMMIT:
              "true/false toggle for --commit behavior.",
            GRAPH_REFRESH_BOOTSTRAP_PLUGIN:
              "true/false toggle for container plugin bootstrap (default true for /opt/understand-plugin).",
            GRAPH_REFRESH_RUNTIME_PLUGIN_ROOT:
              "Writable runtime plugin path (default /workspace/.cache/understand-plugin-runtime).",
            GRAPH_REFRESH_FORCE_BOOTSTRAP:
              "true/false toggle to force runtime copy/install even when source has node_modules.",
            GRAPH_REFRESH_BOOTSTRAP_INSTALL_TIMEOUT_MS:
              "Install timeout in ms for bootstrap dependency hydration (default 120000).",
            GRAPH_REFRESH_COMMIT_MESSAGE: "Commit message override.",
          },
        },
      },
      null,
      2,
    )}\n`,
  );
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const pluginRootInput = String(
    flags["plugin-root"] || process.env.UNDERSTAND_PLUGIN_ROOT || "",
  ).trim();
  if (!pluginRootInput) {
    throw new Error(
      "Missing plugin root. Provide --plugin-root or UNDERSTAND_PLUGIN_ROOT.",
    );
  }
  const pluginRoot = resolve(pluginRootInput);
  if (!existsSync(pluginRoot)) {
    throw new Error(`Plugin root does not exist: ${pluginRoot}`);
  }

  const intervalFromFlags = Number(flags["interval-seconds"]);
  const intervalFromEnv = Number(
    process.env.GRAPH_REFRESH_INTERVAL_SECONDS || 600,
  );
  let intervalSeconds = 600;
  if (Number.isFinite(intervalFromFlags) && intervalFromFlags > 0) {
    intervalSeconds = Math.floor(intervalFromFlags);
  } else if (Number.isFinite(intervalFromEnv) && intervalFromEnv > 0) {
    intervalSeconds = Math.floor(intervalFromEnv);
  }

  const options = {
    pluginRoot,
    commit:
      Boolean(flags.commit) ||
      parseBoolean(process.env.GRAPH_REFRESH_AUTO_COMMIT, false),
    withLocalState:
      Boolean(flags["with-local-state"]) ||
      parseBoolean(process.env.GRAPH_REFRESH_WITH_LOCAL_STATE, false),
    commitMessage:
      flags["commit-message"] || process.env.GRAPH_REFRESH_COMMIT_MESSAGE || "",
  };

  const preflight = runPreflight(options);
  options.sourceDepsResolvable = Boolean(preflight?.sourceDepsResolvable);

  if (flags["preflight-only"]) {
    return;
  }

  options.pluginRoot = preparePluginRuntime(options);

  const runOnce =
    Boolean(flags["run-once"]) ||
    parseBoolean(process.env.GRAPH_REFRESH_RUN_ONCE, false);
  if (runOnce) {
    const code = runRefresh(options);
    process.exit(code);
  }

  process.stdout.write(
    `[graph-refresh-loop] started (interval=${intervalSeconds}s, commit=${options.commit ? "on" : "off"}, pluginRoot=${options.pluginRoot})\n`,
  );

  while (!parseBoolean(process.env.GRAPH_REFRESH_STOP, false)) {
    runRefresh(options);
    await sleep(intervalSeconds * 1000);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `[graph-refresh-loop] fatal: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}
