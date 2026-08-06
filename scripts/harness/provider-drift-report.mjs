import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

/**
 * Compare provider files by shape and SHA-256 bytes only.
 * YAML policy semantics remain owned by sidecar-allowlist-report.mjs.
 */
const COMPARED_PATH = /^(?:[^/]+\/SKILL\.md|[^/]+\/agents\/openai\.yaml)$/;
const compareStrings = (left, right) => left.localeCompare(right);

function isContainedPath(root, candidate) {
  const rootPath = realpathSync(root);
  const candidatePath = realpathSync(candidate);
  const rootWithSeparator = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSeparator);
}

function filesUnder(root) {
  if (!existsSync(root)) return new Map();
  const realRoot = realpathSync(root);
  const result = new Map();
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else {
        const rel = relative(root, path).replaceAll("\\", "/");
        if (!COMPARED_PATH.test(rel)) continue;
        if (!isContainedPath(realRoot, path)) continue;
        result.set(rel, createHash("sha256").update(readFileSync(path)).digest("hex"));
      }
    }
  };
  walk(root);
  return result;
}

export function compareProviderTrees(canonicalRoot, installedRoots) {
  const canonical = filesUnder(resolve(canonicalRoot));
  const drifts = [];
  const uniqueRoots = [...new Set(installedRoots.map((root) => resolve(root)))];
  for (const root of uniqueRoots) {
    const installed = filesUnder(root);
    const paths = new Set([...canonical.keys(), ...installed.keys()]);
    for (const path of [...paths].sort(compareStrings)) {
      if (!canonical.has(path)) drifts.push({ code: "extra-installed", root, path });
      else if (!installed.has(path)) drifts.push({ code: "missing-installed", root, path });
      else if (canonical.get(path) !== installed.get(path)) drifts.push({ code: "content-drift", root, path, canonicalSha256: canonical.get(path), installedSha256: installed.get(path) });
    }
  }
  return { canonicalRoot: resolve(canonicalRoot), installedRoots: uniqueRoots, comparedFiles: [...canonical.keys()].sort(compareStrings), driftCount: drifts.length, drifts };
}

function parseArgs(argv) {
  const flags = { canonicalRoot: ".github/skills", installedRoots: [], json: false, installedRootProvided: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") flags.json = true;
    else if (arg === "--canonical-root") flags.canonicalRoot = argv[++index];
    else if (arg === "--installed-root") {
      flags.installedRootProvided = true;
      flags.installedRoots.push(argv[++index]);
    }
    else throw new Error(`unknown option: ${arg}`);
  }
  return flags;
}

if (process.argv[1]?.endsWith("provider-drift-report.mjs")) {
  function renderText(report) {
    const lines = [`[provider-drift] drift count: ${report.driftCount}`];
    for (const drift of report.drifts) {
      lines.push(`[provider-drift] ${drift.code} ${drift.root}/${drift.path}`);
    }
    return `${lines.join("\n")}\n`;
  }

  try {
    const flags = parseArgs(process.argv.slice(2));
    const installedRoots = flags.installedRootProvided ? flags.installedRoots : [".claude/skills"];
    const report = compareProviderTrees(flags.canonicalRoot, installedRoots);
    process.stdout.write(flags.json ? `${JSON.stringify(report, null, 2)}\n` : renderText(report));
    process.exitCode = report.driftCount > 0 ? 1 : 0;
  } catch (error) {
    process.stderr.write(`[provider-drift] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
