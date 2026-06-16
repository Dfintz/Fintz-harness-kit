#!/usr/bin/env node
/**
 * citation-integrity — every claim citation resolves, and every source is actually cited.
 *
 *   node citation-integrity.mjs <file>
 *
 * Uses standard markdown footnote syntax: inline citations `[^id]` in the body, and definitions
 * `[^id]: source text` (one per line). Fails on dangling citations (cited but never defined) and on
 * orphan sources (defined but never cited). The deterministic backbone of any evidence-bearing
 * deliverable — research, legal, financial — where an unsupported or invented reference is the
 * failure mode that matters most.
 */
import { loadFile, nonCodeLines, runCli } from "./_lib.mjs";

export default function run({ file, text }) {
  const body = text ?? loadFile(file);
  // Ignore fenced code blocks: a citation or definition shown as a code example is not real prose,
  // and counting it would let an invented reference (defined only inside a fence) pass.
  const lines = nonCodeLines(body).map((row) => row.line);
  const defined = new Set();
  const cited = new Set();
  const defRe = /^\s*\[\^([\w-]+)\]:/;
  const useRe = /\[\^([\w-]+)\]/g;

  for (const line of lines) {
    const def = defRe.exec(line);
    if (def) {
      defined.add(def[1]);
      continue; // a definition line is not itself a citation
    }
    let m;
    while ((m = useRe.exec(line)) !== null) cited.add(m[1]);
  }

  const dangling = [...cited].filter((id) => !defined.has(id));
  const orphan = [...defined].filter((id) => !cited.has(id));
  const problems = [];
  if (dangling.length) problems.push(`undefined citation(s): ${dangling.join(", ")}`);
  if (orphan.length) problems.push(`uncited source(s): ${orphan.join(", ")}`);

  if (problems.length) {
    return { pass: false, detail: problems.join("; "), dangling, orphan };
  }
  return {
    pass: true,
    detail: `${cited.size} citation(s) all resolve; ${defined.size} source(s) all cited`,
  };
}

runCli({
  runner: run,
  usage: "citation-integrity.mjs <file>",
  selfTest: () => {
    const good = "Claim one[^a] and two[^b].\n\n[^a]: Source A.\n[^b]: Source B.\n";
    const dangling = "Claim one[^a] and two[^b].\n\n[^a]: Source A.\n";
    const orphan = "Claim one[^a].\n\n[^a]: Source A.\n[^b]: Unused source.\n";
    return [
      { name: "citations resolve and sources cited", opts: { text: good }, expectPass: true },
      { name: "dangling citation fails", opts: { text: dangling }, expectPass: false },
      { name: "orphan source fails", opts: { text: orphan }, expectPass: false },
    ];
  },
});
