// Attribution & adaptations: see CREDITS.md. Eval verifier (self-improving-harness Brief).
/**
 * build-fix verifier: a task is solved when the declared target file passes `node --check`
 * (i.e. it parses). Deterministic, token-free, runs anywhere Node runs. The agent's job in this
 * task is to fix a syntax error; this verifier scores the OUTCOME, not the agent's self-report.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default function verify({ workdir, task }) {
  const target = task?.target;
  if (!target) return { pass: false, score: 0, detail: 'task.target not declared' };
  const abs = join(workdir, target);
  if (!existsSync(abs)) return { pass: false, score: 0, detail: `target missing: ${target}` };

  const result = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  const pass = result.status === 0;
  return {
    pass,
    score: pass ? 1 : 0,
    detail: pass
      ? `node --check passed on ${target}`
      : `node --check failed on ${target}: ${(result.stderr || '').trim().split('\n')[0] || 'parse error'}`,
  };
}
