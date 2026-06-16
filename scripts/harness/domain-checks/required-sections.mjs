#!/usr/bin/env node
/**
 * required-sections — the deliverable must contain every named section as a markdown heading.
 *
 *   node required-sections.mjs <file> --sections "Summary|Method|References"
 *
 * Domain-neutral structure gate: a research memo without a "Sources" section, a runbook without
 * "Rollback", a legal brief without "Governing Law" is incomplete by construction. Matching is
 * case-insensitive on the heading text (any level #..######).
 */
import { headingText, loadFile, nonCodeLines, runCli, splitList } from "./_lib.mjs";

export default function run({ file, text, sections }) {
  const body = text ?? loadFile(file);
  const required = splitList(sections);
  if (required.length === 0) {
    return { pass: true, detail: "no --sections given; nothing to check" };
  }
  const present = new Set(
    nonCodeLines(body)
      .map(({ line }) => headingText(line))
      .filter(Boolean)
      .map((h) => h.toLowerCase()),
  );
  const missing = required.filter((s) => !present.has(s.toLowerCase()));
  if (missing.length > 0) {
    return { pass: false, detail: `missing required section(s): ${missing.join(", ")}`, missing };
  }
  return { pass: true, detail: `all ${required.length} required section(s) present` };
}

runCli({
  runner: run,
  usage: 'required-sections.mjs <file> --sections "A|B|C"',
  selfTest: () => {
    const good = "# Memo\n\n## Summary\nx\n\n## Method\ny\n\n## References\nz\n";
    const bad = "# Memo\n\n## Summary\nx\n";
    const opts = { sections: "Summary|Method|References" };
    return [
      { name: "all sections present", opts: { text: good, ...opts }, expectPass: true },
      { name: "missing a section", opts: { text: bad, ...opts }, expectPass: false },
    ];
  },
});
