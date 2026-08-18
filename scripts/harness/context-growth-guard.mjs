#!/usr/bin/env node
/**
 * context-growth-guard — warn-only prompt-size tripwire shared by run-experiment.mjs and
 * plan-review.mjs.
 *
 * Radar: .github/harness/memory/radar/anthropic-context-compaction.md (candidate, measured
 * 2026-08-18: no current loop needs compaction). This module is the standing check that turns
 * that one-time measurement into an ongoing observation, per
 * .github/harness/memory/briefs/wayfinder-30-60-90-milestones-2026-08-18.md ticket T2.
 *
 * Deliberately measures composed-prompt CHARACTER length, not token count: run-experiment.mjs and
 * plan-review.mjs both pipe their composed prompt to an arbitrary agent CLI via spawnSync stdin —
 * the invoked agent is a black box and never reports token usage back to the harness. Character
 * count is a rough proxy (~4 chars/token), not a precise measurement.
 *
 * This check NEVER blocks or throws — it only warns (stderr) and returns data for the caller to
 * persist as evidence (e.g. a journal/round record field).
 */
import { resolveValue } from './config.mjs';

const DEFAULT_WARN_CHAR_THRESHOLD = 20000;

export function resolveWarnCharThreshold() {
  const configured = resolveValue('contextGrowth.warnCharThreshold', undefined);
  const parsed = Number(configured);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : DEFAULT_WARN_CHAR_THRESHOLD;
}

/**
 * @param {string} prompt - the fully composed prompt about to be sent to an agent.
 * @param {{label:string, threshold?:number}} context - label identifies the caller in warnings
 *   (e.g. "run-experiment iteration 12"); threshold overrides the configured/default value.
 * @returns {{chars:number, threshold:number, exceeded:boolean}}
 */
export function checkPromptSize(prompt, { label, threshold } = {}) {
  const chars = typeof prompt === 'string' ? prompt.length : 0;
  const limit = Number.isFinite(threshold) && threshold > 0 ? Math.trunc(threshold) : resolveWarnCharThreshold();
  const exceeded = chars > limit;
  if (exceeded) {
    process.stderr.write(
      `[context-growth-guard] WARNING: ${label ?? 'prompt'} is ${chars} chars ` +
        `(threshold ${limit}). This is a warn-only proxy, not a block. If this recurs, revisit ` +
        `.github/harness/memory/radar/anthropic-context-compaction.md.\n`
    );
  }
  return { chars, threshold: limit, exceeded };
}
