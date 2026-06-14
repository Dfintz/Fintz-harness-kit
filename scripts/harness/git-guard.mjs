#!/usr/bin/env node
// Attribution & adaptations: see CREDITS.md. Dangerous-git guard, adapted from Matt Pocock's
// git-guardrails-claude-code (MIT) — generalized from a Claude-Code-only hook into an agent-neutral,
// deterministic classifier any runtime can gate a shell command through.
/**
 * git-guard — block irreversible/destructive git commands before they run.
 *
 * The harness's operational-safety stance is that hard-to-reverse actions (force push, hard reset,
 * untracked-file deletion, hook bypass, history rewrite) need an explicit human decision. This is the
 * EXECUTABLE form of that stance: a deterministic classifier (code, not model judgment) that any
 * agent can pipe a proposed git command through, in a pre-exec hook or wrapper.
 *
 *   classifyGitCommand("git push --force origin main")  → { severity: "block", rule, reason }
 *
 * Severities: "block" (exit 1 — refuse), "warn" (exit 0 — allowed but risky, surfaced), "allow"
 * (exit 0). Non-git commands are allowed (not this guard's concern).
 *
 * Usage:
 *   node scripts/harness/git-guard.mjs --self-test
 *   node scripts/harness/git-guard.mjs check "git push --force origin main"   # exit 1, prints reason
 *   node scripts/harness/git-guard.mjs check "git status"                     # exit 0
 *   node scripts/harness/git-guard.mjs --explain                              # list the rules
 *   node scripts/harness/git-guard.mjs check "<cmd>" --json
 *
 * Wire it into an agent hook, e.g. (bash):  node scripts/harness/git-guard.mjs check "$CMD" || exit 1
 *
 * It NEVER runs git — it only classifies a command string. Override a block by running the raw git
 * command yourself, deliberately, outside the guard.
 *
 * Exit codes: 0 allowed (allow|warn) / self-test passed, 1 blocked / self-test failed, 2 config error.
 */

function fail(message, code = 2) {
  process.stderr.write(`[git-guard] ${message}\n`);
  process.exit(code);
}

// Tokenize a shell-ish command into bare tokens (strips matching quotes). Good enough to read the
// git subcommand + flags; the classifier only needs token presence, not full shell semantics.
function tokenize(command) {
  const tokens = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(String(command ?? ""))) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }
  return tokens;
}

function block(rule, reason) {
  return { severity: "block", rule, reason };
}
function warn(rule, reason) {
  return { severity: "warn", rule, reason };
}
function allow(rule = "allowed", reason = "") {
  return { severity: "allow", rule, reason };
}

/**
 * Classify a single git command string. Pure + deterministic (exported for the self-test).
 * Returns the FIRST matching rule, most-destructive checks first.
 * @param {string} command
 * @returns {{ severity: "block"|"warn"|"allow", rule: string, reason: string }}
 */
export function classifyGitCommand(command) {
  const tokens = tokenize(command);
  // Find the `git` token (allow leading env assignments / sudo) and the subcommand after it.
  const gitIdx = tokens.findIndex((t) => t === "git" || t.endsWith("/git"));
  if (gitIdx === -1) return allow("not-git", "not a git command");
  const rest = tokens.slice(gitIdx + 1);
  const sub = rest.find((t) => !t.startsWith("-")) ?? "";
  const flags = rest.filter((t) => t.startsWith("-"));
  const has = (...names) => names.some((n) => flags.includes(n));
  const hasNoVerify = has("--no-verify") || flags.includes("-n") && sub === "commit";

  // --- history rewrite that is effectively unrecoverable -------------------------------------
  if (sub === "filter-branch" || sub === "filter-repo") {
    return block("filter-branch", "rewrites the entire history of the repository");
  }
  if (sub === "reflog" && rest.includes("expire")) {
    return block("reflog-expire", "expires reflog entries — removes the safety net for recovery");
  }
  if (sub === "update-ref" && has("-d", "--delete")) {
    return block("update-ref-delete", "deletes a ref directly, bypassing normal branch tooling");
  }

  // --- force push / remote deletion -----------------------------------------------------------
  if (sub === "push") {
    if (has("--force-with-lease")) {
      return warn("push-force-with-lease", "rewrites the remote branch (safer lease variant) — confirm intent");
    }
    if (has("--force", "-f")) {
      return block("push-force", "force-push overwrites remote history and can destroy others' commits");
    }
    if (has("--delete") || rest.some((t) => /^:.+/.test(t))) {
      return block("push-delete", "deletes a remote branch");
    }
    if (hasNoVerify) {
      return block("push-no-verify", "--no-verify bypasses pre-push hooks (e.g. secret scanning)");
    }
    return allow("push", "normal push");
  }

  // --- working-tree / index destruction -------------------------------------------------------
  if (sub === "reset" && has("--hard")) {
    return block("reset-hard", "discards all uncommitted changes in the working tree and index");
  }
  if (sub === "clean" && has("-f", "-fd", "-fdx", "-df", "-xfd", "--force")) {
    return block("clean-force", "permanently deletes untracked files (and dirs/ignored with -d/-x)");
  }
  if (sub === "checkout" && has("-f", "--force")) {
    return block("checkout-force", "discards local changes when switching");
  }
  if (sub === "checkout" && rest.includes("--") && rest[rest.length - 1] === ".") {
    return warn("checkout-discard", "discards changes to the current path tree");
  }
  if (sub === "restore" && (rest.includes(".") || has("--worktree", "-W"))) {
    return warn("restore-discard", "discards working-tree changes");
  }

  // --- branch / stash deletion ----------------------------------------------------------------
  if (sub === "branch" && (flags.includes("-D") || (has("-d", "--delete") && has("-f", "--force")))) {
    return block("branch-force-delete", "force-deletes a branch even if unmerged");
  }
  if (sub === "branch" && has("-d", "--delete")) {
    return warn("branch-delete", "deletes a branch");
  }
  if (sub === "stash" && (rest.includes("clear") || rest.includes("drop"))) {
    return warn("stash-discard", "discards stashed work");
  }

  // --- history-rewriting on local commits -----------------------------------------------------
  if (sub === "commit" && hasNoVerify) {
    return block("commit-no-verify", "--no-verify bypasses pre-commit hooks (lint, types, secret scan)");
  }
  if (sub === "commit" && has("--amend")) {
    return warn("commit-amend", "rewrites the last commit — dangerous if it was already pushed");
  }
  if (sub === "rebase") {
    return warn("rebase", "rewrites commit history — coordinate before rebasing shared branches");
  }
  if (sub === "gc" && rest.some((t) => /^--prune=now$/.test(t))) {
    return warn("gc-prune-now", "prunes unreachable objects immediately — removes recovery window");
  }

  return allow("safe", `git ${sub || "(no subcommand)"} is not a guarded action`);
}

const RULES_DOC = [
  ["block", "filter-branch / filter-repo / reflog expire / update-ref -d", "unrecoverable history/ref rewrite"],
  ["block", "push --force / -f", "overwrites remote history"],
  ["block", "push --delete / push <remote> :branch", "remote branch deletion"],
  ["block", "push/commit --no-verify", "bypasses hooks (secret scan, lint, types)"],
  ["block", "reset --hard", "discards working tree + index"],
  ["block", "clean -f[dx]", "deletes untracked files"],
  ["block", "checkout -f", "discards local changes"],
  ["block", "branch -D", "force-deletes an unmerged branch"],
  ["warn", "push --force-with-lease", "safer force, still rewrites remote"],
  ["warn", "commit --amend / rebase", "rewrites local history"],
  ["warn", "branch -d / stash clear|drop / restore . / checkout -- .", "deletes/discards local work"],
  ["warn", "gc --prune=now", "removes object recovery window"],
  ["allow", "everything else", "status, add, commit, fetch, pull, push (no force), branch, switch, …"],
];

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--self-test" || a === "--json" || a === "--explain" || a === "--help") {
      flags[a.slice(2)] = true;
    } else if (a === "--command") {
      flags.command = argv[++i];
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

function runSelfTest({ json }) {
  const cases = [
    ["git push --force origin main", "block", "push-force"],
    ["git push -f", "block", "push-force"],
    ["git push --force-with-lease origin feature", "warn", "push-force-with-lease"],
    ["git push origin :feature", "block", "push-delete"],
    ["git push --delete origin feature", "block", "push-delete"],
    ["git push --no-verify origin main", "block", "push-no-verify"],
    ["git commit --no-verify -m 'x'", "block", "commit-no-verify"],
    ["git reset --hard HEAD~1", "block", "reset-hard"],
    ["git clean -fd", "block", "clean-force"],
    ["git clean -fdx", "block", "clean-force"],
    ["git checkout -f main", "block", "checkout-force"],
    ["git branch -D feature", "block", "branch-force-delete"],
    ["git filter-branch --tree-filter rm", "block", "filter-branch"],
    ["git update-ref -d refs/heads/x", "block", "update-ref-delete"],
    ["git commit --amend -m 'x'", "warn", "commit-amend"],
    ["git rebase -i HEAD~3", "warn", "rebase"],
    ["git branch -d feature", "warn", "branch-delete"],
    ["git stash clear", "warn", "stash-discard"],
    ["git checkout -- .", "warn", "checkout-discard"],
    ["git restore .", "warn", "restore-discard"],
    ["git gc --prune=now", "warn", "gc-prune-now"],
    ["git status", "allow", "safe"],
    ["git push origin main", "allow", "push"],
    ["git commit -m 'normal'", "allow", "safe"],
    ["git add -A", "allow", "safe"],
    ["npm install", "allow", "not-git"],
    ["git switch main", "allow", "safe"],
  ];
  const checks = cases.map(([cmd, sev, rule]) => {
    const got = classifyGitCommand(cmd);
    return {
      name: `${cmd} → ${sev}/${rule}`,
      ok: got.severity === sev && got.rule === rule,
      detail: `got ${got.severity}/${got.rule}`,
    };
  });
  const passed = checks.every((c) => c.ok);
  if (json) {
    process.stdout.write(`${JSON.stringify({ ok: passed, mode: "self-test", checks }, null, 2)}\n`);
  } else {
    process.stdout.write(`[git-guard] self-test — ${checks.length} case(s)\n`);
    for (const c of checks) {
      process.stdout.write(`  ${c.ok ? "PASS" : "FAIL"}  ${c.name}${c.ok ? "" : ` — ${c.detail}`}\n`);
    }
    process.stdout.write(`[git-guard] ${passed ? "self-test PASSED" : "self-test FAILED"}\n`);
  }
  process.exit(passed ? 0 : 1);
}

function explain({ json }) {
  if (json) {
    process.stdout.write(
      `${JSON.stringify(RULES_DOC.map(([severity, pattern, reason]) => ({ severity, pattern, reason })), null, 2)}\n`,
    );
  } else {
    process.stdout.write(`[git-guard] rules (first match wins, most-destructive first):\n`);
    for (const [severity, pattern, reason] of RULES_DOC) {
      process.stdout.write(`  ${severity.toUpperCase().padEnd(5)}  ${pattern}  —  ${reason}\n`);
    }
  }
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: 'node scripts/harness/git-guard.mjs (check "<git cmd>" | --self-test | --explain) [--json]',
        severities: { block: "exit 1 — refuse", warn: "exit 0 — allowed but surfaced", allow: "exit 0" },
        hook: 'pre-exec hook: node scripts/harness/git-guard.mjs check "$CMD" || exit 1',
        note: "Deterministic classifier; never runs git. Override a block by running the raw command yourself, deliberately.",
      },
      null,
      2,
    )}\n`,
  );
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) return showHelp();
  if (flags["self-test"]) return runSelfTest({ json: Boolean(flags.json) });
  if (flags.explain) return explain({ json: Boolean(flags.json) });

  // `check "<cmd>"` or --command "<cmd>"
  const idx = flags._.indexOf("check");
  const command =
    flags.command ??
    (idx >= 0 ? flags._[idx + 1] : undefined) ??
    (flags._[0] !== "check" ? flags._.join(" ") : undefined);
  if (!command) {
    fail('nothing to check. Use: check "<git command>" (or --self-test / --explain).');
  }

  const verdict = classifyGitCommand(command);
  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ command, ...verdict }, null, 2)}\n`);
  } else if (verdict.severity === "block") {
    process.stderr.write(`[git-guard] BLOCK (${verdict.rule}): ${verdict.reason}\n  ${command}\n`);
  } else if (verdict.severity === "warn") {
    process.stderr.write(`[git-guard] WARN (${verdict.rule}): ${verdict.reason}\n  ${command}\n`);
  } else {
    process.stdout.write(`[git-guard] allow: ${command}\n`);
  }
  process.exit(verdict.severity === "block" ? 1 : 0);
}

main();
