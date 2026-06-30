#!/usr/bin/env node
/**
 * notify.mjs — provider-agnostic harness notification sink.
 *
 * Fires a USER-CONFIGURED command on run state transitions (converged / stuck / exhausted /
 * waiting / error / improved). The kit never imports a notification provider — it hands you the
 * transition and you wire the sink (desktop notify-send, a Slack/Discord webhook curl, or echo to a
 * log). Disabled by default; opt-in via the `notify` block in harness.config.json.
 *
 * SECURITY (in-process injection cannot be fully prevented — neutralize it structurally):
 *   - The command is spawned with shell:false (no shell to chain/redirect/substitute).
 *   - A string template is split into argv FIRST (structure fixed by trusted config), THEN env vars
 *     ($VAR / ${VAR}, lookup-only) and {tokens} are substituted into individual argv ELEMENTS, so an
 *     untrusted value (loop/metric name) can never add a new argv element.
 *   - Token VALUES are sanitized (control chars + shell metacharacters stripped) as defense-in-depth
 *     for sinks that re-interpret their own argv (e.g. `pwsh -Command "...{loop}..."`).
 *   - argv[0] (the executable) must be in the notify allowlist (validated via command-validation).
 *
 * Usage:
 *   node scripts/harness/notify.mjs --state converged --loop lint-debt --metric 4811 --journal <path>
 *   node scripts/harness/notify.mjs --self-test
 *
 * Exit codes: 0 fired (or intentionally not fired), 1 self-test failure, 2 usage error.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const configPath = join(repoRoot, "harness.config.json");

// Executables permitted as notification sinks — distinct from the agent-command allowlist because a
// sink is a delivery tool (webhook/desktop toast/log), not a coding agent.
const NOTIFY_ALLOWED = [
  "curl",
  "wget",
  "echo",
  "printf",
  "notify-send",
  "osascript",
  "terminal-notifier",
  "msg",
  "logger",
  "node",
  "npm",
  "npx",
];

// Transitions a sink may legitimately want; the default `on` filter ships the terminal ones.
export const DEFAULT_NOTIFY_ON = [
  "converged",
  "stuck",
  "exhausted",
  "blocked",
  "waiting",
  "error",
];

// Resolve the bare executable name from argv[0] (strip path + surrounding quotes), lower-cased.
function resolveExecutableName(token) {
  const cleaned = String(token ?? "").replace(/^['"]|['"]$/g, "");
  const base = cleaned.replaceAll("\\", "/").split("/").pop() || cleaned;
  return base.toLowerCase();
}

// Self-contained sink validation: argv[0] must be in the notify allowlist. shell:false + literal
// argv + sanitized tokens neutralize injection, so notify owns its allowlist rather than depending
// on command-validation (whose default allowlist differs across harness deployments).
function validateSink(argv, allowlist) {
  if (!Array.isArray(argv) || argv.length === 0)
    return { ok: false, reason: "empty command" };
  const exe = resolveExecutableName(argv[0]);
  const allow = new Set(
    (Array.isArray(allowlist) && allowlist.length > 0
      ? allowlist
      : NOTIFY_ALLOWED
    ).map((e) => String(e).toLowerCase()),
  );
  if (!allow.has(exe)) {
    return {
      ok: false,
      reason: `executable "${exe}" is not in the notify allowlist`,
    };
  }
  return { ok: true, executable: exe };
}

function loadNotifyConfig() {
  if (!existsSync(configPath)) return {};
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf8"));
    return cfg && typeof cfg.notify === "object" && cfg.notify
      ? cfg.notify
      : {};
  } catch {
    return {};
  }
}

// Expand $VAR / ${VAR} from env in a single argv element. Lookup ONLY — never command substitution.
function expandEnv(arg, env) {
  return String(arg).replace(
    /\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (_, braced, bare) => {
      const key = braced || bare;
      return Object.prototype.hasOwnProperty.call(env, key)
        ? String(env[key] ?? "")
        : "";
    },
  );
}

// Defang token VALUES: tokens land in argv literally (shell:false), but strip control chars and
// shell-significant sequences so a hostile loop/metric string can't smuggle metacharacters into a
// sink that re-interprets its own argv. Bounded length keeps payloads sane.
export function sanitizeValue(value) {
  return String(value ?? "")
    .replace(/[\r\n\t\f\v]+/g, " ")
    .replace(/[`$;|&<>]/g, "")
    .slice(0, 2000);
}

/**
 * Build the concrete argv from a template (string or string[]) and tokens.
 * Split-first then substitute is the security-critical order.
 */
export function buildArgv(template, tokens = {}, env = process.env) {
  const parts = Array.isArray(template)
    ? template.map((p) => String(p))
    : String(template ?? "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);
  return parts.map((part) => {
    const envExpanded = expandEnv(part, env); // env FIRST (trusted template only)
    return envExpanded.replace(/\{([a-zA-Z]+)\}/g, (match, key) =>
      Object.prototype.hasOwnProperty.call(tokens, key)
        ? sanitizeValue(tokens[key])
        : match,
    );
  });
}

/**
 * Fire a notification for a run-state transition. Best-effort and self-contained: never throws, so a
 * caller in a runner's finish() can call it without a try/catch affecting the run's exit code.
 *
 * event: { loop, kind, state, metric, journal }
 * options: { config, env, quiet, inherit, dryRun }
 * returns: { fired: boolean, reason?, status?, executable?, argv? }
 */
export function notifyTransition(event = {}, options = {}) {
  const cfg = options.config ?? loadNotifyConfig();
  if (!cfg || cfg.enabled !== true) return { fired: false, reason: "disabled" };

  const on =
    Array.isArray(cfg.on) && cfg.on.length > 0 ? cfg.on : DEFAULT_NOTIFY_ON;
  if (event.state && !on.includes(event.state)) {
    return { fired: false, reason: `state-filtered (${event.state})` };
  }

  const template = cfg.command;
  if (!template || (Array.isArray(template) && template.length === 0)) {
    return { fired: false, reason: "no-command" };
  }

  const env = options.env ?? process.env;
  const webhook =
    cfg.webhookEnv && Object.prototype.hasOwnProperty.call(env, cfg.webhookEnv)
      ? String(env[cfg.webhookEnv] ?? "")
      : "";
  const tokens = {
    loop: event.loop ?? "",
    kind: event.kind ?? "",
    state: event.state ?? "",
    metric: event.metric ?? "",
    journal: event.journal ?? "",
    webhook,
    payload: JSON.stringify({
      loop: event.loop ?? "",
      kind: event.kind ?? "",
      state: event.state ?? "",
      metric: event.metric ?? "",
      journal: event.journal ?? "",
      at: new Date().toISOString(),
    }),
  };

  const argv = buildArgv(template, tokens, env);
  if (argv.length === 0) return { fired: false, reason: "empty-argv" };

  // Validate ONLY the executable against the notify allowlist; shell:false makes the chaining/redirect
  // scan moot, but a bad executable is still rejected.
  const verdict = validateSink(argv, cfg.allowedExecutables);
  if (!verdict.ok) {
    if (!options.quiet)
      console.warn(`[notify] command rejected: ${verdict.reason}`);
    return { fired: false, reason: `rejected: ${verdict.reason}`, argv };
  }

  if (options.dryRun)
    return {
      fired: false,
      reason: "dry-run",
      argv,
      executable: verdict.executable,
    };

  const [cmd, ...rest] = argv;
  const res = spawnSync(cmd, rest, {
    cwd: repoRoot,
    shell: false,
    stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    timeout: Number.isInteger(cfg.timeoutMs) ? cfg.timeoutMs : 10000,
    env,
  });
  if (res.error) {
    if (!options.quiet)
      console.warn(`[notify] sink failed to start: ${res.error.message}`);
    return { fired: false, reason: `spawn-error: ${res.error.message}`, argv };
  }
  return {
    fired: true,
    status: res.status ?? null,
    executable: verdict.executable,
    argv,
  };
}

// ---------- self-test (deterministic, no network, no config) ----------

function runSelfTest() {
  const checks = [];
  const ok = (name, cond) => checks.push({ name, pass: !!cond });

  // Split-first: a string template becomes argv.
  const a1 = buildArgv(
    "echo {state} {loop}",
    { state: "converged", loop: "lint-debt" },
    {},
  );
  ok("string template splits to argv", a1.length === 3 && a1[0] === "echo");
  ok("tokens substituted", a1[1] === "converged" && a1[2] === "lint-debt");

  // A token value with spaces stays ONE argv element (cannot add argv).
  const a2 = buildArgv(["echo", "{loop}"], { loop: "a b c" }, {});
  ok(
    "spacey token stays one argv element",
    a2.length === 2 && a2[1] === "a b c",
  );

  // Shell metacharacters in a token value are stripped.
  const a3 = buildArgv(
    ["echo", "{loop}"],
    { loop: "x; rm -rf / `id` $(whoami) | cat" },
    {},
  );
  ok("token value is defanged", !/[`$;|]/.test(a3[1]));

  // Env expansion happens on the trusted template, lookup-only.
  const a4 = buildArgv(
    ["curl", "$HOOK"],
    {},
    { HOOK: "https://example.test/x" },
  );
  ok("env expanded from template", a4[1] === "https://example.test/x");

  // Unknown env var expands to empty (no leakage of literal $VAR).
  const a5 = buildArgv(["echo", "${MISSING}"], {}, {});
  ok("missing env -> empty", a5[1] === "");

  // sanitizeValue strips newlines + shell chars and bounds length.
  ok("sanitize strips newlines", !/\n/.test(sanitizeValue("a\nb")));
  ok("sanitize bounds length", sanitizeValue("z".repeat(5000)).length === 2000);

  // Disabled config never fires.
  const r1 = notifyTransition(
    { state: "converged" },
    { config: { enabled: false } },
  );
  ok("disabled -> not fired", r1.fired === false && r1.reason === "disabled");

  // State filtering: a state not in `on` is skipped.
  const r2 = notifyTransition(
    { state: "running" },
    {
      config: { enabled: true, on: ["converged"], command: ["echo", "hi"] },
      dryRun: true,
    },
  );
  ok(
    "state filter skips",
    r2.fired === false && /state-filtered/.test(r2.reason),
  );

  // Disallowed executable is rejected.
  const r3 = notifyTransition(
    { state: "converged" },
    {
      config: { enabled: true, command: ["rm", "-rf", "{journal}"] },
      quiet: true,
      dryRun: true,
    },
  );
  ok(
    "disallowed executable rejected",
    r3.fired === false && /rejected/.test(r3.reason),
  );

  // Allowed executable in dry-run resolves a clean argv.
  const r4 = notifyTransition(
    { state: "converged", loop: "lint-debt", metric: 10 },
    {
      config: {
        enabled: true,
        command: ["echo", "{loop}", "{state}", "{metric}"],
      },
      dryRun: true,
    },
  );
  ok(
    "allowed dry-run builds argv",
    r4.reason === "dry-run" &&
      r4.argv.join(" ") === "echo lint-debt converged 10",
  );

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.length - passed;
  for (const c of checks) if (!c.pass) console.error(`  ✗ ${c.name}`);
  console.log(`[notify] self-test: ${passed}/${checks.length} passed`);
  return failed === 0;
}

// ---------- CLI ----------

function parseArgs(argv) {
  const flags = { selfTest: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--self-test") flags.selfTest = true;
    else if (a === "--dry-run") flags.dryRun = true;
    else if (a === "--state") flags.state = argv[++i];
    else if (a === "--loop") flags.loop = argv[++i];
    else if (a === "--kind") flags.kind = argv[++i];
    else if (a === "--metric") flags.metric = argv[++i];
    else if (a === "--journal") flags.journal = argv[++i];
    else {
      console.error(`[notify] unknown option: ${a}`);
      process.exit(2);
    }
  }
  return flags;
}

if (process.argv[1] && process.argv[1].endsWith("notify.mjs")) {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.selfTest) {
    process.exit(runSelfTest() ? 0 : 1);
  }
  const result = notifyTransition(
    {
      loop: flags.loop,
      kind: flags.kind,
      state: flags.state,
      metric: flags.metric,
      journal: flags.journal,
    },
    { dryRun: flags.dryRun, inherit: true },
  );
  console.log(`[notify] ${JSON.stringify(result)}`);
  process.exit(0);
}
