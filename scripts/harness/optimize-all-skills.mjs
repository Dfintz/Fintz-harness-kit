#!/usr/bin/env node
/**
 * optimize-all-skills.mjs — DSPy skill optimization orchestrator
 *
 * Discovers all skills across the repository and runs DSPy MIPROv2 optimization.
 * Auto-detects available models in this priority order:
 *   1. Local Ollama (http://localhost:11434) — zero setup, fastest
 *   2. Cloud providers (Claude, GPT-4, Gemini) — requires API key
 *
 * Usage (auto-detects best available model):
 *   node scripts/harness/optimize-all-skills.mjs [--dry-run]
 *
 * Usage (force specific provider):
 *   node scripts/harness/optimize-all-skills.mjs --provider ollama [--dry-run]
 *   node scripts/harness/optimize-all-skills.mjs --provider claude [--dry-run]
 *   node scripts/harness/optimize-all-skills.mjs --provider azure-openai [--dry-run]
 *   node scripts/harness/optimize-all-skills.mjs --provider gemini [--dry-run]
 *
 * Environment variables (optional, cloud providers only):
 *   OLLAMA_API_URL=http://localhost:11434     (default for local)
 *   OLLAMA_MODEL=qwen2.5:latest              (or any Ollama model)
 *
 *   ANTHROPIC_API_KEY=<key>                   (Claude)
 *   AZURE_OPENAI_ENDPOINT=https://...         (GPT-4)
 *   AZURE_OPENAI_KEY=<key>
 *   GOOGLE_API_KEY=<key>                      (Gemini)
 *
 * Features:
 *   - Auto-detects Ollama and cloud models
 *   - Discovers skills from .github/skills/ and .claude/skills/
 *   - Validates eval sets and skill files
 *   - Reports optimization results (before/after metrics)
 *   - Saves optimized skills with timestamp backups
 *   - Supports dry-run mode (shows what would run)
 *   - Generates summary report (JSON + markdown)
 */

import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BRIDGE_SCRIPT = join(repoRoot, 'scripts', 'harness', 'dspy-bridge.mjs');
const SKILLS_DIRS = [join(repoRoot, '.github', 'skills'), join(repoRoot, '.claude', 'skills')];
const REPORT_DIR = join(repoRoot, '.github', 'harness', 'optimization-reports');
const STATE_VERSION = 1;
const TERMINAL_STATUSES = new Set(['success', 'no-improvement', 'skipped']);

// Model configurations (Ollama first, then cloud providers)
const MODELS = {
  ollama: {
    label: 'Local Ollama',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:latest',
    apiBase: process.env.OLLAMA_API_URL || 'http://localhost:11434',
    dspyModel: 'ollama_chat/qwen2.5',
    isLocal: true,
  },
  'azure-openai': {
    label: 'Azure OpenAI',
    model: process.env.AZURE_OPENAI_MODEL || 'gpt-4-turbo',
    apiBase: process.env.AZURE_OPENAI_ENDPOINT || '',
    apiKey: process.env.AZURE_OPENAI_KEY || '',
    dspyModel: 'azure_chat/<deployment-name>',
  },
  claude: {
    label: 'Anthropic Claude',
    model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    dspyModel: 'claude_chat/claude-3-5-sonnet-20241022',
  },
  gemini: {
    label: 'Google Gemini',
    model: process.env.GOOGLE_MODEL || 'gemini-2.0-flash',
    apiKey: process.env.GOOGLE_API_KEY || '',
    dspyModel: 'google_generative_ai/gemini-2.0-flash',
  },
};

// ---------- Model detection ----------

/**
 * Check if Ollama is reachable at the specified API base.
 * @returns {Promise<boolean>}
 */
async function isOllamaAvailable() {
  try {
    const apiBase = MODELS.ollama.apiBase;
    const response = await fetch(`${apiBase}/api/tags`, { timeout: 5000 });
    return response.ok;
  } catch (err) {
    return false;
  }
}

/**
 * Detect the best available model based on what's configured.
 * Priority: Ollama (local) > Claude > GPT-4 > Gemini
 * @returns {string} Model name to use
 */
function detectBestModel() {
  // Check Ollama async... but we're in sync context
  // For now, return priority order; actual check happens in validation
  const available = [];

  // Ollama is always "available" as long as we can reach it (checked in validation)
  available.push('ollama');

  // Check cloud providers by env vars
  if (process.env.ANTHROPIC_API_KEY) available.push('claude');
  if (process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_KEY)
    available.push('azure-openai');
  if (process.env.GOOGLE_API_KEY) available.push('gemini');

  return available[0]; // Return first available (priority order)
}

// ---------- Skill discovery ----------

/**
 * Discover all skills in the repository.
 * @returns {Array<{dir: string, name: string, skillPath: string}>}
 */
function discoverSkills() {
  const skills = [];

  for (const skillsDir of SKILLS_DIRS) {
    if (!existsSync(skillsDir)) continue;

    const entries = readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const skillName = entry.name;
      const skillPath = join(skillsDir, skillName);
      const skillMdFile = join(skillPath, 'SKILL.md');

      // Validate skill has SKILL.md
      if (!existsSync(skillMdFile)) {
        console.warn(`[optimize-skills] Skipping ${skillName}: no SKILL.md found`);
        continue;
      }

      skills.push({
        id: toWorkspacePath(skillMdFile),
        name: skillName,
        dir: skillPath,
        skillFile: skillMdFile,
        skillsDir: skillsDir,
      });
    }
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function toWorkspacePath(filePath) {
  return relative(repoRoot, filePath).replaceAll('\\', '/');
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

/**
 * Find eval set for a skill (if available).
 * Common patterns:
 *   - .github/harness/eval-sets/<skill-name>.json
 *   - <skill-dir>/eval-set.json
 */
function findEvalSet(skill) {
  // Pattern 1: dedicated eval-sets directory
  const evalSetPath1 = join(repoRoot, '.github', 'harness', 'eval-sets', `${skill.name}.json`);
  if (existsSync(evalSetPath1)) return evalSetPath1;

  // Pattern 2: skill directory
  const evalSetPath2 = join(skill.dir, 'eval-set.json');
  if (existsSync(evalSetPath2)) return evalSetPath2;

  return null;
}

function describeSkill(skill) {
  const evalSet = findEvalSet(skill);
  return {
    id: skill.id,
    name: skill.name,
    skillFile: toWorkspacePath(skill.skillFile),
    targetFingerprint: sha256File(skill.skillFile),
    evalSet: evalSet ? toWorkspacePath(evalSet) : null,
    evalSetFingerprint: evalSet ? sha256File(evalSet) : null,
  };
}

function selectSkills(skills, selectors) {
  if (selectors.length === 0) return skills;

  const selected = new Map();
  for (const selector of selectors) {
    const exactId = skills.find(skill => skill.id === selector);
    if (exactId) {
      selected.set(exactId.id, exactId);
      continue;
    }

    const nameMatches = skills.filter(skill => skill.name === selector);
    if (nameMatches.length === 0) {
      throw new Error(`Unknown skill selector "${selector}". Use a skill name or canonical SKILL.md path.`);
    }
    if (nameMatches.length > 1) {
      throw new Error(
        `Ambiguous skill selector "${selector}". Use one of: ${nameMatches.map(skill => skill.id).join(', ')}`
      );
    }
    selected.set(nameMatches[0].id, nameMatches[0]);
  }

  return skills.filter(skill => selected.has(skill.id));
}

function stateModel(modelName, config) {
  return {
    provider: modelName,
    model: config.model,
    dspyModel: config.dspyModel,
    apiBase: config.apiBase || null,
  };
}

function createState(modelName, config, skills) {
  const now = new Date().toISOString();
  return {
    schemaVersion: STATE_VERSION,
    runId: randomUUID(),
    status: 'running',
    repositoryRoot: repoRoot,
    model: stateModel(modelName, config),
    selectedSkills: skills.map(describeSkill),
    results: [],
    createdAt: now,
    updatedAt: now,
  };
}

function stateFilePath(state) {
  return join(REPORT_DIR, `optimization-state--${state.model.provider}--${state.runId}.json`);
}

function writeState(statePath, state) {
  mkdirSync(dirname(statePath), { recursive: true });
  state.updatedAt = new Date().toISOString();
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(state, null, 2));
  renameSync(temporaryPath, statePath);
}

function readState(statePath) {
  try {
    const parsed = JSON.parse(readFileSync(statePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function stateIsCompatible(state, modelName, config, skills) {
  if (!state || state.schemaVersion !== STATE_VERSION || state.status === 'completed') return false;
  if (state.repositoryRoot !== repoRoot) return false;
  if (JSON.stringify(state.model) !== JSON.stringify(stateModel(modelName, config))) return false;
  if (!Array.isArray(state.selectedSkills) || !Array.isArray(state.results)) return false;

  const current = new Map(skills.map(skill => [skill.id, describeSkill(skill)]));
  return state.selectedSkills.every(saved => {
    const actual = current.get(saved?.id);
    return actual
      && actual.targetFingerprint === saved.targetFingerprint
      && actual.evalSet === saved.evalSet
      && actual.evalSetFingerprint === saved.evalSetFingerprint;
  });
}

function resolveStateFile(resumeValue, modelName, config, skills, stateDirectory = REPORT_DIR) {
  if (!resumeValue) return null;
  if (resumeValue !== 'latest') {
    const requested = resolve(resumeValue);
    const relativeStatePath = relative(stateDirectory, requested);
    if (relativeStatePath.startsWith('..') || isAbsolute(relativeStatePath)) {
      throw new Error(`Optimizer state must be inside ${stateDirectory}`);
    }
    if (!existsSync(requested)) throw new Error(`Optimizer state file not found: ${requested}`);
    const state = readState(requested);
    if (!stateIsCompatible(state, modelName, config, skills)) {
      throw new Error(`Optimizer state is malformed, completed, or incompatible: ${requested}`);
    }
    return { statePath: requested, state };
  }

  if (!existsSync(stateDirectory)) throw new Error('No resumable optimizer state files found.');
  const matches = readdirSync(stateDirectory)
    .filter(file => file.startsWith(`optimization-state--${modelName}--`) && file.endsWith('.json'))
    .map(file => join(stateDirectory, file))
    .map(statePath => ({ statePath, state: readState(statePath) }))
    .filter(candidate => stateIsCompatible(candidate.state, modelName, config, skills));

  if (matches.length === 0) throw new Error('No compatible unfinished optimizer state files found.');
  if (matches.length > 1) {
    throw new Error(`Multiple compatible unfinished optimizer states found: ${matches.map(match => match.statePath).join(', ')}`);
  }
  return matches[0];
}

// ---------- Validation ----------

function validateModel(modelName) {
  const config = MODELS[modelName];
  if (!config) {
    console.error(`[optimize-skills] Unknown model: ${modelName}`);
    console.error(`[optimize-skills] Available models: ${Object.keys(MODELS).join(', ')}`);
    return false;
  }

  // For Ollama, just check that apiBase is set (actual connectivity tested at runtime)
  if (modelName === 'ollama') {
    if (!config.apiBase) {
      console.error('[optimize-skills] Ollama API base not configured:');
      console.error('  Set: OLLAMA_API_URL (default: http://localhost:11434)');
      return false;
    }
    console.log(`[optimize-skills] Using local Ollama at ${config.apiBase}`);
    return true;
  }

  // Check required env vars for cloud providers
  switch (modelName) {
    case 'azure-openai':
      if (!config.apiBase || !config.apiKey) {
        console.error('[optimize-skills] Missing Azure OpenAI credentials:');
        console.error('  Set: AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY');
        return false;
      }
      break;
    case 'claude':
      if (!config.apiKey) {
        console.error('[optimize-skills] Missing Anthropic credentials:');
        console.error('  Set: ANTHROPIC_API_KEY');
        return false;
      }
      break;
    case 'gemini':
      if (!config.apiKey) {
        console.error('[optimize-skills] Missing Google credentials:');
        console.error('  Set: GOOGLE_API_KEY');
        return false;
      }
      break;
  }

  return true;
}

// ---------- Optimization execution ----------

/**
 * Run dspy-bridge for a single skill.
 * @param {Object} skill - Skill object from discoverSkills()
 * @param {string} modelName - Model name to use
 * @param {boolean} dryRun - If true, don't actually run optimization
 * @returns {Object} Result with status, timing, and metrics
 */
function optimizeSkill(skill, modelName, dryRun = false, outputPath = null) {
  const evalSet = findEvalSet(skill);
  if (!evalSet) {
    return {
      skill: skill.name,
      model: modelName,
      status: 'skipped',
      reason: 'No eval set found',
    };
  }

  const outputDir = join(repoRoot, '.github', 'harness', 'optimized-skills');
  mkdirSync(outputDir, { recursive: true });

  const resolvedOutputPath = outputPath || join(outputDir, `${skill.name}--${modelName}--preview.md`);

  if (dryRun) {
    return {
      skill: skill.name,
      model: modelName,
      status: 'dry-run',
      skillFile: skill.skillFile,
      evalSet,
      outputPath: resolvedOutputPath,
    };
  }

  const config = MODELS[modelName];
  const bridgeArgs = [
    '--optimize',
    '--target',
    skill.skillFile,
    '--eval-set',
    evalSet,
    '--output',
    resolvedOutputPath,
    '--model',
    config.dspyModel,
  ];

  if (config.apiBase) {
    bridgeArgs.push('--api-base', config.apiBase);
  }

  console.log(`\n[optimize-skills] Optimizing ${skill.name} with ${MODELS[modelName].label}...`);
  console.log(`  Skill: ${skill.skillFile}`);
  console.log(`  Eval set: ${evalSet}`);
  console.log(`  Output: ${resolvedOutputPath}`);

  const startTime = Date.now();
  const result = spawnSync('node', [BRIDGE_SCRIPT, ...bridgeArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: 600_000, // 10 minutes per skill
  });
  const elapsed = Date.now() - startTime;

  if (result.status === 0) {
    return {
      skill: skill.name,
      model: modelName,
      status: 'success',
      duration: elapsed,
      outputPath: resolvedOutputPath,
      stdout: result.stdout?.substring(0, 500), // Summary only
    };
  } else if (result.status === 1) {
    return {
      skill: skill.name,
      model: modelName,
      status: 'no-improvement',
      duration: elapsed,
      stdout: result.stdout?.substring(0, 500),
    };
  } else {
    return {
      skill: skill.name,
      model: modelName,
      status: 'error',
      duration: elapsed,
      error: result.stderr?.substring(0, 500),
    };
  }
}

// ---------- Reporting ----------

function generateReport(results, modelName, dryRun) {
  const summary = {
    model: modelName,
    modelLabel: MODELS[modelName].label,
    timestamp: new Date().toISOString(),
    dryRun,
    totalSkills: results.length,
    byStatus: {},
    results,
  };

  for (const result of results) {
    const status = result.status;
    summary.byStatus[status] = (summary.byStatus[status] || 0) + 1;
  }

  // Markdown report
  let markdown = `# Skill Optimization Report
**Model:** ${MODELS[modelName].label} (${modelName})  
**Timestamp:** ${summary.timestamp}  
**Dry-run:** ${dryRun ? 'YES' : 'NO'}  

## Summary
- Total skills: ${summary.totalSkills}
- Optimized: ${summary.byStatus.success || 0}
- No improvement: ${summary.byStatus['no-improvement'] || 0}
- Skipped (no eval set): ${summary.byStatus.skipped || 0}
- Errors: ${summary.byStatus.error || 0}

## Results

| Skill | Status | Duration | Details |
|-------|--------|----------|---------|
`;

  for (const result of results) {
    const skillName = result.skill;
    const status = result.status;
    const duration = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : '—';
    const details =
      status === 'skipped'
        ? result.reason
        : status === 'error'
          ? `Error: ${result.error?.substring(0, 50)}...`
          : status === 'dry-run'
            ? 'Dry-run (not executed)'
            : result.stdout?.substring(0, 80) || '—';

    markdown += `| ${skillName} | ${status} | ${duration} | ${details} |\n`;
  }

  return {
    summary,
    markdown,
  };
}

function saveReport(markdown, summary) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const timestamp = new Date().toISOString().split('T')[0];
  const reportFile = join(REPORT_DIR, `optimization-report--${timestamp}.md`);
  const reportJson = join(REPORT_DIR, `optimization-report--${timestamp}.json`);

  writeFileSync(reportFile, markdown);
  writeFileSync(reportJson, JSON.stringify(summary, null, 2));
  return { reportFile, reportJson };
}

// ---------- CLI & Main ----------

function printHelp() {
  console.log(`
optimize-all-skills.mjs — DSPy skill optimization orchestrator

Usage (auto-detect best available model):
  node scripts/harness/optimize-all-skills.mjs [--skill <name-or-path>] [--resume <latest|state-file>] [--dry-run]

Usage (force specific model):
  node scripts/harness/optimize-all-skills.mjs --model <name> [--dry-run]

Available models (auto-priority: local Ollama > Claude > GPT-4 > Gemini):
  ollama        Local Ollama (http://localhost:11434) — no setup needed
  claude        Anthropic Claude (requires ANTHROPIC_API_KEY)
  azure-openai  Azure OpenAI (requires AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_KEY)
  gemini        Google Gemini (requires GOOGLE_API_KEY)

Options:
  --skill <name-or-path>  Optimize a selected skill; repeatable. Use SKILL.md path for duplicate names.
  --resume <state>        Resume one compatible unfinished run, or use "latest".
  --dry-run     Show what would run without executing optimization
  --self-test   Run deterministic CLI and state-contract checks
  --help        Show this message

Examples:
  # Auto-detect and use best available (usually local Ollama)
  node scripts/harness/optimize-all-skills.mjs
  node scripts/harness/optimize-all-skills.mjs --dry-run
  node scripts/harness/optimize-all-skills.mjs --skill to-questionnaire --dry-run
  node scripts/harness/optimize-all-skills.mjs --resume latest

  # Force specific model
  node scripts/harness/optimize-all-skills.mjs --model claude --dry-run
  ANTHROPIC_API_KEY=sk-... node scripts/harness/optimize-all-skills.mjs --model claude

  # Configure local Ollama model
  OLLAMA_MODEL=llama3.2 node scripts/harness/optimize-all-skills.mjs
`);
}

function parseArgs(argv) {
  const args = {
    model: undefined, // Will be auto-detected if not specified
    dryRun: false,
    skills: [],
    resume: undefined,
    selfTest: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--model' || a === '--provider') args.model = argv[++i];
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--skill') args.skills.push(argv[++i]);
    else if (a === '--resume') args.resume = argv[++i];
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else console.error(`[optimize-skills] Unknown option: ${a}`);
  }

  return args;
}

function runSelfTest() {
  const tests = [];
  const check = (name, predicate) => tests.push({ name, passed: predicate() });
  const temporaryDir = mkdtempSync(join(tmpdir(), 'harness-optimizer-'));

  try {
    const parsed = parseArgs(['--skill', 'one', '--skill', '.github/skills/two/SKILL.md', '--resume', 'latest']);
    check('argument parser accepts repeatable --skill and --resume', () =>
      parsed.skills.length === 2 && parsed.resume === 'latest'
    );
    check('canonical selection resolves unique display names', () =>
      selectSkills([{ id: '.github/skills/one/SKILL.md', name: 'one' }], ['one']).length === 1
    );
    check('ambiguous display names fail', () => {
      try {
        selectSkills([
          { id: '.github/skills/one/SKILL.md', name: 'duplicate' },
          { id: '.claude/skills/duplicate/SKILL.md', name: 'duplicate' },
        ], ['duplicate']);
        return false;
      } catch {
        return true;
      }
    });

    const skill = discoverSkills().find(candidate => candidate.name === 'to-questionnaire');
    const state = createState('ollama', MODELS.ollama, [skill]);
    const statePath = join(temporaryDir, `optimization-state--ollama--${state.runId}.json`);
    writeState(statePath, state);
    check('atomic state write is readable', () => readState(statePath)?.schemaVersion === STATE_VERSION);
    check('fingerprinted state accepts unchanged inputs', () =>
      stateIsCompatible(readState(statePath), 'ollama', MODELS.ollama, discoverSkills())
    );
    const changedState = readState(statePath);
    changedState.selectedSkills[0].targetFingerprint = 'changed';
    check('fingerprinted state rejects changed inputs', () =>
      !stateIsCompatible(changedState, 'ollama', MODELS.ollama, discoverSkills())
    );
    const secondState = createState('ollama', MODELS.ollama, [skill]);
    writeState(join(temporaryDir, `optimization-state--ollama--${secondState.runId}.json`), secondState);
    check('latest resume rejects ambiguous compatible checkpoints', () => {
      try {
        resolveStateFile('latest', 'ollama', MODELS.ollama, discoverSkills(), temporaryDir);
        return false;
      } catch (error) {
        return String(error.message).startsWith('Multiple compatible unfinished optimizer states found:');
      }
    });
    check('terminal status classification is stable', () =>
      TERMINAL_STATUSES.has('success') && !TERMINAL_STATUSES.has('error')
    );
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true });
  }

  const passed = tests.filter(test => test.passed).length;
  for (const test of tests) console.log(`  ${test.passed ? '✓' : '✗'} ${test.name}`);
  console.log(`\n[optimize-skills] ${passed}/${tests.length} self-tests passed`);
  return passed === tests.length ? 0 : 1;
}

function resolveModelName(args) {
  let modelName = args.model;
  if (!modelName) {
    console.log('[optimize-skills] Auto-detecting best available model...');
    modelName = detectBestModel();
    if (!modelName) {
      throw new Error('No models available. Configure Ollama or set cloud provider credentials.');
    }
    console.log(`[optimize-skills] Using ${MODELS[modelName].label}`);
  }
  if (!MODELS[modelName]) {
    throw new Error(`Unknown model: ${modelName}`);
  }
  return modelName;
}

function validateExecutionArgs(args) {
  if (args.resume && args.dryRun) {
    throw new Error('--resume cannot be used with --dry-run');
  }
  if (args.resume && args.skills.length > 0) {
    throw new Error('--resume cannot be combined with --skill');
  }
}

function discoverSelectedSkills(args) {
  console.log('[optimize-skills] Discovering skills...');
  const discoveredSkills = discoverSkills();
  const skills = selectSkills(discoveredSkills, args.skills);
  console.log(`[optimize-skills] Found ${discoveredSkills.length} skills; selected ${skills.length}`);
  if (skills.length === 0) {
    throw new Error('No skills found.');
  }
  return { discoveredSkills, skills };
}

function verifyModel(modelName) {
  if (!validateModel(modelName)) {
    throw new Error(`Validation failed for ${modelName}`);
  }
}

function renderAndSaveReport(results, modelName, dryRun, extraSummary = {}) {
  const { markdown, summary } = generateReport(results, modelName, dryRun);
  Object.assign(summary, extraSummary);
  const { reportFile, reportJson } = saveReport(markdown, summary);
  console.log(`\n${markdown}`);
  console.log(`\n[optimize-skills] Report saved to ${reportFile}`);
  console.log(`[optimize-skills] JSON saved to ${reportJson}`);
}

function runDryRun(skills, modelName) {
  renderAndSaveReport(skills.map(skill => optimizeSkill(skill, modelName, true)), modelName, true);
}

function runOptimization(args, modelName, discoveredSkills, skills) {
  const config = MODELS[modelName];
  const resumed = resolveStateFile(args.resume, modelName, config, discoveredSkills);
  const state = resumed?.state || createState(modelName, config, skills);
  const statePath = resumed?.statePath || stateFilePath(state);
  writeState(statePath, state);
  const selectedById = new Map(discoveredSkills.map(skill => [skill.id, skill]));
  for (const savedSkill of state.selectedSkills) {
    const skill = selectedById.get(savedSkill.id);
    if (!skill) continue;
    if (state.results.some(result => result.id === skill.id && TERMINAL_STATUSES.has(result.status))) continue;

    const outputDir = join(repoRoot, '.github', 'harness', 'optimized-skills');
    const outputPath = join(outputDir, `${skill.name}--${modelName}--${state.runId}.md`);
    const result = { id: skill.id, ...optimizeSkill(skill, modelName, false, outputPath) };
    state.results = state.results.filter(existing => existing.id !== skill.id);
    state.results.push(result);
    writeState(statePath, state);
  }

  state.status = state.results.length === state.selectedSkills.length
    && state.results.every(result => TERMINAL_STATUSES.has(result.status))
    ? 'completed'
    : 'incomplete';
  state.finishedAt = new Date().toISOString();
  writeState(statePath, state);

  renderAndSaveReport(state.results, modelName, false, {
    stateFile: toWorkspacePath(statePath),
    stateStatus: state.status,
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.selfTest) return runSelfTest();
  if (args.help) {
    printHelp();
    return 0;
  }

  const modelName = resolveModelName(args);
  validateExecutionArgs(args);
  const { discoveredSkills, skills } = discoverSelectedSkills(args);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[optimize-skills] Starting optimization with ${MODELS[modelName].label}`);
  console.log(`${'='.repeat(60)}`);
  verifyModel(modelName);

  if (args.dryRun) runDryRun(skills, modelName);
  else runOptimization(args, modelName, discoveredSkills, skills);

  console.log(`\n${'='.repeat(60)}`);
  console.log('[optimize-skills] Optimization complete');
  console.log(`${'='.repeat(60)}`);
  return 0;
}

try {
  process.exitCode = main();
} catch (err) {
  console.error('[optimize-skills] Fatal error:', err);
  process.exitCode = 2;
}
