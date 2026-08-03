/**
 * control-panel — harness control panel module (v3.0.0).
 *
 * Exports three request handlers that extend report-server.mjs:
 *   handleSseState(req, res)    — GET /sse/state  — SSE stream of live stage state
 *   handleApprove(req, res)     — POST /control/approve — write approval to stage-state
 *   handleControlPanel(req, res) — GET /control   — serve control panel HTML
 *
 * SSE reconnect strategy (resolves issue #31):
 *   - Server sends `retry: 3000` hint on first connect
 *   - Heartbeat comment every 25 s prevents proxy timeouts
 *   - Last-Event-ID header replays last state on reconnect
 *   - Client-side: exponential backoff (1s→2s→4s, cap 30s, ±25% jitter)
 *   - Tab visibility: reconnects on hidden→visible
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { readStageState, writeApproval, APPROVAL_STATUSES } from './stage-state.mjs';

const HEARTBEAT_MS = 25_000;
const POLL_MS = 2_000;

// ---------------------------------------------------------------------------
// SSE client registry
// ---------------------------------------------------------------------------

/** @type {Set<import('node:http').ServerResponse>} */
const sseClients = new Set();

let lastEventId = 0;
let lastStateJson = null;

function serialiseState() {
  const state = readStageState();
  return JSON.stringify(state);
}

function sseEvent(res, data, eventId) {
  try {
    res.write(`id: ${eventId}\nevent: state\ndata: ${data}\n\n`);
  } catch { /* client disconnected */ }
}

function heartbeat(res) {
  try { res.write(': heartbeat\n\n'); } catch { /* client disconnected */ }
}

function broadcastState(json, id) {
  for (const client of sseClients) {
    sseEvent(client, json, id);
  }
}

// Poll loop — runs once `startControlPanelPolling()` is called by report-server.mjs
let pollingStarted = false;

export function startControlPanelPolling() {
  if (pollingStarted) return;
  pollingStarted = true;

  // Heartbeat loop
  setInterval(() => {
    for (const client of sseClients) heartbeat(client);
  }, HEARTBEAT_MS);

  // State change detector
  setInterval(() => {
    const json = serialiseState();
    if (json !== lastStateJson) {
      lastStateJson = json;
      lastEventId += 1;
      broadcastState(json, lastEventId);
    }
  }, POLL_MS);
}

// ---------------------------------------------------------------------------
// SSE handler
// ---------------------------------------------------------------------------

export function handleSseState(req, res) {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    'connection': 'keep-alive',
    'x-accel-buffering': 'no',
  });

  // Tell client to retry after 3 s on disconnect
  res.write('retry: 3000\n\n');

  // Replay last event if client provides Last-Event-ID
  const lastId = req.headers['last-event-id'];
  const current = serialiseState();
  if (lastId && lastStateJson) {
    sseEvent(res, lastStateJson, lastEventId);
  } else {
    // Send current state immediately on first connect
    lastStateJson = current;
    lastEventId += 1;
    sseEvent(res, current, lastEventId);
  }

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
}

// ---------------------------------------------------------------------------
// Approve handler
// ---------------------------------------------------------------------------

export async function handleApprove(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { if (body.length < 4096) body += chunk; });
  await new Promise(ok => req.on('end', ok));

  let data;
  try { data = JSON.parse(body); } catch {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Invalid JSON body' }));
    return;
  }

  const { decision, runId, note, decidedBy } = data || {};

  if (!APPROVAL_STATUSES.has(decision)) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: `decision must be one of: ${[...APPROVAL_STATUSES].join(', ')}` }));
    return;
  }

  try {
    const record = writeApproval({
      decision,
      runId: typeof runId === 'string' ? runId.slice(0, 128) : undefined,
      note: typeof note === 'string' ? note.slice(0, 500) : undefined,
      decidedBy: typeof decidedBy === 'string' ? decidedBy.slice(0, 100) : undefined,
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, approval: record }));
  } catch (err) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  }
}

// ---------------------------------------------------------------------------
// Control panel HTML
// ---------------------------------------------------------------------------

export function handleControlPanel(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const role = url.searchParams.get('role') === 'end-user' ? 'end-user' : 'operator';
  const html = buildControlPanelHtml(role);
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}

function buildControlPanelHtml(role) {
  const isOperator = role === 'operator';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Harness Control Panel</title>
<style>
:root {
  --bg: #f8f9fa; --card: #fff; --border: #dee2e6; --text: #212529;
  --muted: #6c757d; --accent: #0d6efd; --good: #198754; --warn: #ffc107;
  --danger: #dc3545; --radius: 8px; --shadow: 0 1px 4px rgba(0,0,0,.08);
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #1a1d21; --card: #25282d; --border: #373b41; --text: #e9ecef; --muted: #adb5bd; }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); padding: 24px; }
h1 { font-size: 1.4rem; font-weight: 700; margin-bottom: 4px; }
.subtitle { color: var(--muted); font-size: .85rem; margin-bottom: 20px; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow); padding: 20px; margin-bottom: 16px; }
.card h2 { font-size: 1rem; font-weight: 600; margin-bottom: 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: .78rem; font-weight: 600; }
.badge-good { background: #d1e7dd; color: #0f5132; }
.badge-warn { background: #fff3cd; color: #664d03; }
.badge-danger { background: #f8d7da; color: #842029; }
.badge-neutral { background: #e2e3e5; color: #41464b; }
.fact-grid { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; font-size: .9rem; }
.fact-label { color: var(--muted); }
.fact-value { font-weight: 500; word-break: break-all; }
.approval-form { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.approval-form input, .approval-form textarea {
  border: 1px solid var(--border); border-radius: 4px; padding: 8px 10px;
  font-size: .9rem; background: var(--bg); color: var(--text); }
.btn-row { display: flex; gap: 10px; flex-wrap: wrap; }
button { padding: 8px 18px; border: none; border-radius: 4px; font-size: .9rem; font-weight: 600;
  cursor: pointer; transition: opacity .15s; }
button:disabled { opacity: .5; cursor: not-allowed; }
.btn-approve { background: var(--good); color: #fff; }
.btn-reject  { background: var(--danger); color: #fff; }
.btn-pending { background: var(--warn); color: #212529; }
.status-bar { display: flex; align-items: center; gap: 8px; font-size: .82rem; color: var(--muted);
  margin-bottom: 16px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--muted); }
.dot.live { background: var(--good); animation: pulse 2s infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
.no-run { color: var(--muted); font-size: .95rem; font-style: italic; }
.role-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
.role-tab { padding: 6px 14px; border-radius: 4px; font-size: .85rem; font-weight: 600;
  text-decoration: none; border: 1px solid var(--border); color: var(--muted); background: var(--card); }
.role-tab.active { background: var(--accent); color: #fff; border-color: var(--accent); }
#toast { position: fixed; bottom: 24px; right: 24px; background: #333; color: #fff; border-radius: 6px;
  padding: 12px 18px; font-size: .9rem; opacity: 0; transition: opacity .3s; pointer-events: none; z-index: 100; }
#toast.show { opacity: 1; }
</style>
</head>
<body>
<h1>Harness Control Panel</h1>
<p class="subtitle">Live stage state &amp; approval interface &bull; <a href="/report.html">View metrics dashboard →</a></p>

<div class="role-tabs">
  <a href="?role=operator" class="role-tab ${isOperator ? 'active' : ''}">Operator</a>
  <a href="?role=end-user" class="role-tab ${!isOperator ? 'active' : ''}">End User (Approvals only)</a>
</div>

<div class="status-bar">
  <div class="dot" id="sseStatus"></div>
  <span id="sseLabel">Connecting…</span>
</div>

<div id="statePanel"></div>

${isOperator ? `<div class="card" id="approvalCard" style="display:none">
<h2>Approve / Reject</h2>
<div id="approvalInfo"></div>
<div class="approval-form">
  <input type="text" id="noteInput" placeholder="Note (optional)" maxlength="500">
  <div class="btn-row">
    <button class="btn-approve" id="btnApprove" onclick="submitApproval('approved')">✅ Approve</button>
    <button class="btn-reject" id="btnReject" onclick="submitApproval('rejected')">❌ Reject</button>
  </div>
</div>
</div>` : `<div class="card" id="approvalCard" style="display:none">
<h2>Pending Approval</h2>
<div id="approvalInfo"></div>
<div class="approval-form">
  <input type="text" id="noteInput" placeholder="Your note (optional)" maxlength="500">
  <div class="btn-row">
    <button class="btn-approve" id="btnApprove" onclick="submitApproval('approved')">✅ Approve</button>
    <button class="btn-reject" id="btnReject" onclick="submitApproval('rejected')">❌ Reject</button>
  </div>
</div>
</div>`}

<div id="toast"></div>

<script>
(function() {
  const role = '${role}';
  let currentRunId = null;
  let retryDelay = 1000;
  let es = null;

  function badge(status) {
    const s = String(status || '').toLowerCase();
    if (s === 'approved' || s === 'converged') return \`<span class="badge badge-good">\${status}</span>\`;
    if (s === 'pending' || s === 'exhausted' || s === 'stuck') return \`<span class="badge badge-warn">\${status}</span>\`;
    if (s === 'rejected' || s === 'blocked' || s === 'error') return \`<span class="badge badge-danger">\${status}</span>\`;
    return \`<span class="badge badge-neutral">\${status || '—'}</span>\`;
  }

  function fmt(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch { return iso; }
  }

  function renderState(state) {
    const panel = document.getElementById('statePanel');
    const approvalCard = document.getElementById('approvalCard');
    const approvalInfo = document.getElementById('approvalInfo');

    if (!state || state.cleared) {
      panel.innerHTML = \`<div class="card"><p class="no-run">No active run. Start a harness loop to see live progress.</p></div>\`;
      approvalCard.style.display = 'none';
      currentRunId = null;
      return;
    }

    currentRunId = state.runId || null;
    const approval = state.approval || {};
    const needsApproval = approval.required && approval.status === 'pending';

    const operatorExtra = role === 'operator' ? \`
      <div class="fact-label">Run ID</div><div class="fact-value">\${state.runId || '—'}</div>
      <div class="fact-label">Mode</div><div class="fact-value">\${state.mode || 'dev'}</div>
      <div class="fact-label">Created</div><div class="fact-value">\${fmt(state.createdAt)}</div>
      <div class="fact-label">Updated</div><div class="fact-value">\${fmt(state.updatedAt)}</div>
    \` : '';

    panel.innerHTML = \`<div class="card">
      <h2>Active Run</h2>
      <div class="fact-grid">
        <div class="fact-label">Loop</div><div class="fact-value">\${state.loop || '—'}</div>
        <div class="fact-label">Stage</div><div class="fact-value">\${state.stage || '—'}</div>
        <div class="fact-label">Iteration</div><div class="fact-value">\${state.iteration ?? '—'}</div>
        <div class="fact-label">Approval</div><div class="fact-value">\${badge(approval.status)}</div>
        \${approval.note ? \`<div class="fact-label">Note</div><div class="fact-value">\${approval.note}</div>\` : ''}
        \${operatorExtra}
      </div>
    </div>\`;

    if (needsApproval) {
      approvalInfo.innerHTML = \`<p>Loop <strong>\${state.loop}</strong> at stage <strong>\${state.stage}</strong> is waiting for approval.</p>\`;
      approvalCard.style.display = '';
      document.getElementById('btnApprove').disabled = false;
      document.getElementById('btnReject').disabled = false;
    } else {
      approvalCard.style.display = 'none';
    }
  }

  function toast(msg, isError) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = isError ? 'show' : 'show';
    el.style.background = isError ? '#842029' : '#1a5c36';
    clearTimeout(el._t);
    el._t = setTimeout(() => el.className = '', 3000);
  }

  async function submitApproval(decision) {
    document.getElementById('btnApprove').disabled = true;
    document.getElementById('btnReject').disabled = true;
    const note = document.getElementById('noteInput').value.slice(0, 500);
    try {
      const r = await fetch('/control/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, runId: currentRunId, note, decidedBy: role }),
      });
      const json = await r.json();
      if (json.ok) {
        toast(decision === 'approved' ? '✅ Approved' : '❌ Rejected');
        document.getElementById('approvalCard').style.display = 'none';
      } else {
        toast('Error: ' + (json.error || 'Unknown'), true);
        document.getElementById('btnApprove').disabled = false;
        document.getElementById('btnReject').disabled = false;
      }
    } catch (e) {
      toast('Network error', true);
      document.getElementById('btnApprove').disabled = false;
      document.getElementById('btnReject').disabled = false;
    }
  }

  // Make submitApproval accessible from inline onclick
  window.submitApproval = submitApproval;

  function setStatus(live, label) {
    const dot = document.getElementById('sseStatus');
    const lbl = document.getElementById('sseLabel');
    dot.className = 'dot' + (live ? ' live' : '');
    lbl.textContent = label;
  }

  function connect() {
    if (es) { try { es.close(); } catch {} }
    setStatus(false, 'Connecting…');
    es = new EventSource('/sse/state');

    es.addEventListener('state', e => {
      retryDelay = 1000;
      setStatus(true, 'Live');
      try { renderState(JSON.parse(e.data)); } catch {}
    });

    es.addEventListener('open', () => setStatus(true, 'Live'));

    es.addEventListener('error', () => {
      setStatus(false, 'Reconnecting…');
      es.close();
      es = null;
      const jitter = retryDelay * (0.75 + Math.random() * 0.5);
      retryDelay = Math.min(retryDelay * 2, 30000);
      setTimeout(connect, jitter);
    });
  }

  // Reconnect on tab focus
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && (!es || es.readyState === EventSource.CLOSED)) connect();
  });

  connect();
})();
</script>
</body>
</html>`;
}
