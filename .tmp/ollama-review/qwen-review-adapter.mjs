import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const prompt = readFileSync(0, 'utf8');
const result = spawnSync('ollama', ['run', 'qwen2.5-coder:32b'], {
  input: prompt,
  encoding: 'utf8',
});

const output = String(result.stdout ?? '');
process.stdout.write(output);
const verdicts = [...output.matchAll(/VERDICT:\s*(APPROVED|REVISE)/gi)];
if (verdicts.length > 0) {
  process.stdout.write(`\nVERDICT: ${verdicts.at(-1)[1].toUpperCase()}\n`);
}
if (result.stderr) process.stderr.write(String(result.stderr));
process.exit(result.status ?? 1);
