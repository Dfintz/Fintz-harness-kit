#!/usr/bin/env node
/**
 * Ollama adapter for harness loop runners.
 *
 * Reads a prompt from stdin and sends it to Ollama /api/generate.
 * Prints model output to stdout so run-loop.mjs can treat it like any other CLI agent.
 *
 * Usage:
 *   node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b
 *
 * Example with loop runner:
 *   node scripts/harness/run-loop.mjs build-fix --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b"
 */

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }

    if (arg === '--help') {
      flags.help = true;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }

    flags[key] = next;
    i += 1;
  }
  return flags;
}

function parseNumber(value) {
  if (value === undefined || value === true) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric value, received: ${value}`);
  }
  return parsed;
}

function trimTrailingSlash(url) {
  return String(url || '').replace(/\/+$/, '');
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: {
          command: 'node scripts/harness/ollama-agent.mjs --model <name> [options]',
          options: {
            '--model <name>':
              'Ollama model tag (default: HARNESS_OLLAMA_MODEL or qwen2.5-coder:14b).',
            '--host <url>': 'Ollama base URL (default: OLLAMA_HOST or http://localhost:11434).',
            '--system <text>': 'Optional system prompt.',
            '--temperature <n>': 'Optional temperature.',
            '--num-predict <n>': 'Optional max tokens.',
          },
        },
      },
      null,
      2
    )}\n`
  );
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const model = String(
    flags.model || process.env.HARNESS_OLLAMA_MODEL || 'qwen2.5-coder:14b'
  ).trim();
  const host = trimTrailingSlash(flags.host || process.env.OLLAMA_HOST || 'http://localhost:11434');
  const prompt = await readStdin();

  if (!prompt) {
    throw new Error('No prompt provided on stdin.');
  }

  const options = {};
  const temperature = parseNumber(flags.temperature ?? process.env.HARNESS_OLLAMA_TEMPERATURE);
  if (temperature !== undefined) options.temperature = temperature;

  const numPredict = parseNumber(flags['num-predict'] ?? process.env.HARNESS_OLLAMA_NUM_PREDICT);
  if (numPredict !== undefined) options.num_predict = Math.trunc(numPredict);

  const payload = {
    model,
    prompt,
    stream: false,
  };

  const systemPrompt = flags.system || process.env.HARNESS_OLLAMA_SYSTEM;
  if (typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
    payload.system = systemPrompt;
  }

  if (Object.keys(options).length > 0) {
    payload.options = options;
  }

  const response = await fetch(`${host}/api/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ollama request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  const text = typeof data.response === 'string' ? data.response.trim() : '';
  if (!text) {
    throw new Error('Ollama returned an empty response payload.');
  }

  process.stdout.write(`${text}\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
