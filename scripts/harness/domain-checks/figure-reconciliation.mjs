#!/usr/bin/env node
/**
 * figure-reconciliation — the numbers add up.
 *
 *   node figure-reconciliation.mjs <file>
 *
 * Inside each `<!-- reconcile -->` … `<!-- /reconcile -->` block, sums every `- label: <number>`
 * line and checks it equals the line whose label matches /total/i. Numbers may carry thousands
 * separators (1,250) and decimals; a leading currency symbol or trailing % is ignored. This is the
 * arithmetic-integrity gate for any deliverable that presents a model, budget, or financial summary —
 * the place where a copy-pasted figure silently stops matching its components. No blocks → passes.
 */
import { loadFile, runCli } from "./_lib.mjs";

function toNumber(raw) {
  const cleaned = raw.replace(/[^0-9.+-]/g, "");
  if (cleaned === "" || cleaned === "+" || cleaned === "-") return NaN;
  return Number(cleaned);
}

export default function run({ file, text, epsilon }) {
  const body = text ?? loadFile(file);
  const eps = Number(epsilon ?? 0.01);
  const lines = body.split(/\r?\n/);
  const itemRe = /^\s*-\s+(.+?):\s*([$€£]?\s*[-+]?[\d,]+(?:\.\d+)?)\s*%?\s*$/;

  const blocks = [];
  let current = null;
  for (const line of lines) {
    if (/<!--\s*reconcile\s*-->/.test(line)) {
      current = { items: [], total: null };
      continue;
    }
    if (/<!--\s*\/reconcile\s*-->/.test(line)) {
      if (current) blocks.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const m = itemRe.exec(line);
    if (!m) continue;
    const label = m[1].trim();
    const value = toNumber(m[2]);
    if (Number.isNaN(value)) continue;
    if (/total/i.test(label)) current.total = { label, value };
    else current.items.push({ label, value });
  }

  if (blocks.length === 0) {
    return { pass: true, detail: "no reconcile blocks; nothing to check" };
  }

  const failures = [];
  blocks.forEach((b, idx) => {
    if (!b.total) {
      failures.push(`block ${idx + 1}: no Total line`);
      return;
    }
    const sum = b.items.reduce((s, it) => s + it.value, 0);
    if (Math.abs(sum - b.total.value) > eps) {
      failures.push(`block ${idx + 1}: items sum to ${sum} but Total says ${b.total.value}`);
    }
  });

  if (failures.length) {
    return { pass: false, detail: failures.join("; "), failures };
  }
  return { pass: true, detail: `${blocks.length} reconcile block(s) balance` };
}

runCli({
  runner: run,
  usage: "figure-reconciliation.mjs <file>",
  selfTest: () => {
    const good =
      "<!-- reconcile -->\n- Product revenue: 1,200\n- Services revenue: 300\n- Total revenue: 1,500\n<!-- /reconcile -->\n";
    const bad =
      "<!-- reconcile -->\n- Product revenue: 1,200\n- Services revenue: 300\n- Total revenue: 1,400\n<!-- /reconcile -->\n";
    return [
      { name: "balanced block", opts: { text: good }, expectPass: true },
      { name: "unbalanced block fails", opts: { text: bad }, expectPass: false },
    ];
  },
});
