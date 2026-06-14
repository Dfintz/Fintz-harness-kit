// Attribution & adaptations: see CREDITS.md. Eval verifier (self-improving-harness Brief).
/**
 * metric-improve verifier: counts occurrences of a marker pattern in the target and passes when the
 * count is at or below task.expected.targetMax. Models the autoresearch hill-climb metric in a
 * deterministic, self-testable way (real runs measure a baseline first; this MVP uses a fixed bar).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export default function verify({ workdir, task }) {
  const target = task?.target;
  const marker = task?.expected?.marker;
  const targetMax = Number(task?.expected?.targetMax);
  if (!target || !marker || !Number.isFinite(targetMax)) {
    return { pass: false, score: 0, detail: 'task.target/expected.marker/expected.targetMax not declared' };
  }
  const abs = join(workdir, target);
  if (!existsSync(abs)) return { pass: false, score: 0, detail: `target missing: ${target}` };

  const content = readFileSync(abs, 'utf8');
  const count = content.split(marker).length - 1;
  const pass = count <= targetMax;
  // Score scales down as count exceeds the bar (clamped to [0,1]).
  const baseline = Number(task?.expected?.baseline ?? Math.max(count, targetMax + 1));
  const score = baseline <= targetMax ? 1 : Math.max(0, Math.min(1, (baseline - count) / (baseline - targetMax)));
  return {
    pass,
    score,
    detail: `${target}: ${count} × "${marker}" (target ≤ ${targetMax}) — ${pass ? 'met' : 'over'}`,
  };
}
