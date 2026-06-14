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
 *
 * Provider-aware: targets Ollama (default) or LM Studio via --provider / HARNESS_LLM_PROVIDER.
 */
import { generateText, resolveProvider } from './llm-provider.mjs';

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

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: {
          command: 'node scripts/harness/ollama-agent.mjs --model <name> [options]',
          options: {
            '--provider <name>':
              'Local LLM provider: ollama (default) or lmstudio. Env: HARNESS_LLM_PROVIDER.',
            '--model <name>':
              'Model id (default: HARNESS_LLM_MODEL / HARNESS_OLLAMA_MODEL, else qwen2.5-coder:14b for ollama or local-model for lmstudio).',
            '--host <url>':
              'Base URL (default: provider host — ollama http://localhost:11434, lmstudio http://localhost:1234). Env: HARNESS_LLM_HOST / OLLAMA_HOST.',
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

  const provider = resolveProvider(flags.provider);
  const fallbackModel = provider === 'lmstudio' ? 'local-model' : 'qwen2.5-coder:14b';
  const model = String(
    flags.model || process.env.HARNESS_LLM_MODEL || process.env.HARNESS_OLLAMA_MODEL || fallbackModel
  ).trim();
  const host = flags.host || process.env.HARNESS_LLM_HOST || process.env.OLLAMA_HOST;
  const prompt = await readStdin();

  if (!prompt) {
    throw new Error('No prompt provided on stdin.');
  }

  const temperature = parseNumber(
    flags.temperature ?? process.env.HARNESS_LLM_TEMPERATURE ?? process.env.HARNESS_OLLAMA_TEMPERATURE
  );
  const numPredict = parseNumber(
    flags['num-predict'] ?? process.env.HARNESS_LLM_NUM_PREDICT ?? process.env.HARNESS_OLLAMA_NUM_PREDICT
  );

  const systemPrompt = flags.system || process.env.HARNESS_LLM_SYSTEM || process.env.HARNESS_OLLAMA_SYSTEM;

  const text = (
    await generateText({
      provider,
      host,
      model,
      system:
        typeof systemPrompt === 'string' && systemPrompt.trim().length > 0 ? systemPrompt : undefined,
      prompt,
      temperature,
      numPredict,
    })
  ).trim();

  process.stdout.write(`${text}\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
