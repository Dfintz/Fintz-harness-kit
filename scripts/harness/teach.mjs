#!/usr/bin/env node
/**
 * teach — teach-agent CLI: guided lesson creation with OKF lifecycle gate (v3.1.0).
 *
 * Converts raw domain knowledge into a properly formatted, OKF-compatible lesson file
 * that passes the teach-agent promotion gates. Uses the lifecycle in:
 *   .github/harness/memory/curation/teach-agent-lifecycle.md
 *
 * Outputs to .github/harness/memory/lessons/<slug>.md as a CANDIDATE (status: candidate).
 * A human reviewer promotes to 'adopted' after validating gates 1-5.
 *
 * Usage (interactive — prompts for input):
 *   node scripts/harness/teach.mjs
 *
 * Usage (non-interactive — pass all flags):
 *   node scripts/harness/teach.mjs \
 *     --title "pdftotext requires poppler-utils" \
 *     --context "doc-ingest on Ubuntu" \
 *     --fix "sudo apt install poppler-utils" \
 *     --why "Without it, PDF extraction fails silently" \
 *     --tags "pdf,ubuntu,tools" \
 *     --source "human"
 *
 * Usage (from raw text — AI-assisted extraction):
 *   echo "We discovered that pdftotext needs poppler..." | node scripts/harness/teach.mjs --from-stdin
 *
 * npm run harness:teach
 */
import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');
const lessonsDir = join(repoRoot, '.github', 'harness', 'memory', 'lessons');
const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Lifecycle gate validation
// ---------------------------------------------------------------------------

function validateGates(lesson) {
  const gates = [];

  // Gate 1: Provenance
  gates.push({
    id: 'provenance',
    pass: Boolean(lesson.source && lesson.source.trim()),
    detail: lesson.source ? `source: ${lesson.source}` : 'source is empty — set --source human|loop:<name>|research',
  });

  // Gate 2: Trust
  gates.push({
    id: 'trust',
    pass: Boolean(lesson.source && lesson.source !== 'unknown'),
    detail: lesson.source !== 'unknown' ? 'source quality is defined' : 'source=unknown is not trusted',
  });

  // Gate 3: Contradiction (advisory — cannot check automatically)
  gates.push({
    id: 'contradiction',
    pass: true,
    detail: 'advisory — reviewer must check against active briefs before promoting',
    advisory: true,
  });

  // Gate 4: Freshness
  gates.push({
    id: 'freshness',
    pass: Boolean(lesson.created),
    detail: lesson.created ? `created: ${lesson.created}` : 'created date missing',
  });

  // Gate 5: Operational
  const hasFix = Boolean(lesson.fix && lesson.fix.trim().length > 10);
  const hasContext = Boolean(lesson.context && lesson.context.trim().length > 5);
  gates.push({
    id: 'operational',
    pass: hasFix && hasContext,
    detail: hasFix && hasContext
      ? 'fix/approach and context are present'
      : `missing: ${!hasFix ? 'fix/approach ' : ''}${!hasContext ? 'context' : ''}`.trim(),
  });

  const hardFails = gates.filter(g => !g.pass && !g.advisory);
  return { gates, allPass: hardFails.length === 0, hardFails };
}

// ---------------------------------------------------------------------------
// File generation
// ---------------------------------------------------------------------------

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '');
}

function buildLessonFile(lesson) {
  const tags = lesson.tags ? lesson.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const tagsYaml = tags.length > 0 ? `[${tags.join(', ')}]` : '[]';

  const fm = `---
summary: "${lesson.title.replace(/"/g, "'")}"
type: lesson
status: candidate
source: ${lesson.source || 'human'}
reviewed_by: ""
created: ${lesson.created || today}
updated: ${lesson.updated || today}
tags: ${tagsYaml}
lifecycle: candidate
---

`;

  const body = `# ${lesson.title}

- **Context:** ${lesson.context || '_Fill in context_'}
- **Symptom:** ${lesson.symptom || '_Fill in symptom or trigger_'}
- **Cause:** ${lesson.cause || '_Fill in root cause_'}
- **Fix / approach that worked:** ${lesson.fix || '_Fill in the concrete fix_'}
- **Why it matters:** ${lesson.why || '_Fill in why this saves effort_'}

---

_Status: candidate — promote to adopted after gate review. See \`.github/harness/memory/curation/teach-agent-lifecycle.md\`._
`;

  return fm + body;
}

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------

async function prompt(rl, question, defaultValue) {
  return new Promise(resolve => {
    const hint = defaultValue ? ` [${defaultValue}]` : '';
    rl.question(`${question}${hint}: `, answer => {
      resolve((answer.trim() || defaultValue || '').trim());
    });
  });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { flags._.push(arg); continue; }
    if (arg === '--help') { flags.help = true; continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i += 1; } else { flags[key] = true; }
  }
  return flags;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').trim();
}

function showHelp() {
  process.stdout.write(JSON.stringify({
    usage: 'node scripts/harness/teach.mjs [--title <text>] [--context <text>] [--fix <text>] ...',
    description: 'Guided lesson creation with OKF lifecycle gates. Creates candidate lessons in .github/harness/memory/lessons/.',
    flags: {
      '--title <text>': 'One-line lesson summary (required)',
      '--context <text>': 'What task/area surfaced this',
      '--symptom <text>': 'The misleading error or dead end',
      '--cause <text>': 'Root cause',
      '--fix <text>': 'Concrete fix or approach that worked',
      '--why <text>': 'Why this knowledge matters',
      '--tags <csv>': 'Comma-separated tags',
      '--source <text>': 'human | loop:<name> | research (default: human)',
      '--from-stdin': 'Read raw text from stdin (used as context pre-fill)',
      '--dry-run': 'Print the lesson without writing',
    },
    gates: [
      'provenance — source is present and non-empty',
      'trust — source is not "unknown"',
      'contradiction — reviewer checks against active briefs (advisory)',
      'freshness — created date is present',
      'operational — fix/approach and context are present',
    ],
    lifecycle: 'candidate → reviewed → adopted | rejected | stale',
    examples: [
      'node scripts/harness/teach.mjs                                   # interactive',
      'node scripts/harness/teach.mjs --title "npm cache quirk" --fix "npm cache clean --force" --context "CI build" --why "Prevents stale lock issues"',
      'echo "We found that..." | node scripts/harness/teach.mjs --from-stdin --title "new discovery"',
      'npm run harness:teach',
    ],
  }, null, 2) + '\n');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) { showHelp(); return; }

  let stdinText = '';
  if (flags['from-stdin']) stdinText = await readStdin();

  let lesson = {
    title: flags.title || '',
    context: flags.context || (stdinText ? stdinText.slice(0, 300) : ''),
    symptom: flags.symptom || '',
    cause: flags.cause || '',
    fix: flags.fix || '',
    why: flags.why || '',
    tags: flags.tags || '',
    source: flags.source || 'human',
    created: today,
    updated: today,
  };

  // Interactive mode when title is missing
  if (!lesson.title || (!flags['from-stdin'] && !flags.fix)) {
    if (!process.stdin.isTTY && !flags['from-stdin']) {
      process.stderr.write('[teach] Non-interactive mode requires --title and --fix at minimum.\n');
      process.exit(2);
    }

    const rl = createInterface({ input: process.stdin, output: process.stderr });
    process.stderr.write('\n[teach] Guided lesson creation (Ctrl+C to cancel)\n\n');

    lesson.title = lesson.title || await prompt(rl, 'Lesson title (one-line summary)', '');
    lesson.context = lesson.context || await prompt(rl, 'Context (what task surfaced this)', '');
    lesson.symptom = lesson.symptom || await prompt(rl, 'Symptom (the misleading error or trigger)', '');
    lesson.cause = lesson.cause || await prompt(rl, 'Cause (root cause)', '');
    lesson.fix = lesson.fix || await prompt(rl, 'Fix / approach that worked', '');
    lesson.why = lesson.why || await prompt(rl, 'Why it matters (effort saved, trap avoided)', '');
    lesson.tags = lesson.tags || await prompt(rl, 'Tags (comma-separated, e.g. pdf,ubuntu)', '');
    lesson.source = lesson.source || await prompt(rl, 'Source', 'human');

    rl.close();
  }

  if (!lesson.title) {
    process.stderr.write('[teach] --title is required.\n');
    process.exit(2);
  }

  const { gates, allPass, hardFails } = validateGates(lesson);
  const content = buildLessonFile(lesson);
  const slug = slugify(lesson.title);
  const filename = `${slug}.lesson.md`;
  const outPath = join(lessonsDir, filename);

  if (flags['dry-run']) {
    process.stdout.write(`\n--- ${filename} ---\n${content}\n---\n`);
    process.stdout.write(JSON.stringify({ ok: allPass, gates, filename, wouldWriteTo: outPath }, null, 2) + '\n');
    return;
  }

  if (hardFails.length > 0) {
    process.stderr.write(`[teach] Gate failures:\n`);
    for (const g of hardFails) process.stderr.write(`  [FAIL] ${g.id}: ${g.detail}\n`);
    process.stderr.write(`[teach] Fix the above before creating the lesson, or use --dry-run to preview.\n`);
    process.exit(1);
  }

  if (existsSync(outPath)) {
    process.stderr.write(`[teach] File already exists: ${outPath.replace(repoRoot, '.')}\n`);
    process.stderr.write(`[teach] Update it manually or use a different title.\n`);
    process.exit(1);
  }

  mkdirSync(lessonsDir, { recursive: true });
  writeFileSync(outPath, content, 'utf8');

  process.stdout.write(JSON.stringify({
    ok: true,
    filename,
    path: outPath.replace(repoRoot, '.').replace(/\\/g, '/'),
    status: 'candidate',
    gates,
    nextSteps: [
      `Review the file: ${outPath.replace(repoRoot, '.')}`,
      'Check against active briefs for contradictions (Gate 3).',
      'Update status: candidate → reviewed → adopted when gates pass.',
      'Run: npm run harness:memory:curate to validate the lesson.',
    ],
  }, null, 2) + '\n');
}

main().catch(err => {
  process.stderr.write(`[teach] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
