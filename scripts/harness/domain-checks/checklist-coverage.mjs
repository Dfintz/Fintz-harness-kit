#!/usr/bin/env node
/**
 * checklist-coverage — every gate/criterion heading has an explicit verdict.
 *
 *   node checklist-coverage.mjs <file>                 # auto-detect "Gate …" headings
 *   node checklist-coverage.mjs <file> --items "Gate 1 — Scope|Gate 2 — Risk"
 *
 * Enforces that a review or sign-off deliverable does not leave a gate unanswered: each gate heading
 * must be followed, before the next heading, by a non-empty `Verdict:` line. With `--items`, the
 * named headings must also all be present. This is what turns a gate checklist from decoration into a
 * thing that fails when someone skips a question.
 */
import { headingText, loadFile, nonCodeLines, runCli, splitList } from "./_lib.mjs";

export default function run({ file, text, items }) {
  const body = text ?? loadFile(file);
  const named = splitList(items);
  const rows = nonCodeLines(body);

  // Collect headings and whether a non-empty Verdict: line precedes the next heading.
  const gates = [];
  for (let i = 0; i < rows.length; i += 1) {
    const h = headingText(rows[i].line);
    if (h === null) continue;
    const isGate = named.length
      ? named.some((it) => h.toLowerCase() === it.toLowerCase())
      : /^gate\b|^criterion\b/i.test(h);
    if (!isGate) continue;
    let verdict = false;
    for (let j = i + 1; j < rows.length; j += 1) {
      if (headingText(rows[j].line) !== null) break;
      const m = /^\s*\**\s*verdict\s*\**\s*:\s*(.+\S)/i.exec(rows[j].line);
      if (m) {
        verdict = true;
        break;
      }
    }
    gates.push({ heading: h, verdict });
  }

  const problems = [];
  if (named.length) {
    const present = new Set(gates.map((g) => g.heading.toLowerCase()));
    const missing = named.filter((it) => !present.has(it.toLowerCase()));
    if (missing.length) problems.push(`missing gate heading(s): ${missing.join(", ")}`);
  }
  const unanswered = gates.filter((g) => !g.verdict).map((g) => g.heading);
  if (unanswered.length) problems.push(`no Verdict for: ${unanswered.join(", ")}`);

  if (gates.length === 0 && named.length === 0) {
    return { pass: true, detail: "no gate headings found; nothing to check" };
  }
  if (problems.length) return { pass: false, detail: problems.join("; ") };
  return { pass: true, detail: `${gates.length} gate(s) each carry a verdict` };
}

runCli({
  runner: run,
  usage: 'checklist-coverage.mjs <file> [--items "Gate 1|Gate 2"]',
  selfTest: () => {
    const good =
      "## Gate 1 — Scope\nVerdict: PASS — scope is bounded.\n\n## Gate 2 — Risk\n**Verdict:** PASS — risks listed.\n";
    const bad = "## Gate 1 — Scope\nVerdict: PASS\n\n## Gate 2 — Risk\nStill thinking about it.\n";
    return [
      { name: "every gate has a verdict", opts: { text: good }, expectPass: true },
      { name: "gate without verdict fails", opts: { text: bad }, expectPass: false },
    ];
  },
});
