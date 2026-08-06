import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

function isJournal(value) {
  return value && typeof value.loop === "string" && Array.isArray(value.iterations);
}

export function planJournalRetention(runsDir, options = {}) {
  const maxCount = Number.isFinite(Number(options.maxCount)) ? Math.max(0, Number(options.maxCount)) : 100;
  const maxAgeMs = Number.isFinite(Number(options.maxAgeMs)) ? Math.max(0, Number(options.maxAgeMs)) : Infinity;
  const now = options.now ?? Date.now();
  const candidates = [];
  if (!existsSync(runsDir)) return { delete: [], retain: [], skipped: [] };
  for (const name of readdirSync(runsDir)) {
    if (!name.endsWith(".json") || name.endsWith(".manifest.json")) continue;
    const path = join(runsDir, name);
    try {
      const value = JSON.parse(readFileSync(path, "utf8"));
      if (!isJournal(value)) continue;
      const finishedAt = value.finishedAt ? Date.parse(value.finishedAt) : NaN;
      if (!Number.isFinite(finishedAt)) continue;
      candidates.push({ path: resolve(path), mtimeMs: finishedAt || statSync(path).mtimeMs });
    } catch {
      // Unknown files are intentionally left untouched.
    }
  }
  candidates.sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path));
  const retain = candidates.filter((entry, index) => index < maxCount && now - entry.mtimeMs <= maxAgeMs);
  const retained = new Set(retain.map((entry) => entry.path));
  return { delete: candidates.filter((entry) => !retained.has(entry.path)), retain, skipped: [] };
}

if (process.argv[1]?.endsWith("journal-retention.mjs")) {
  const args = process.argv.slice(2);
  const dirIndex = args.indexOf("--dir");
  const maxIndex = args.indexOf("--max-count");
  const ageIndex = args.indexOf("--max-age-days");
  const runsDir = dirIndex >= 0 ? args[dirIndex + 1] : ".github/harness/runs";
  const report = planJournalRetention(runsDir, {
    maxCount: maxIndex >= 0 ? Number(args[maxIndex + 1]) : 100,
    maxAgeMs: ageIndex >= 0 ? Number(args[ageIndex + 1]) * 24 * 60 * 60 * 1000 : Infinity,
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
