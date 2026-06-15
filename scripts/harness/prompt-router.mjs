#!/usr/bin/env node
/**
 * Prompt router — repo-local policy for sending prompts through the harness stage machine.
 *
 * This does NOT intercept editor prompts at the runtime layer; current agent runtimes here do not
 * expose a reliable per-prompt hook. Instead it is the executable form of the repo policy used by:
 *   - SessionStart banner hooks
 *   - AGENTS / Copilot instructions
 *   - humans or wrappers that want a deterministic route recommendation
 *
 * It answers two questions:
 *   1. Is this prompt trivial enough to start at Implement?
 *   2. Which model should own each stage in this environment?
 *
 * Usage:
 *   node scripts/harness/prompt-router.mjs banner
 *   node scripts/harness/prompt-router.mjs route --task "fix auth middleware race"
 *   node scripts/harness/prompt-router.mjs handoff --profile feature --task "ship auth audit"
 *   echo "update typo in README" | node scripts/harness/prompt-router.mjs route --stdin --json
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const configPath = join(repoRoot, 'harness.config.json');
const runsDir = join(repoRoot, '.github', 'harness', 'runs');
const handoffEventsPath = join(runsDir, 'handoffs.jsonl');

function fail(message, code = 2) {
  process.stderr.write(`[prompt-router] ${message}\n`);
  process.exit(code);
}

export function loadConfig() {
  if (!existsSync(configPath)) {
    fail(`missing harness.config.json at ${configPath}`);
  }
  return JSON.parse(readFileSync(configPath, 'utf8'));
}

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json' || arg === '--stdin' || arg === '--help') {
      flags[arg.slice(2)] = true;
    } else if (arg === '--profile') {
      flags.profile = argv[++i];
    } else if (arg === '--task') {
      flags.task = argv[++i];
    } else {
      flags._.push(arg);
    }
  }
  return flags;
}

function readStdin() {
  return new Promise(resolveText => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => {
      data += chunk;
    });
    process.stdin.on('end', () => resolveText(data));
  });
}

function normalize(text) {
  return String(text ?? '')
    .trim()
    .toLowerCase();
}

function getModelAssignments(config) {
  return {
    implementer: config.models?.implementer?.model ?? 'gpt-5.3-codex',
    reviewer: config.models?.reviewer?.model ?? 'claude-opus-4.8',
  };
}

function getProfile(config, profileName) {
  if (!profileName) {
    return null;
  }

  const profile = config.routing?.profiles?.[profileName] ?? null;
  if (!profile) {
    fail(`unknown profile: ${profileName}`);
  }
  return profile;
}

function validateModelSeparation(config) {
  const { implementer, reviewer } = getModelAssignments(config);
  const mustDiffer = config.routing?.requireDistinctReviewerAndImplementer !== false;
  if (mustDiffer && implementer === reviewer) {
    fail(
      `implementer and reviewer must be different models in this repo (both are ${implementer}). Update harness.config.json.`
    );
  }
  return { implementer, reviewer };
}

function buildModelRouting(config) {
  const { implementer, reviewer } = validateModelSeparation(config);
  return {
    understand: reviewer,
    architect: reviewer,
    implement: implementer,
    'review-breadth': reviewer,
    'review-depth': reviewer,
    feedback: reviewer,
    'build-fix': implementer,
    'test-fix': implementer,
    'cross-model-review': `${implementer} -> ${reviewer}`,
  };
}

function resolveTaskText(flags) {
  if (flags.task) {
    return flags.task;
  }

  if (flags._.length > 1) {
    return flags._.slice(1).join(' ');
  }

  return '';
}

function pct(value, total) {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function buildModelPhaseUsage(stages, models) {
  const byModel = new Map();
  for (const stage of stages) {
    const model = models[stage] ?? null;
    if (!model) continue;
    if (!byModel.has(model)) {
      byModel.set(model, []);
    }
    byModel.get(model).push(stage);
  }

  const totalPhases = stages.length;
  return [...byModel.entries()].map(([model, phases]) => ({
    model,
    phases,
    phaseCount: phases.length,
    phaseSharePct: pct(phases.length, totalPhases),
  }));
}

function parseTokenUsageByModel() {
  const raw = process.env.HARNESS_TOKEN_USAGE_BY_MODEL;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const normalized = {};
    for (const [model, tokens] of Object.entries(parsed)) {
      const count = Number(tokens);
      if (!Number.isFinite(count) || count < 0) continue;
      normalized[model] = Math.round(count);
    }
    return Object.keys(normalized).length ? normalized : null;
  } catch {
    return null;
  }
}

function attachTokenUsage(modelPhaseUsage) {
  const tokenUsageByModel = parseTokenUsageByModel();
  if (!tokenUsageByModel) {
    return modelPhaseUsage.map(entry => ({
      ...entry,
      tokenPct: entry.phaseSharePct,
      tokenSource: 'phase-estimate',
    }));
  }

  const totalTokens = Object.values(tokenUsageByModel).reduce((sum, n) => sum + n, 0);
  return modelPhaseUsage.map(entry => {
    const tokens = tokenUsageByModel[entry.model] ?? 0;
    return {
      ...entry,
      tokens,
      tokenPct: pct(tokens, totalTokens),
      tokenSource: 'actual',
    };
  });
}

export function planTask(taskText, config, options = {}) {
  const text = normalize(taskText);
  const routing = config.routing ?? {};
  const trivialKeywords = routing.trivialKeywords ?? [];
  const nonTrivialKeywords = routing.nonTrivialKeywords ?? [];
  const profileName = options.profile ?? null;
  const profile = getProfile(config, profileName);

  const trivialHit = trivialKeywords.find(keyword => text.includes(keyword));
  const nonTrivialHit = nonTrivialKeywords.find(keyword => text.includes(keyword));

  const trivial = !profile && Boolean(trivialHit) && !nonTrivialHit && text.length < 180;
  const stages =
    profile?.stages ??
    (trivial
      ? [routing.trivialStartsAt ?? 'implement']
      : (routing.nonTrivialStages ?? [
          'understand',
          'architect',
          'implement',
          'review-breadth',
          'review-depth',
          'feedback',
        ]));

  const modelRouting = buildModelRouting(config);

  let why;
  if (profile) {
    why = profile.description ?? `profile-selected handoff: ${profileName}`;
  } else if (trivial) {
    why = `matched trivial keyword: ${trivialHit}`;
  } else if (nonTrivialHit) {
    why = `matched non-trivial keyword: ${nonTrivialHit}`;
  } else {
    why = 'default harness-first routing for any prompt that is not obviously trivial';
  }

  const modelByStage = Object.fromEntries(
    stages.map(stage => [stage, modelRouting[stage] ?? modelRouting.implement])
  );
  const modelPhaseUsage = attachTokenUsage(buildModelPhaseUsage(stages, modelByStage));

  return {
    task: String(taskText ?? '').trim(),
    profile: profileName,
    mode: profile?.mode ?? (trivial ? 'trivial' : 'non-trivial'),
    why,
    stages,
    models: modelByStage,
    modelPhaseUsage,
    crossModelReview: modelRouting['cross-model-review'],
  };
}

export function classifyTask(taskText, config) {
  return planTask(taskText, config);
}

export function renderCompactRoute(route) {
  return (
    `[prompt-router] ${route.mode.toUpperCase()} — ${route.why}\n` +
    `[prompt-router] stages: ${route.stages.join(' -> ')}\n` +
    `[prompt-router] models: ${Object.entries(route.models)
      .map(([stage, model]) => `${stage}=${model}`)
      .join(', ')}\n` +
    `[prompt-router] cross-model review: ${route.crossModelReview}\n`
  );
}

export function renderHandoffPlan(route) {
  const profileSuffix = route.profile ? ` (${route.profile})` : '';
  const lines = [
    `[prompt-router] operator handoff plan${profileSuffix}`,
    `[prompt-router] task: ${route.task || '<stdin>'}`,
    `[prompt-router] rationale: ${route.why}`,
  ];

  route.stages.forEach((stage, index) => {
    lines.push(`[prompt-router] ${index + 1}. ${stage} -> ${route.models[stage]}`);
  });

  lines.push(`[prompt-router] cross-model review: ${route.crossModelReview}`);
  return `${lines.join('\n')}\n`;
}

function recordHandoffEvent(route) {
  try {
    mkdirSync(runsDir, { recursive: true });
    const event = {
      at: new Date().toISOString(),
      task: route.task,
      profile: route.profile ?? null,
      mode: route.mode,
      why: route.why,
      stages: route.stages,
      models: route.models,
      modelPhaseUsage: route.modelPhaseUsage ?? [],
    };
    appendFileSync(handoffEventsPath, `${JSON.stringify(event)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[prompt-router] warning: could not persist handoff telemetry: ${message}\n`
    );
  }
}

function printBanner(config) {
  const { implementer, reviewer } = validateModelSeparation(config);
  process.stdout.write(
    `[prompt-router] Harness-first mode is ON for this repo.\n` +
      `[prompt-router] Non-trivial prompts route: understand -> architect -> implement -> review-breadth -> review-depth -> feedback\n` +
      `[prompt-router] Model roles: implement=${implementer}; reasoning/review=${reviewer}; cross-model=${implementer} -> ${reviewer}\n` +
      `[prompt-router] Trivial prompts may start at implement only when they are clearly one-file/low-risk.\n`
  );
}

function printReminder() {
  process.stdout.write(
    `[prompt-router] Operator shortcuts:\n` +
      `[prompt-router]   npm run harness:feature -- --task "<feature task>"\n` +
      `[prompt-router]   npm run harness:review -- --task "<review task>"\n` +
      `[prompt-router]   npm run harness:route -- --task "<any prompt>" --json\n`
  );
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage: [
          'node scripts/harness/prompt-router.mjs banner',
          'node scripts/harness/prompt-router.mjs route --task "fix auth middleware race"',
          'node scripts/harness/prompt-router.mjs handoff --profile feature --task "ship auth audit"',
          'node scripts/harness/prompt-router.mjs handoff --profile review --task "review auth audit"',
          'echo "typo in README" | node scripts/harness/prompt-router.mjs route --stdin --json',
        ],
        note: 'Deterministic repo policy helper. It does not intercept editor prompts by itself; use it via session hooks and repo instructions.',
      },
      null,
      2
    )}\n`
  );
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const command = flags._[0] ?? 'banner';
  const config = loadConfig();

  if (command === 'banner') {
    printBanner(config);
    return;
  }

  if (command === 'remind') {
    printReminder();
    return;
  }

  if (command !== 'route' && command !== 'handoff') {
    fail(`unknown command: ${command}`);
  }

  const task = flags.stdin ? await readStdin() : resolveTaskText(flags);
  if (!task || !String(task).trim()) {
    fail('route requires --task "..." or --stdin');
  }

  const route = planTask(task, config, { profile: flags.profile });
  if (command === 'handoff') {
    recordHandoffEvent(route);
  }

  if (flags.json) {
    process.stdout.write(`${JSON.stringify(route, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    command === 'handoff' ? renderHandoffPlan(route) : renderCompactRoute(route)
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error), 1);
  }
}
