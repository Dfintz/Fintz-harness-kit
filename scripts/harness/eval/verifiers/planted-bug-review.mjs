// Attribution & adaptations: see CREDITS.md. Eval verifier (self-improving-harness Brief).
/**
 * planted-bug-review verifier: the task plants an obvious vulnerability and asks the agent to write
 * a review file naming it. A weak review ("found some issues") fails; the verifier requires the
 * review to contain ALL of task.expected.mustContain (case-insensitive) — e.g. the specific
 * dangerous construct and line. This resists the model claiming success without substance.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export default function verify({ workdir, task }) {
  const file = task?.expected?.file;
  const mustContain = Array.isArray(task?.expected?.mustContain) ? task.expected.mustContain : [];
  if (!file || mustContain.length === 0) {
    return { pass: false, score: 0, detail: 'task.expected.file/mustContain not declared' };
  }

  const abs = join(workdir, file);
  if (!existsSync(abs)) {
    return { pass: false, score: 0, detail: `review file not produced: ${file}` };
  }

  const haystack = readFileSync(abs, 'utf8').toLowerCase();
  const missing = mustContain.filter(token => !haystack.includes(String(token).toLowerCase()));
  const matched = mustContain.length - missing.length;
  const pass = missing.length === 0;
  return {
    pass,
    score: mustContain.length ? matched / mustContain.length : 0,
    detail: pass
      ? `${file} names all ${mustContain.length} required findings`
      : `${file} missing: ${missing.join(', ')}`,
  };
}
