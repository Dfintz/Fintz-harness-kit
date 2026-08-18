#!/usr/bin/env node
/**
 * context-compaction — bounded history compaction for run-experiment.mjs and plan-review.mjs.
 *
 * Radar: .github/harness/memory/radar/anthropic-context-compaction.md (T3). Implemented ahead of
 * its original trigger-gate on explicit human instruction (2026-08-18) — see the decision log in
 * that radar entry and .github/harness/memory/briefs/wayfinder-t3-t5-t6-today-implementation-2026-08-18.md.
 *
 * Anthropic's compaction pattern: once a conversation nears its limit, summarize older content and
 * keep the most recent items in full detail. Here "the conversation" is a loop's own iteration/round
 * history, already rendered as short lines (run-experiment) or critique blocks (plan-review) — so
 * compaction means keeping the most recent N entries verbatim and folding everything older into one
 * summary line, rather than re-summarizing raw text with a model call (no LLM call is needed or made
 * here; this is deterministic, not generative, compaction).
 */
import { resolveValue } from './config.mjs';

const DEFAULT_MAX_RECENT_ITERATIONS = 20;
const DEFAULT_MAX_RECENT_ROUNDS = 3;

function parsePositiveInt(input, fallback) {
  const parsed = Number(input);
  if (!Number.isFinite(parsed)) return fallback;
  const value = Math.trunc(parsed);
  return value > 0 ? value : fallback;
}

export function resolveMaxRecentIterations() {
  return parsePositiveInt(
    resolveValue('contextGrowth.compaction.maxRecentIterations', undefined),
    DEFAULT_MAX_RECENT_ITERATIONS
  );
}

export function resolveMaxRecentRounds() {
  return parsePositiveInt(
    resolveValue('contextGrowth.compaction.maxRecentRounds', undefined),
    DEFAULT_MAX_RECENT_ROUNDS
  );
}

/**
 * Compact a flat list of one-line history entries (e.g. run-experiment's per-iteration lines).
 * Keeps the most recent `maxRecent` lines verbatim; older lines collapse into one summary line.
 * @param {string[]} lines
 * @param {number} [maxRecent]
 * @returns {string[]}
 */
export function compactLineHistory(lines, maxRecent = resolveMaxRecentIterations()) {
  if (!Array.isArray(lines) || lines.length <= maxRecent) {
    return Array.isArray(lines) ? lines : [];
  }
  const omitted = lines.length - maxRecent;
  const recent = lines.slice(lines.length - maxRecent);
  return [`- ...and ${omitted} earlier iteration(s) omitted (compacted).`, ...recent];
}

/**
 * Compact a list of prior review rounds (plan-review.mjs shape: {round, verdict, critique, ...}).
 * Keeps full critique text for the most recent `maxRecentRounds`; older rounds collapse to a
 * one-line verdict-only summary. Returns rendered markdown blocks, same shape the caller previously
 * built inline, so this is a drop-in replacement for the render step, not a data-shape change.
 * @param {Array<{round:number, verdict:string, critique:string}>} priorRounds
 * @param {number} [maxRecentRounds]
 * @returns {string[]} rendered blocks, oldest first
 */
export function compactRoundHistory(priorRounds, maxRecentRounds = resolveMaxRecentRounds()) {
  if (!Array.isArray(priorRounds) || priorRounds.length === 0) return [];
  if (priorRounds.length <= maxRecentRounds) {
    return priorRounds.map(
      (r) => `### Round ${r.round} verdict: ${r.verdict}\n${String(r.critique ?? '').trim()}`
    );
  }
  const cutoff = priorRounds.length - maxRecentRounds;
  const older = priorRounds.slice(0, cutoff);
  const recent = priorRounds.slice(cutoff);
  const olderSummary = older.map((r) => `Round ${r.round}: ${r.verdict}`).join(', ');
  return [
    `### Earlier rounds (compacted)\n${olderSummary}`,
    ...recent.map(
      (r) => `### Round ${r.round} verdict: ${r.verdict}\n${String(r.critique ?? '').trim()}`
    ),
  ];
}
