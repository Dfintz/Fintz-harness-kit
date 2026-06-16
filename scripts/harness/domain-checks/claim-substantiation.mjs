#!/usr/bin/env node
/**
 * claim-substantiation — strong or quantified claims must carry a source.
 *
 *   node claim-substantiation.mjs <file>
 *
 * Flags any non-heading, non-code line that makes a hard claim — a percentage or other figure, or a
 * superlative/absolute word (best, guaranteed, proven, fastest, #1, always, never, 100%) — but
 * carries no citation marker (`[^id]`) and no inline `(source: …)`. The defence against confident,
 * unsupported assertions in marketing copy, research findings, and optimization recommendations.
 * Lines under a "References"/"Sources" heading are exempt (they are the sources).
 */
import { headingText, loadFile, nonCodeLines, runCli } from "./_lib.mjs";

const CLAIM_RE =
  /(\b\d+(?:\.\d+)?\s?%)|(\b(?:best|worst|guarantee[ds]?|proven|fastest|cheapest|safest|#1|number one|always|never|every time|100%|unmatched|industry[- ]leading)\b)/i;
const SOURCE_RE = /(\[\^[\w-]+\])|(\(source:\s*[^)]+\))/i;

export default function run({ file, text }) {
  const body = text ?? loadFile(file);
  let inSources = false;
  const offenders = [];
  for (const { n, line } of nonCodeLines(body)) {
    const h = headingText(line);
    if (h !== null) {
      inSources = /(reference|source|bibliograph|citation)/i.test(h);
      continue;
    }
    if (inSources) continue;
    if (CLAIM_RE.test(line) && !SOURCE_RE.test(line)) {
      offenders.push(n);
    }
  }
  if (offenders.length) {
    return {
      pass: false,
      detail: `unsubstantiated claim(s) on line(s): ${offenders.join(", ")}`,
      lines: offenders,
    };
  }
  return { pass: true, detail: "all strong/quantified claims carry a source" };
}

runCli({
  runner: run,
  usage: "claim-substantiation.mjs <file>",
  selfTest: () => {
    const good =
      "Bookings rose 40%[^q3] last quarter.\n- Our tour is rated #1 by guests (source: 2025 survey).\n";
    const bad = "Bookings rose 40% last quarter.\nWe are the best in the region.\n";
    return [
      { name: "claims are sourced", opts: { text: good }, expectPass: true },
      { name: "unsourced claim fails", opts: { text: bad }, expectPass: false },
    ];
  },
});
