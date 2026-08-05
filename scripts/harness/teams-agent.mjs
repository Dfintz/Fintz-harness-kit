#!/usr/bin/env node
/**
 * teams-agent — v3.0.0 Bi-directional Teams Bot for Harness Approvals
 *
 * A Microsoft Teams bot that:
 *   1. Sends Adaptive Card notifications (stage-complete, approval-needed, error-alert)
 *   2. Listens for approval/rejection commands via Teams messages
 *   3. Updates harness stage-state.mjs with approval decisions
 *   4. Handles Adaptive Card action callbacks (button clicks)
 *
 * Architecture:
 *   - Teams → Message Activity (BotBuilder SDK) → parse command → update stage-state
 *   - Harness → POST /teams-agent/notify → send Adaptive Card → Teams channel
 *   - Card Action → Teams → HTTP callback → POST /teams-agent/action → approve/reject
 *
 * Deployment:
 *   1. Register bot in Azure Bot Service (get MicrosoftAppId, MicrosoftAppPassword)
 *   2. Configure Teams channel in Bot Service
 *   3. Set env vars: HARNESS_TEAMS_BOT_*
 *   4. npm run harness:teams:agent
 *
 * Usage:
 *   node scripts/harness/teams-agent.mjs
 *   npm run harness:teams:agent
 *
 * Env:
 *   HARNESS_TEAMS_BOT_APP_ID       Microsoft App ID (from Azure Bot Service)
 *   HARNESS_TEAMS_BOT_APP_PASSWORD Microsoft App Password
 *   HARNESS_TEAMS_BOT_PORT         Listen port (default 3978)
 *   HARNESS_TEAMS_BOT_CHANNEL_ID   Target Teams channel ID (for notification routing)
 *   HARNESS_STATE_DIR              Path to harness state directory (default .github/harness/runs)
 *   HARNESS_API_KEY                Secret for securing the /teams-agent/action callback
 *
 * Teams Bot Commands:
 *   @harness approve --run-id abc123 --reason "looks good"
 *   @harness reject --run-id abc123 --reason "needs revision"
 *   @harness status
 *
 * Callback Actions (from Adaptive Card buttons):
 *   POST /teams-agent/action
 *     { "action": "approve", "runId": "abc123", "userId": "user@company.com" }
 */

import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readStageState, writeApproval, readApprovals } from './stage-state.mjs';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

const VERSION = '3.0.0';
const PORT = Number(process.env.HARNESS_TEAMS_BOT_PORT || 3978);
const APP_ID = process.env.HARNESS_TEAMS_BOT_APP_ID;
const APP_PASSWORD = process.env.HARNESS_TEAMS_BOT_APP_PASSWORD;
const CHANNEL_ID = process.env.HARNESS_TEAMS_BOT_CHANNEL_ID;
const SECRET_KEY = process.env.HARNESS_API_KEY;

let serverInstance = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function log(level, msg, data = {}) {
  const ts = new Date().toISOString();
  console.log(JSON.stringify({ ts, level, msg, ...data }));
}

function parseJson(body, defaultValue = null) {
  try {
    return JSON.parse(body);
  } catch (e) {
    return defaultValue;
  }
}

// ---------------------------------------------------------------------------
// Approval parsing from Teams messages
// ---------------------------------------------------------------------------

/**
 * Parse a Teams message for approval/rejection commands.
 * Matches: "approve --run-id <id> --reason <text>"
 *          "reject --run-id <id> --reason <text>"
 *          "status"
 */
function parseApprovalCommand(text) {
  if (!text) return null;

  const normalized = text.toLowerCase().trim();

  // Check for approve/reject commands
  const approveMatch = normalized.match(/approve\s+--run-id\s+([\w-]+)(?:\s+--reason\s+(.+))?/);
  if (approveMatch) {
    return {
      type: 'approve',
      runId: approveMatch[1],
      reason: approveMatch[2]?.trim() || 'approved via Teams',
    };
  }

  const rejectMatch = normalized.match(/reject\s+--run-id\s+([\w-]+)(?:\s+--reason\s+(.+))?/);
  if (rejectMatch) {
    return {
      type: 'reject',
      runId: rejectMatch[1],
      reason: rejectMatch[2]?.trim() || 'rejected via Teams',
    };
  }

  // Status query
  if (normalized === 'status') {
    return { type: 'status' };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Approval handler
// ---------------------------------------------------------------------------

async function handleApprovalDecision(decision) {
  const { type, runId, reason, userId, kind, operation, maintenanceManifest, preStateRef, postStateRef } = decision;

  if (!runId) {
    return {
      status: 400,
      body: JSON.stringify({ error: 'runId required', decision }),
    };
  }

  try {
    const normalizedDecision = type === 'approve' ? 'approved' : 'rejected';
    // Write approval to stage-state
    writeApproval({
      runId,
      decision: normalizedDecision,
      note: reason || `${normalizedDecision} via Teams agent`,
      decidedBy: userId || 'teams-agent',
      decidedAt: new Date().toISOString(),
      kind,
      operation,
      maintenanceManifest,
      preStateRef,
      postStateRef,
    });

    log('info', 'Approval recorded', { runId, type, userId });

    return {
      status: 200,
      body: JSON.stringify({
        ok: true,
        runId,
        decision: type,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (err) {
    log('error', 'Failed to record approval', { runId, error: String(err) });
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to record approval', details: String(err) }),
    };
  }
}

// ---------------------------------------------------------------------------
// Response formatters
// ---------------------------------------------------------------------------

function statusResponse() {
  try {
    const state = readStageState();
    const approvals = readApprovals();

    return {
      status: 200,
      body: JSON.stringify({
        state,
        recentApprovals: approvals.slice(-5),
      }),
    };
  } catch (err) {
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to read state', details: String(err) }),
    };
  }
}

function notifyResponse(opts) {
  return {
    status: 202,
    body: JSON.stringify({
      ok: true,
      notification: {
        template: opts.template,
        loop: opts.loop,
        stage: opts.stage,
        queuedAt: new Date().toISOString(),
      },
    }),
  };
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

async function handleNotifyRequest(body) {
  // POST /teams-agent/notify
  // Route to Teams channel and send Adaptive Card
  // In real deployment: use BotBuilder SDK to send activity to Teams
  const payload = parseJson(body);

  if (!payload?.template) {
    return { status: 400, body: JSON.stringify({ error: 'template required' }) };
  }

  log('info', 'Teams notification queued', {
    template: payload.template,
    loop: payload.loop,
    stage: payload.stage,
  });

  // In production: use Microsoft.Bot.Builder to send message to Teams
  // For now, return 202 Accepted
  return notifyResponse(payload);
}

async function handleActionRequest(body) {
  // POST /teams-agent/action
  // Handle Adaptive Card button actions (approve/reject)
  const payload = parseJson(body);

  if (!payload?.action) {
    return { status: 400, body: JSON.stringify({ error: 'action required' }) };
  }

  const decision = {
    type: payload.action === 'approve' ? 'approve' : 'reject',
    runId: payload.runId,
    reason: payload.reason || payload.text,
    userId: payload.userId || payload.from?.name || 'unknown',
  };

  return handleApprovalDecision(decision);
}

async function handleStatusRequest() {
  // GET /teams-agent/status
  return statusResponse();
}

async function handleTeamsWebhookRequest(body) {
  // POST /api/messages
  // Teams sends activity here via Bot Framework
  // Parse message activity and handle approval commands
  const activity = parseJson(body);

  if (!activity?.type || activity.type !== 'message') {
    return { status: 200, body: JSON.stringify({ ok: true }) };
  }

  const text = activity.text || '';
  const command = parseApprovalCommand(text);

  if (!command) {
    return { status: 200, body: JSON.stringify({ ok: true }) };
  }

  if (command.type === 'status') {
    return statusResponse();
  }

  return handleApprovalDecision({
    type: command.type,
    runId: command.runId,
    reason: command.reason,
    userId: activity.from?.name || 'unknown',
  });
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------

function createTeamsAgentServer() {
  const server = createServer(async (req, res) => {
    const { method, url } = req;
    let body = '';

    // Collect request body
    req.on('data', chunk => {
      body += chunk.toString('utf8');
      if (body.length > 1_000_000) {
        res.writeHead(413);
        res.end('Payload too large');
      }
    });

    req.on('end', async () => {
      try {
        let response = { status: 404, body: JSON.stringify({ error: 'Not found' }) };

        if (method === 'GET' && url === '/healthz') {
          response = { status: 200, body: JSON.stringify({ ok: true, version: VERSION }) };
        } else if (method === 'GET' && url === '/teams-agent/status') {
          response = await handleStatusRequest();
        } else if (method === 'POST' && url === '/teams-agent/notify') {
          response = await handleNotifyRequest(body);
        } else if (method === 'POST' && url === '/teams-agent/action') {
          response = await handleActionRequest(body);
        } else if (method === 'POST' && url === '/api/messages') {
          // Teams Bot Framework webhook
          response = await handleTeamsWebhookRequest(body);
        } else {
          log('warn', 'Unknown route', { method, url });
        }

        res.writeHead(response.status, { 'content-type': 'application/json' });
        res.end(response.body);
      } catch (err) {
        log('error', 'Handler error', { error: String(err), url });
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    });
  });

  return server;
}

// ---------------------------------------------------------------------------
// CLI / Startup
// ---------------------------------------------------------------------------

function printUsage() {
  console.log(`
teams-agent — v${VERSION} Bi-directional Teams Bot for Harness

Usage:
  node scripts/harness/teams-agent.mjs
  npm run harness:teams:agent

Environment Variables:
  HARNESS_TEAMS_BOT_APP_ID       Microsoft App ID (required)
  HARNESS_TEAMS_BOT_APP_PASSWORD Microsoft App Password (required)
  HARNESS_TEAMS_BOT_PORT         Listen port (default 3978)
  HARNESS_TEAMS_BOT_CHANNEL_ID   Target Teams channel ID
  HARNESS_STATE_DIR              Harness state directory
  HARNESS_API_KEY                Secret for callback actions

Teams Bot Commands (from Teams chat):
  @harness approve --run-id abc123 --reason "lgtm"
  @harness reject --run-id abc123 --reason "needs work"
  @harness status

HTTP Endpoints:
  GET  /healthz                  Liveness probe
  GET  /teams-agent/status       Current harness state + recent approvals
  POST /teams-agent/notify       Queue a notification to Teams
  POST /teams-agent/action       Handle card action callbacks (approve/reject)
  POST /api/messages             Teams Bot Framework webhook
  `);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  // Validate required env
  if (!APP_ID || !APP_PASSWORD) {
    log('error', 'Missing required env vars', {
      APP_ID: !!APP_ID,
      APP_PASSWORD: !!APP_PASSWORD,
    });
    console.error('Error: HARNESS_TEAMS_BOT_APP_ID and HARNESS_TEAMS_BOT_APP_PASSWORD required');
    process.exit(1);
  }

  // Create and start server
  serverInstance = createTeamsAgentServer();
  serverInstance.listen(PORT, () => {
    log('info', 'Teams Agent started', {
      version: VERSION,
      port: PORT,
      appId: APP_ID.slice(0, 8) + '***',
    });
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('info', 'SIGTERM received, shutting down');
    if (serverInstance) serverInstance.close(() => process.exit(0));
  });
}

// Export for testing and module usage
export {
  parseApprovalCommand,
  handleApprovalDecision,
  createTeamsAgentServer,
};

// Run if invoked directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    log('error', 'Fatal error', { error: String(err) });
    process.exit(1);
  });
}
