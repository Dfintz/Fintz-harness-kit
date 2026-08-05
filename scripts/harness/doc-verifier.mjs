#!/usr/bin/env node
/**
 * doc-verifier — document quality verifier for harness doc-workflow mode (v2.8.0).
 *
 * Checks a markdown or plain-text document against configurable thresholds:
 *   - Flesch-Kincaid Reading Ease (≥ minScore)
 *   - Required sections present (heading regex list)
 *   - Word count within [min, max] globally and per-section
 *
 * All thresholds are read from harness.config.json docWorkflow.verifier.
 * Override any threshold via CLI flags.
 *
 * Exit codes: 0 = all checks pass, 1 = one or more checks fail, 2 = usage error.
 *
 * Usage:
 *   node scripts/harness/doc-verifier.mjs --file README.md
 *   node scripts/harness/doc-verifier.mjs --file doc.md --min-score 50 --min-words 200
 *   npm run harness:doc:verify -- --file README.md
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

// ---------------------------------------------------------------------------
// Config loader (inline — avoids circular imports)
// ---------------------------------------------------------------------------

function loadDocWorkflowConfig() {
  try {
    const raw = readFileSync(resolve(repoRoot, 'harness.config.json'), 'utf8');
    const cfg = JSON.parse(raw);
    return cfg.docWorkflow?.verifier || {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Flesch-Kincaid Reading Ease
// 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
// Score ≥ 60 = standard prose readable by the general public.
// ---------------------------------------------------------------------------

const STRIP_MD = /[#*_`~>\[\]!|\\]|(?:\[.*?\]\(.*?\))|(?:```[\s\S]*?```)|(?:`[^`]+`)/g;
const STRIP_PUNCTUATION = /[^a-z0-9'\s-]/gi;
const SENTENCE_END = /[.!?]+\s/g;

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  // Remove silent trailing e
  const cleaned = w.replace(/e$/, '');
  // Count vowel groups
  const groups = cleaned.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

function fleschKincaidReadingEase(text) {
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')   // remove fenced code blocks first
    .replace(STRIP_MD, ' ')
    .replace(STRIP_PUNCTUATION, ' ');

  const words = stripped.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return { score: 100, words: 0, sentences: 0, syllables: 0 };

  // Count sentences: terminal punctuation OR each non-empty line (whichever is more)
  const punctuationSentences = Math.max(1, ((stripped + ' ').match(SENTENCE_END) || []).length);
  const lineSentences = Math.max(1, text.split('\n').filter(l => l.trim().length > 0).length);
  const sentences = Math.max(punctuationSentences, Math.floor(lineSentences / 3));

  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0);

  const score = 206.835
    - 1.015 * (words.length / sentences)
    - 84.6 * (syllables / words.length);

  // Clamp to [0, 121] — FK score is bounded; extreme values indicate measurement noise
  const clamped = Math.max(0, Math.min(121, score));

  return {
    score: Math.round(clamped * 10) / 10,
    words: words.length,
    sentences,
    syllables,
  };
}

function scoreLabel(score) {
  if (score >= 90) return 'Very Easy';
  if (score >= 80) return 'Easy';
  if (score >= 70) return 'Fairly Easy';
  if (score >= 60) return 'Standard';
  if (score >= 50) return 'Fairly Difficult';
  if (score >= 30) return 'Difficult';
  return 'Very Confusing';
}

// ---------------------------------------------------------------------------
// Section parsing
// ---------------------------------------------------------------------------

function extractSections(text) {
  // Returns array of { heading, level, content }
  const lines = text.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const m = line.match(/^(#{1,6})\s+(.+)/);
    if (m) {
      if (current) sections.push(current);
      current = { heading: line.trim(), level: m[1].length, title: m[2].trim(), content: '' };
    } else if (current) {
      current.content += line + '\n';
    }
  }
  if (current) sections.push(current);
  return sections;
}

function wordCount(text) {
  const stripped = text.replace(STRIP_MD, ' ');
  return stripped.split(/\s+/).filter(w => w.length > 0).length;
}

function countPhraseOccurrences(text, phrase) {
  if (!phrase || !String(phrase).trim()) return 0;
  const escaped = String(phrase).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escaped, 'gi');
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

function verifyDocument(text, options) {
  const findings = [];

  // 1. Flesch-Kincaid
  const minScore = Number(options.minScore ?? 60);
  const fk = fleschKincaidReadingEase(text);
  findings.push({
    rule: 'readability',
    formula: 'flesch-kincaid-reading-ease',
    pass: fk.score >= minScore,
    detail: `Score ${fk.score} (${scoreLabel(fk.score)}) — minimum ${minScore}. Words: ${fk.words}, sentences: ${fk.sentences}.`,
    score: fk.score,
    minScore,
  });

  // 2. Total word count
  const totalWords = wordCount(text);
  const minWords = options.minWords !== undefined ? Number(options.minWords) : null;
  const maxWords = options.maxWords !== undefined ? Number(options.maxWords) : null;

  if (minWords !== null || maxWords !== null) {
    const tooShort = minWords !== null && totalWords < minWords;
    const tooLong = maxWords !== null && totalWords > maxWords;
    findings.push({
      rule: 'word-count-total',
      pass: !tooShort && !tooLong,
      detail: `${totalWords} words${minWords !== null ? `, min ${minWords}` : ''}${maxWords !== null ? `, max ${maxWords}` : ''}.`,
      totalWords,
      minWords,
      maxWords,
    });
  }

  // 3. Required sections
  const requiredSections = Array.isArray(options.requiredSections) ? options.requiredSections : [];
  const sections = extractSections(text);
  const headingTexts = sections.map(s => s.heading);

  for (const required of requiredSections) {
    const pattern = required instanceof RegExp ? required : new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const found = headingTexts.some(h => pattern.test(h));
    findings.push({
      rule: 'required-section',
      section: required,
      pass: found,
      detail: found ? `Section "${required}" found.` : `Section "${required}" is missing.`,
    });
  }

  // 4. Per-section word count thresholds
  const sectionThresholds = options.sectionWordCounts || {};
  for (const [sectionPattern, thresholds] of Object.entries(sectionThresholds)) {
    const pattern = new RegExp(sectionPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matched = sections.filter(s => pattern.test(s.heading));

    if (matched.length === 0) continue;
    for (const section of matched) {
      const wc = wordCount(section.content);
      const sMin = thresholds.min !== undefined ? Number(thresholds.min) : null;
      const sMax = thresholds.max !== undefined ? Number(thresholds.max) : null;
      const tooShort = sMin !== null && wc < sMin;
      const tooLong = sMax !== null && wc > sMax;
      findings.push({
        rule: 'section-word-count',
        section: section.heading,
        pass: !tooShort && !tooLong,
        detail: `"${section.heading}": ${wc} words${sMin !== null ? `, min ${sMin}` : ''}${sMax !== null ? `, max ${sMax}` : ''}.`,
        words: wc,
        min: sMin,
        max: sMax,
      });
    }
  }

  // 5. Warning-first no-ai-slop phrase checks
  const noAiSlop = options.noAiSlop || {};
  const noAiSlopEnabled = Boolean(noAiSlop.enabled);
  if (noAiSlopEnabled) {
    const mode = String(noAiSlop.mode || 'warn').toLowerCase() === 'error' ? 'error' : 'warn';
    const bannedPhrases = Array.isArray(noAiSlop.bannedPhrases)
      ? noAiSlop.bannedPhrases.map(value => String(value).trim()).filter(Boolean)
      : [];
    const searchableText = text
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(STRIP_MD, ' ')
      .toLowerCase();

    if (bannedPhrases.length > 0) {
      const matches = bannedPhrases
        .map(phrase => ({ phrase, count: countPhraseOccurrences(searchableText, phrase.toLowerCase()) }))
        .filter(entry => entry.count > 0);

      findings.push({
        rule: 'no-ai-slop-phrase',
        severity: mode,
        pass: matches.length === 0,
        detail: matches.length === 0
          ? 'No banned low-signal phrases detected.'
          : `Detected ${matches.length} banned phrase pattern(s): ${matches.map(entry => `"${entry.phrase}" x${entry.count}`).join(', ')}.`,
        mode,
        matches,
      });
    }
  }

  const ok = findings.every(f => (f.severity || 'error') !== 'error' || f.pass);
  return { ok, totalWords, readability: fk, findings };
}

// ---------------------------------------------------------------------------
// Arg parser + CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { flags._.push(arg); continue; }
    if (arg === '--help') { flags.help = true; continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      if (flags[key] === undefined) {
        flags[key] = next;
      } else if (Array.isArray(flags[key])) {
        flags[key].push(next);
      } else {
        flags[key] = [flags[key], next];
      }
      i += 1;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function toArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function printJson(payload, exitCode) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  if (exitCode !== undefined) process.exit(exitCode);
}

function showHelp() {
  printJson({
    usage: 'node scripts/harness/doc-verifier.mjs --file <path> [options]',
    description: [
      'Verifies a document against readability, section, and word-count thresholds.',
      'Thresholds are read from harness.config.json docWorkflow.verifier and can be overridden via flags.',
      'Exit 0 = all checks pass. Exit 1 = one or more checks fail. Exit 2 = usage error.',
    ].join(' '),
    flags: {
      '--file <path>': 'Document to verify (required)',
      '--min-score <n>': 'Minimum Flesch-Kincaid Reading Ease score (default: config or 60)',
      '--min-words <n>': 'Minimum total word count',
      '--max-words <n>': 'Maximum total word count',
      '--require-section <heading>': 'Assert a heading is present (repeatable)',
      '--no-ai-slop': 'Enable no-ai-slop phrase checks (warning-first by default)',
      '--no-ai-slop-mode <warn|error>': 'Set no-ai-slop severity mode',
      '--ban-phrase <text>': 'Additional banned phrase for no-ai-slop checks (repeatable)',
      '--list-sections': 'Print all detected section headings and word counts, then exit',
    },
    scoreGuide: {
      90: 'Very Easy (5th grade)',
      80: 'Easy (6th grade)',
      70: 'Fairly Easy (7th grade)',
      60: 'Standard (8–9th grade) — recommended minimum',
      50: 'Fairly Difficult (10–12th grade)',
      30: 'Difficult (college level)',
    },
    configPath: 'harness.config.json → docWorkflow.verifier',
    examples: [
      'node scripts/harness/doc-verifier.mjs --file README.md',
      'node scripts/harness/doc-verifier.mjs --file doc.md --min-score 50 --min-words 200',
      'node scripts/harness/doc-verifier.mjs --file doc.md --require-section "## Usage" --require-section "## Examples"',
      'node scripts/harness/doc-verifier.mjs --file doc.md --list-sections',
      'npm run harness:doc:verify -- --file README.md',
    ],
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) { showHelp(); return; }

  const filePath = flags.file;
  if (!filePath) {
    process.stderr.write('[doc-verifier] --file is required\n');
    process.exit(2);
  }

  const resolvedPath = resolve(filePath);
  // Prevent traversal: path must resolve to a real file
  if (!existsSync(resolvedPath)) {
    process.stderr.write(`[doc-verifier] File not found: ${resolvedPath}\n`);
    process.exit(2);
  }

  let text;
  try {
    text = readFileSync(resolvedPath, 'utf8');
  } catch (err) {
    process.stderr.write(`[doc-verifier] Cannot read file: ${err.message}\n`);
    process.exit(2);
  }

  // --list-sections mode
  if (flags['list-sections']) {
    const sections = extractSections(text);
    printJson({
      file: resolvedPath,
      sectionCount: sections.length,
      sections: sections.map(s => ({
        heading: s.heading,
        level: s.level,
        words: wordCount(s.content),
      })),
    });
    return;
  }

  // Load thresholds: config file first, then CLI flags override
  const cfgVerifier = loadDocWorkflowConfig();
  const cfgNoAiSlop = cfgVerifier.noAiSlop || {};

  const cliRequiredSections = toArray(flags['require-section']);
  const cliBannedPhrases = toArray(flags['ban-phrase']);

  const requiredSections = [
    ...(Array.isArray(cfgVerifier.requiredSections) ? cfgVerifier.requiredSections : []),
    ...cliRequiredSections,
  ];

  const wordThresholds = cfgVerifier.wordCountThresholds || {};
  const minWords = flags['min-words'] !== undefined ? flags['min-words']
    : wordThresholds.min !== undefined ? wordThresholds.min
    : undefined;
  const maxWords = flags['max-words'] !== undefined ? flags['max-words']
    : wordThresholds.max !== undefined ? wordThresholds.max
    : undefined;
  const minScore = flags['min-score'] !== undefined ? flags['min-score']
    : cfgVerifier.minScore !== undefined ? cfgVerifier.minScore
    : 60;

  const noAiSlopEnabled = flags['no-ai-slop'] === true
    ? true
    : Boolean(cfgNoAiSlop.enabled);
  const noAiSlopMode = flags['no-ai-slop-mode'] !== undefined
    ? flags['no-ai-slop-mode']
    : cfgNoAiSlop.mode !== undefined
      ? cfgNoAiSlop.mode
      : 'warn';
  const noAiSlopPhrases = [
    ...(Array.isArray(cfgNoAiSlop.bannedPhrases) ? cfgNoAiSlop.bannedPhrases : []),
    ...cliBannedPhrases,
  ];

  const result = verifyDocument(text, {
    minScore,
    minWords,
    maxWords,
    requiredSections,
    sectionWordCounts: wordThresholds.sections || {},
    noAiSlop: {
      enabled: noAiSlopEnabled,
      mode: noAiSlopMode,
      bannedPhrases: noAiSlopPhrases,
    },
  });

  const errorFailures = result.findings.filter(f => !f.pass && (f.severity || 'error') === 'error').length;
  const warningFindings = result.findings.filter(f => !f.pass && (f.severity || 'error') === 'warn').length;

  printJson({
    ok: result.ok,
    file: resolvedPath,
    formula: 'flesch-kincaid-reading-ease',
    score: result.readability.score,
    scoreLabel: scoreLabel(result.readability.score),
    totalWords: result.totalWords,
    warningCount: warningFindings,
    findings: result.findings,
    summary: result.ok
      ? (warningFindings > 0
        ? `All error-level checks passed with ${warningFindings} warning finding(s).`
        : `All ${result.findings.length} check(s) passed.`)
      : `${errorFailures} error-level check(s) failed${warningFindings > 0 ? `; ${warningFindings} warning finding(s) also reported` : ''}.`,
  }, result.ok ? 0 : 1);
}

main().catch(err => {
  process.stderr.write(`[doc-verifier] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
