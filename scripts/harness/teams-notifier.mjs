#!/usr/bin/env node
/**
 * teams-notifier — v2.9.0 Teams Adaptive Card generator and webhook poster.
 *
 * Generates and posts Adaptive Card notifications to a Microsoft Teams channel
 * via an incoming webhook URL. Three card templates cover the main harness events:
 *
 *   stage-complete   — a loop stage finished (converged, exhausted, stuck, or blocked)
 *   approval-needed  — the loop has a pending approval; shows CLI command to approve
 *   error-alert      — the loop hit an error or failed check
 *
 * State is auto-populated from stage-state.mjs when no explicit flags are given.
 *
 * Usage:
 *   node scripts/harness/teams-notifier.mjs stage-complete --loop build-fix --stage implement --status converged
 *   node scripts/harness/teams-notifier.mjs approval-needed --loop build-fix --run-id abc123 --note "Review gate"
 *   node scripts/harness/teams-notifier.mjs error-alert --loop build-fix --stage implement --error "lint failed"
 *   node scripts/harness/teams-notifier.mjs stage-complete --dry-run
 *   npm run harness:teams:notify -- stage-complete --loop build-fix --status converged
 *
 * Env:
 *   HARNESS_TEAMS_WEBHOOK_URL  Incoming webhook URL (required for posting; skipped in --dry-run)
 *   HARNESS_TEAMS_TIMEOUT_MS   HTTP request timeout (default 10000)
 */
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import { URL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readStageState } from './stage-state.mjs';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

const DEFAULT_TIMEOUT_MS = 10_000;
const CARD_SCHEMA = 'http://adaptivecards.io/schemas/adaptive-card.json';
const CARD_VERSION = '1.5';

// Harness brand colour used for card accent bars
const COLOUR = {
  good: 'Good',      // green
  warning: 'Warning', // yellow
  attention: 'Attention', // red
  accent: 'Accent',  // blue
};

// ---------------------------------------------------------------------------
// Arg parser
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

function printJson(payload, exitCode) {
  process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  if (exitCode !== undefined) process.exit(exitCode);
}

// ---------------------------------------------------------------------------
// Card helpers
// ---------------------------------------------------------------------------

function fmtTime(iso) {
  if (!iso) return 'unknown';
  try { return new Date(iso).toLocaleString('en-GB', { timeZoneName: 'short' }); } catch { return iso; }
}

function statusEmoji(status) {
  switch (String(status).toLowerCase()) {
    case 'converged': return '✅';
    case 'exhausted': return '⚠️';
    case 'stuck':     return '🔴';
    case 'blocked':   return '⛔';
    default:          return '🔄';
  }
}

function statusColour(status) {
  switch (String(status).toLowerCase()) {
    case 'converged': return COLOUR.good;
    case 'exhausted':
    case 'stuck':     return COLOUR.warning;
    case 'blocked':
    case 'error':     return COLOUR.attention;
    default:          return COLOUR.accent;
  }
}

function textBlock(text, opts = {}) {
  return {
    type: 'TextBlock',
    text: String(text),
    wrap: true,
    ...(opts.size ? { size: opts.size } : {}),
    ...(opts.weight ? { weight: opts.weight } : {}),
    ...(opts.color ? { color: opts.color } : {}),
    ...(opts.subtle ? { isSubtle: true } : {}),
    ...(opts.spacing ? { spacing: opts.spacing } : {}),
  };
}

function factSet(facts) {
  return {
    type: 'FactSet',
    facts: facts
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([title, value]) => ({ title: String(title), value: String(value) })),
  };
}

function columnSet(columns) {
  return { type: 'ColumnSet', columns };
}

function column(items, width = 'stretch') {
  return { type: 'Column', width, items };
}

function container(items, style) {
  return { type: 'Container', items, ...(style ? { style } : {}) };
}

function separator() {
  return { type: 'TextBlock', text: ' ', spacing: 'None', separator: true };
}

// ---------------------------------------------------------------------------
// Card templates
// ---------------------------------------------------------------------------

/**
 * stage-complete card: loop finished a stage.
 */
function buildStageCompleteCard(opts) {
  const { loop, stage, status, iteration, note, runId, updatedAt } = opts;
  const emoji = statusEmoji(status);
  const colour = statusColour(status);

  return {
    $schema: CARD_SCHEMA,
    type: 'AdaptiveCard',
    version: CARD_VERSION,
    body: [
      container([
        textBlock(`${emoji} Harness — Stage Complete`, { size: 'Medium', weight: 'Bolder', color: colour }),
        textBlock(`Loop **${loop || '—'}** | Stage **${stage || '—'}**`, { wrap: true }),
      ], 'emphasis'),
      separator(),
      factSet([
        ['Status', `${emoji} ${status || 'unknown'}`],
        ['Iteration', iteration ?? '—'],
        ['Run ID', runId || '—'],
        ['Finished', fmtTime(updatedAt)],
        ...(note ? [['Note', note]] : []),
      ]),
      textBlock('Run `npm run harness:state -- status` to see live state.', { subtle: true, spacing: 'Medium' }),
    ],
  };
}

/**
 * approval-needed card: loop waiting for human approval.
 * If HARNESS_TEAMS_AGENT_URL is set, adds interactive action buttons.
 * Otherwise, shows CLI commands (fallback).
 */
function buildApprovalNeededCard(opts) {
  const { loop, stage, runId, note, requestedAt } = opts;
  const hasAgent = Boolean(process.env.HARNESS_TEAMS_AGENT_URL);
  const agentUrl = (process.env.HARNESS_TEAMS_AGENT_URL || '').replace(/\/$/, '');

  const approveCmd = `npm run harness:state -- approve --run-id ${runId || '<run-id>'} --decision approved --note "lgtm"`;
  const rejectCmd  = `npm run harness:state -- approve --run-id ${runId || '<run-id>'} --decision rejected --note "<reason>"`;

  const bodyItems = [
    container([
      textBlock('🔔 Harness — Approval Needed', { size: 'Medium', weight: 'Bolder', color: COLOUR.warning }),
      textBlock(`Loop **${loop || '—'}** | Stage **${stage || '—'}** is waiting for approval.`),
    ], 'emphasis'),
    separator(),
    factSet([
      ['Loop', loop || '—'],
      ['Stage', stage || '—'],
      ['Run ID', runId || '—'],
      ['Requested', fmtTime(requestedAt)],
      ...(note ? [['Note', note]] : []),
    ]),
  ];

  if (hasAgent && runId) {
    // Interactive buttons via Teams agent
    bodyItems.push(
      textBlock('Approve or reject this request:', { spacing: 'Medium', weight: 'Bolder' }),
    );
  } else {
    // Fallback: CLI commands
    bodyItems.push(
      textBlock('To approve or reject, run one of these commands:', { spacing: 'Medium', weight: 'Bolder' }),
      container([
        textBlock(`**Approve:** \`${approveCmd}\``, { wrap: true }),
        textBlock(`**Reject:**  \`${rejectCmd}\``, { wrap: true, spacing: 'Small' }),
      ]),
    );
  }

  const actions = [];
  if (hasAgent && runId) {
    actions.push(
      {
        type: 'Action.OpenUrl',
        title: '✅ Approve',
        url: `${agentUrl}/teams-agent/action?action=approve&runId=${runId}&reason=approved+via+Teams+card&ts=${Date.now()}`,
        style: 'positive',
      },
      {
        type: 'Action.OpenUrl',
        title: '❌ Reject',
        url: `${agentUrl}/teams-agent/action?action=reject&runId=${runId}&reason=rejected+via+Teams+card&ts=${Date.now()}`,
        style: 'destructive',
      },
    );
  }

  return {
    $schema: CARD_SCHEMA,
    type: 'AdaptiveCard',
    version: CARD_VERSION,
    body: bodyItems,
    ...(actions.length > 0 ? { actions } : {}),
  };
}

/**
 * error-alert card: loop error, exhausted, or stuck.
 */
function buildErrorAlertCard(opts) {
  const { loop, stage, error, failedChecks, iteration, runId, updatedAt } = opts;
  const checkList = Array.isArray(failedChecks) && failedChecks.length > 0
    ? failedChecks.join(', ')
    : null;

  return {
    $schema: CARD_SCHEMA,
    type: 'AdaptiveCard',
    version: CARD_VERSION,
    body: [
      container([
        textBlock('🔴 Harness — Error Alert', { size: 'Medium', weight: 'Bolder', color: COLOUR.attention }),
        textBlock(`Loop **${loop || '—'}** | Stage **${stage || '—'}** encountered an error.`),
      ], 'emphasis'),
      separator(),
      factSet([
        ['Loop', loop || '—'],
        ['Stage', stage || '—'],
        ['Iteration', iteration ?? '—'],
        ['Run ID', runId || '—'],
        ['Time', fmtTime(updatedAt)],
        ...(checkList ? [['Failed checks', checkList]] : []),
      ]),
      ...(error ? [
        textBlock('Error details:', { spacing: 'Medium', weight: 'Bolder' }),
        container([textBlock(String(error).slice(0, 500), { wrap: true })], 'attention'),
      ] : []),
      textBlock('Run `npm run harness:report` to view the full dashboard.', { subtle: true, spacing: 'Medium' }),
    ],
  };
}

// ---------------------------------------------------------------------------
// Teams webhook payload wrapper
// ---------------------------------------------------------------------------

function wrapCard(card) {
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: card,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// HTTP post (Node built-in only)
// ---------------------------------------------------------------------------

async function postWebhook(webhookUrl, payload, timeoutMs) {
  const parsed = new URL(webhookUrl);
  const body = JSON.stringify(payload);
  const isHttps = parsed.protocol === 'https:';
  const mod = isHttps ? httpsRequest : httpRequest;
  const port = parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80);

  return new Promise((ok, fail) => {
    const req = mod(
      {
        hostname: parsed.hostname,
        port,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(body),
        },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const responseBody = Buffer.concat(chunks).toString('utf8');
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            ok({ status: res.statusCode, body: responseBody });
          } else {
            fail(Object.assign(
              new Error(`Teams webhook returned HTTP ${res.statusCode}: ${responseBody.slice(0, 200)}`),
              { status: res.statusCode }
            ));
          }
        });
      }
    );
    req.on('timeout', () => { req.destroy(); fail(new Error(`Webhook request timed out after ${timeoutMs}ms`)); });
    req.on('error', fail);
    req.write(body);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function showHelp() {
  printJson({
    usage: 'node scripts/harness/teams-notifier.mjs <template> [--flags]',
    templates: {
      'stage-complete': 'Loop stage finished. Flags: --loop, --stage, --status, --iteration, --note, --run-id',
      'approval-needed': 'Loop waiting for approval. Flags: --loop, --stage, --run-id, --note',
      'error-alert': 'Loop error or exhausted. Flags: --loop, --stage, --error, --run-id, --iteration',
    },
    commonFlags: {
      '--dry-run': 'Print card JSON and Teams payload without posting to webhook',
      '--run-id <id>': 'Harness run ID (auto-read from stage-state if omitted)',
      '--loop <name>': 'Loop name (auto-read from stage-state if omitted)',
      '--stage <name>': 'Stage name (auto-read from stage-state if omitted)',
    },
    env: {
      HARNESS_TEAMS_WEBHOOK_URL: 'Teams incoming webhook URL (required unless --dry-run)',
      HARNESS_TEAMS_TIMEOUT_MS: `HTTP timeout in ms (default ${DEFAULT_TIMEOUT_MS})`,
    },
    examples: [
      'node scripts/harness/teams-notifier.mjs stage-complete --loop build-fix --status converged',
      'node scripts/harness/teams-notifier.mjs approval-needed --run-id abc123 --note "Review gate"',
      'node scripts/harness/teams-notifier.mjs error-alert --loop build-fix --error "lint failed"',
      'node scripts/harness/teams-notifier.mjs stage-complete --dry-run',
      'npm run harness:teams:notify -- stage-complete --loop build-fix --status converged',
    ],
  });
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const template = flags._[0];

  if (flags.help || !template) { showHelp(); return; }

  // Auto-populate from live state when no explicit flags
  const liveState = readStageState() || {};
  const loop     = flags.loop  || liveState.loop  || null;
  const stage    = flags.stage || liveState.stage || null;
  const runId    = flags['run-id'] || liveState.runId || null;
  const iteration = flags.iteration !== undefined ? Number(flags.iteration)
    : (liveState.iteration ?? null);
  const updatedAt = liveState.updatedAt || new Date().toISOString();

  let card;

  if (template === 'stage-complete') {
    card = buildStageCompleteCard({
      loop, stage, runId, iteration, updatedAt,
      status: flags.status || liveState.approval?.status || 'unknown',
      note: flags.note || liveState.approval?.note || null,
    });

  } else if (template === 'approval-needed') {
    card = buildApprovalNeededCard({
      loop, stage, runId,
      note: flags.note || liveState.approval?.note || null,
      requestedAt: flags['requested-at'] || liveState.approval?.requestedAt || updatedAt,
    });

  } else if (template === 'error-alert') {
    card = buildErrorAlertCard({
      loop, stage, runId, iteration, updatedAt,
      error: flags.error || null,
      failedChecks: flags['failed-checks'] ? String(flags['failed-checks']).split(',').map(s => s.trim()) : null,
    });

  } else {
    process.stderr.write(`[teams-notifier] Unknown template: ${template}. Use stage-complete, approval-needed, or error-alert.\n`);
    process.exit(2);
  }

  const payload = wrapCard(card);

  if (flags['dry-run']) {
    printJson({ ok: true, dryRun: true, template, card, payload }, 0);
    return;
  }

  const webhookUrl = process.env.HARNESS_TEAMS_WEBHOOK_URL;
  if (!webhookUrl) {
    process.stderr.write('[teams-notifier] HARNESS_TEAMS_WEBHOOK_URL is not set. Use --dry-run to preview the card without posting.\n');
    process.exit(1);
  }

  // Basic URL sanity check — must be https or http, not user-controlled exec
  let parsedUrl;
  try {
    parsedUrl = new URL(webhookUrl);
    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') throw new Error('invalid protocol');
  } catch {
    process.stderr.write(`[teams-notifier] HARNESS_TEAMS_WEBHOOK_URL is not a valid URL: ${webhookUrl.slice(0, 60)}\n`);
    process.exit(1);
  }

  const timeoutMs = Number(process.env.HARNESS_TEAMS_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;

  try {
    const result = await postWebhook(webhookUrl, payload, timeoutMs);
    printJson({ ok: true, template, status: result.status, body: result.body }, 0);
  } catch (err) {
    process.stderr.write(`[teams-notifier] Webhook post failed: ${err.message}\n`);
    printJson({ ok: false, template, error: err.message }, 1);
  }
}

main().catch(err => {
  process.stderr.write(`[teams-notifier] ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
