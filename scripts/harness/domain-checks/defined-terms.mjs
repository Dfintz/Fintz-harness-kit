#!/usr/bin/env node
/**
 * defined-terms — every term you define is actually used; no dead definitions.
 *
 *   node defined-terms.mjs <file>
 *
 * Scans a "Definitions" (or "Defined Terms") section for entries of the form `- **Term** — …` and
 * verifies each Term appears at least once in the body outside that section. The classic contract /
 * policy defect: a defined term that no clause ever invokes (left over from a template) or, inversely,
 * a definitions block that has drifted from the operative text. If there is no definitions section,
 * the check passes (nothing to enforce) so it is safe on non-legal deliverables.
 */
import { headingText, loadFile, runCli } from "./_lib.mjs";

export default function run({ file, text }) {
  const body = text ?? loadFile(file);
  const lines = body.split(/\r?\n/);

  let inDefs = false;
  const defs = []; // { term, line }
  const defLineNums = new Set();
  for (let i = 0; i < lines.length; i += 1) {
    const h = headingText(lines[i]);
    if (h !== null) {
      inDefs = /defin/i.test(h); // "Definitions" / "Defined Terms"
      continue;
    }
    if (inDefs) {
      const m = /^\s*-\s+\*\*(.+?)\*\*/.exec(lines[i]);
      if (m) {
        defs.push({ term: m[1].trim(), line: i + 1 });
        defLineNums.add(i + 1);
      }
    }
  }

  if (defs.length === 0) {
    return { pass: true, detail: "no definitions section; nothing to check" };
  }

  const bodyOutsideDefs = lines
    .filter((_, i) => !defLineNums.has(i + 1))
    .join("\n")
    .toLowerCase();

  const unused = defs
    .filter(({ term }) => !bodyOutsideDefs.includes(term.toLowerCase()))
    .map(({ term }) => term);

  if (unused.length) {
    return { pass: false, detail: `defined but never used: ${unused.join(", ")}`, unused };
  }
  return { pass: true, detail: `all ${defs.length} defined term(s) used in body` };
}

runCli({
  runner: run,
  usage: "defined-terms.mjs <file>",
  selfTest: () => {
    const good =
      "## Definitions\n- **Licensee** — the party.\n- **Effective Date** — the date.\n\n## Terms\nThe Licensee shall, on the Effective Date, comply.\n";
    const bad =
      "## Definitions\n- **Licensee** — the party.\n- **Indemnity Cap** — a limit.\n\n## Terms\nThe Licensee shall comply.\n";
    return [
      { name: "all defined terms used", opts: { text: good }, expectPass: true },
      { name: "unused defined term fails", opts: { text: bad }, expectPass: false },
    ];
  },
});
