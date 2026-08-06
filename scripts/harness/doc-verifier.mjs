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
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runPolicyDetectors } from './policy-detector-registry.mjs';

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

const STRIP_PUNCTUATION = /[^a-z0-9'\s-]/gi;
const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

function normalizeLineEndings(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n');
}

function stripFencedCodeBlocks(text) {
  const source = normalizeLineEndings(text);
  const lines = source.split('\n');
  const out = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      out.push(' ');
      continue;
    }
    if (!inFence) out.push(line);
  }

  return out.join('\n');
}

function stripInlineCodeSegments(text) {
  let out = '';
  let inCode = false;
  for (const ch of String(text ?? '')) {
    if (ch === '`') {
      inCode = !inCode;
      out += ' ';
      continue;
    }
    out += inCode ? ' ' : ch;
  }
  return out;
}

function stripMarkdownLinks(text) {
  const source = String(text ?? '');
  let out = '';
  let i = 0;
  while (i < source.length) {
    if (source[i] !== '[') {
      out += source[i];
      i += 1;
      continue;
    }

    const closeBracket = source.indexOf(']', i + 1);
    if (closeBracket === -1 || source[closeBracket + 1] !== '(') {
      out += source[i];
      continue;
    }

    const closeParen = source.indexOf(')', closeBracket + 2);
    const openNewline = source.indexOf('\n', i + 1);
    if (closeParen === -1 || (openNewline !== -1 && openNewline < closeParen)) {
      out += source[i];
      i += 1;
      continue;
    }

    out += ' ';
    i = closeParen + 1;
  }

  return out;
}

function stripMarkdownMarkup(text) {
  let out = String(text ?? '');
  const marks = ['#', '*', '_', '~', '>', '[', ']', '!', '|', '\\'];
  for (const mark of marks) {
    out = out.split(mark).join(' ');
  }
  return out;
}

function stripMarkdownForCounting(text) {
  const noFences = stripFencedCodeBlocks(text);
  const noLinks = stripMarkdownLinks(noFences);
  const noInlineCode = stripInlineCodeSegments(noLinks);
  return stripMarkdownMarkup(noInlineCode);
}

function countPunctuationSentences(text) {
  const source = String(text ?? '');
  let count = 0;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    const next = source[i + 1];
    if (next === undefined || /\s/.test(next)) count += 1;
  }
  return Math.max(1, count);
}

function escapeRegExp(value) {
  return String(value).replace(REGEX_ESCAPE_PATTERN, String.raw`\$&`);
}

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
  const stripped = stripMarkdownForCounting(text)
    .replace(STRIP_PUNCTUATION, ' ');

  const words = stripped.split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return { score: 100, words: 0, sentences: 0, syllables: 0 };

  // Count sentences: terminal punctuation OR each non-empty line (whichever is more)
  const punctuationSentences = countPunctuationSentences(stripped);
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
  const stripped = stripMarkdownForCounting(text);
  return stripped.split(/\s+/).filter(w => w.length > 0).length;
}

function countPhraseOccurrences(text, phrase) {
  const needle = String(phrase ?? '').trim().toLowerCase();
  if (!needle) return 0;

  const source = String(text ?? '').toLowerCase();
  let count = 0;
  let index = source.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = source.indexOf(needle, index + needle.length);
  }
  return count;
}

function wordCountDetail(totalWords, minWords, maxWords) {
  const minPart = minWords !== null ? `, min ${minWords}` : '';
  const maxPart = maxWords !== null ? `, max ${maxWords}` : '';
  return `${totalWords} words${minPart}${maxPart}.`;
}

function phraseMatchDetail(matches) {
  if (matches.length === 0) return 'No banned low-signal phrases detected.';
  const summary = matches.map((entry) => `"${entry.phrase}" x${entry.count}`).join(', ');
  return `Detected ${matches.length} banned phrase pattern(s): ${summary}.`;
}

function runPolicyFindings(text) {
  return runPolicyDetectors(text, 'document').map((detector) => ({
    rule: `policy-detector:${detector.id}`,
    severity: detector.severity,
    pass: false,
    detail: detector.message,
    advisory: detector.advisory,
    scope: detector.scope,
  }));
}

function normalizeMinMax(options) {
  return {
    minWords: options.minWords !== undefined ? Number(options.minWords) : null,
    maxWords: options.maxWords !== undefined ? Number(options.maxWords) : null,
  };
}

function addReadabilityFinding(findings, text, minScore) {
  const fk = fleschKincaidReadingEase(text);
  findings.push({
    rule: 'readability',
    formula: 'flesch-kincaid-reading-ease',
    pass: fk.score >= minScore,
    detail: `Score ${fk.score} (${scoreLabel(fk.score)}) — minimum ${minScore}. Words: ${fk.words}, sentences: ${fk.sentences}.`,
    score: fk.score,
    minScore,
  });
  return fk;
}

function addTotalWordCountFinding(findings, totalWords, minWords, maxWords) {
  if (minWords === null && maxWords === null) return;

  const tooShort = minWords !== null && totalWords < minWords;
  const tooLong = maxWords !== null && totalWords > maxWords;
  findings.push({
    rule: 'word-count-total',
    pass: !tooShort && !tooLong,
    detail: wordCountDetail(totalWords, minWords, maxWords),
    totalWords,
    minWords,
    maxWords,
  });
}

function addRequiredSectionFindings(findings, requiredSections, headingTexts) {
  for (const required of requiredSections) {
    const pattern = required instanceof RegExp ? required : new RegExp(escapeRegExp(required), 'i');
    const found = headingTexts.some((heading) => pattern.test(heading));
    findings.push({
      rule: 'required-section',
      section: required,
      pass: found,
      detail: found ? `Section "${required}" found.` : `Section "${required}" is missing.`,
    });
  }
}

function addSectionWordCountFindings(findings, sections, sectionThresholds) {
  for (const [sectionPattern, thresholds] of Object.entries(sectionThresholds)) {
    const pattern = new RegExp(escapeRegExp(sectionPattern), 'i');
    const matched = sections.filter((section) => pattern.test(section.heading));
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
        detail: `"${section.heading}": ${wordCountDetail(wc, sMin, sMax)}`,
        words: wc,
        min: sMin,
        max: sMax,
      });
    }
  }
}

function normalizeNoAiSlopOptions(noAiSlop) {
  const mode = String(noAiSlop.mode || 'warn').toLowerCase() === 'error' ? 'error' : 'warn';
  const bannedPhrases = Array.isArray(noAiSlop.bannedPhrases)
    ? noAiSlop.bannedPhrases.map((value) => String(value).trim()).filter(Boolean)
    : [];
  return { mode, bannedPhrases };
}

function addNoAiSlopFinding(findings, text, noAiSlop) {
  if (!noAiSlop.enabled) return;

  const { mode, bannedPhrases } = normalizeNoAiSlopOptions(noAiSlop);
  if (bannedPhrases.length === 0) return;

  const searchableText = stripMarkdownForCounting(text).toLowerCase();
  const matches = bannedPhrases
    .map((phrase) => ({ phrase, count: countPhraseOccurrences(searchableText, phrase.toLowerCase()) }))
    .filter((entry) => entry.count > 0);

  findings.push({
    rule: 'no-ai-slop-phrase',
    severity: mode,
    pass: matches.length === 0,
    detail: phraseMatchDetail(matches),
    mode,
    matches,
  });
}

// ---------------------------------------------------------------------------
// Verifier
// ---------------------------------------------------------------------------

function verifyDocument(text, options) {
  const findings = [];
  const minScore = Number(options.minScore ?? 60);
  const fk = addReadabilityFinding(findings, text, minScore);
  const totalWords = wordCount(text);
  const { minWords, maxWords } = normalizeMinMax(options);
  addTotalWordCountFinding(findings, totalWords, minWords, maxWords);

  const requiredSections = Array.isArray(options.requiredSections) ? options.requiredSections : [];
  const sections = extractSections(text);
  const headingTexts = sections.map((section) => section.heading);
  addRequiredSectionFindings(findings, requiredSections, headingTexts);

  const sectionThresholds = options.sectionWordCounts || {};
  addSectionWordCountFindings(findings, sections, sectionThresholds);

  const noAiSlop = options.noAiSlop || {};
  addNoAiSlopFinding(findings, text, noAiSlop);

  findings.push(...runPolicyFindings(text));

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

function isContainedPath(root, candidate) {
  const rootPath = realpathSync(root);
  const candidatePath = realpathSync(candidate);
  const rootWithSeparator = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`;
  return candidatePath === rootPath || candidatePath.startsWith(rootWithSeparator);
}

function isTrustedInputPath(pathToCheck) {
  const trustedRoots = [repoRoot, process.cwd(), tmpdir()]
    .filter((root, index, allRoots) => allRoots.indexOf(root) === index)
    .filter((root) => existsSync(root));

  return trustedRoots.some((root) => {
    try {
      return isContainedPath(root, pathToCheck);
    } catch {
      return false;
    }
  });
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

function readInputDocument(filePath) {
  // NOSONAR: filePath is constrained by existsSync + isTrustedInputPath before file read.
  const resolvedPath = resolve(filePath);
  if (!existsSync(resolvedPath)) {
    process.stderr.write(`[doc-verifier] File not found: ${resolvedPath}\n`);
    process.exit(2);
  }

  if (!isTrustedInputPath(resolvedPath)) {
    process.stderr.write(`[doc-verifier] Refusing to read untrusted path: ${resolvedPath}\n`);
    process.exit(2);
  }

  try {
    // NOSONAR: guarded read from trusted roots only (repoRoot/cwd/tmpdir).
    return { resolvedPath, text: readFileSync(resolvedPath, 'utf8') };
  } catch (err) {
    process.stderr.write(`[doc-verifier] Cannot read file: ${err.message}\n`);
    process.exit(2);
  }
}

function handleListSections(flags, text, resolvedPath) {
  if (!flags['list-sections']) return false;

  const sections = extractSections(text);
  printJson({
    file: resolvedPath,
    sectionCount: sections.length,
    sections: sections.map((section) => ({
      heading: section.heading,
      level: section.level,
      words: wordCount(section.content),
    })),
  });
  return true;
}

function resolveMinScore(flags, cfgVerifier) {
  if (flags['min-score'] !== undefined) return flags['min-score'];
  if (cfgVerifier.minScore !== undefined) return cfgVerifier.minScore;
  return 60;
}

function resolveNoAiSlopMode(flags, cfgNoAiSlop) {
  if (flags['no-ai-slop-mode'] !== undefined) return flags['no-ai-slop-mode'];
  if (cfgNoAiSlop.mode !== undefined) return cfgNoAiSlop.mode;
  return 'warn';
}

function buildVerifierOptions(flags, cfgVerifier) {
  const cfgNoAiSlop = cfgVerifier.noAiSlop || {};
  const wordThresholds = cfgVerifier.wordCountThresholds || {};
  const cliRequiredSections = toArray(flags['require-section']);
  const cliBannedPhrases = toArray(flags['ban-phrase']);

  const requiredSections = [
    ...(Array.isArray(cfgVerifier.requiredSections) ? cfgVerifier.requiredSections : []),
    ...cliRequiredSections,
  ];

  const minWords = flags['min-words'] !== undefined ? flags['min-words'] : wordThresholds.min;
  const maxWords = flags['max-words'] !== undefined ? flags['max-words'] : wordThresholds.max;

  const noAiSlopEnabled = flags['no-ai-slop'] === true ? true : Boolean(cfgNoAiSlop.enabled);
  const noAiSlopMode = resolveNoAiSlopMode(flags, cfgNoAiSlop);
  const noAiSlopPhrases = [
    ...(Array.isArray(cfgNoAiSlop.bannedPhrases) ? cfgNoAiSlop.bannedPhrases : []),
    ...cliBannedPhrases,
  ];

  return {
    minScore: resolveMinScore(flags, cfgVerifier),
    minWords,
    maxWords,
    requiredSections,
    sectionWordCounts: wordThresholds.sections || {},
    noAiSlop: {
      enabled: noAiSlopEnabled,
      mode: noAiSlopMode,
      bannedPhrases: noAiSlopPhrases,
    },
  };
}

function countFailuresBySeverity(findings) {
  const errorFailures = findings.filter((finding) => !finding.pass && (finding.severity || 'error') === 'error').length;
  const warningFindings = findings.filter((finding) => !finding.pass && (finding.severity || 'error') === 'warn').length;
  return { errorFailures, warningFindings };
}

function buildSummaryMessage(result, errorFailures, warningFindings) {
  if (result.ok) {
    if (warningFindings > 0) {
      return `All error-level checks passed with ${warningFindings} warning finding(s).`;
    }
    return `All ${result.findings.length} check(s) passed.`;
  }

  const warningSuffix = warningFindings > 0
    ? `; ${warningFindings} warning finding(s) also reported`
    : '';
  return `${errorFailures} error-level check(s) failed${warningSuffix}.`;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) { showHelp(); return; }

  const filePath = flags.file;
  if (!filePath) {
    process.stderr.write('[doc-verifier] --file is required\n');
    process.exit(2);
  }

  const { resolvedPath, text } = readInputDocument(filePath);
  if (handleListSections(flags, text, resolvedPath)) return;

  // Load thresholds: config file first, then CLI flags override
  const cfgVerifier = loadDocWorkflowConfig();
  const verifierOptions = buildVerifierOptions(flags, cfgVerifier);
  const result = verifyDocument(text, verifierOptions);

  const { errorFailures, warningFindings } = countFailuresBySeverity(result.findings);
  const summary = buildSummaryMessage(result, errorFailures, warningFindings);

  printJson({
    ok: result.ok,
    file: resolvedPath,
    formula: 'flesch-kincaid-reading-ease',
    score: result.readability.score,
    scoreLabel: scoreLabel(result.readability.score),
    totalWords: result.totalWords,
    warningCount: warningFindings,
    findings: result.findings,
    summary,
  }, result.ok ? 0 : 1);
}

try {
  await main();
} catch (err) {
  process.stderr.write(`[doc-verifier] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
}
