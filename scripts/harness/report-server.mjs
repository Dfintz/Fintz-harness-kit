#!/usr/bin/env node
/**
 * Always-on harness dashboard sidecar.
 *
 * Periodically regenerates the harness report (scripts/harness/harness-report.mjs)
 * and serves the resulting self-contained HTML over HTTP. Designed for optional
 * Docker sidecar usage (docker-compose.dev.yml --profile dashboard) but also fully
 * runnable on the host.
 *
 * It never runs a loop or invokes an agent; it only re-renders what previous runs
 * recorded in .github/harness/runs/ plus project memory (lessons, briefs, graph).
 *
 * Usage:
 *   node scripts/harness/report-server.mjs
 *   node scripts/harness/report-server.mjs --port 8099 --interval-seconds 60
 *
 * Options:
 *   --port <n>              HTTP port to listen on (default 8099).
 *   --host <addr>           Bind address (default 0.0.0.0).
 *   --interval-seconds <n>  Regeneration interval (default 60).
 *   --help                  Show this help.
 *
 * Env fallbacks:
 *   HARNESS_DASHBOARD_PORT
 *   HARNESS_DASHBOARD_HOST
 *   HARNESS_DASHBOARD_INTERVAL_SECONDS
 *
 * Endpoints:
 *   GET /            -> latest report HTML
 *   GET /report.html -> latest report HTML (alias)
 *   GET /metrics.json -> aggregated metrics as JSON (live)
 *   GET /healthz     -> "ok" (liveness)
 *   GET /graph.html  -> provider-configured graph html if present/safe
 *   GET /genui/graph.json -> graph render payload for GenUI consumers
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGraphGenUiPayload } from './graph-provider.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const configPath = join(repoRoot, 'harness.config.json');
const reportScript = resolve(repoRoot, 'scripts', 'harness', 'harness-report.mjs');
const reportHtmlPath = join(repoRoot, '.github', 'harness', 'runs', 'report.html');

// The report prints a terminal summary to stdout alongside writing the HTML file.
// Keep a generous buffer so a large summary can never SIGTERM-kill the child the
// way the default 1 MB cap can (see graph-refresh-loop.mjs for the same lesson).
const SPAWN_MAX_BUFFER = 64 * 1024 * 1024;

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      flags._.push(arg);
      continue;
    }
    if (arg === '--help') {
      flags.help = true;
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
}

function parsePositiveInt(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function showHelp() {
  process.stdout.write(
    `${JSON.stringify(
      {
        usage:
          'node scripts/harness/report-server.mjs [--port <n>] [--host <addr>] [--interval-seconds <n>]',
        endpoints: [
          'GET /',
          'GET /report.html',
          'GET /metrics.json',
          'GET /graph.html',
          'GET /genui/graph.json',
          'GET /healthz',
        ],
        envFallbacks: [
          'HARNESS_DASHBOARD_PORT',
          'HARNESS_DASHBOARD_HOST',
          'HARNESS_DASHBOARD_INTERVAL_SECONDS',
        ],
      },
      null,
      2
    )}\n`
  );
}

let regenerating = false;

function regenerate() {
  // Guard against overlap if a regeneration runs long and the interval fires again.
  if (regenerating) return;
  regenerating = true;
  const stamp = new Date().toISOString();
  try {
    const result = spawnSync(process.execPath, [reportScript, '--out', reportHtmlPath], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: SPAWN_MAX_BUFFER,
    });
    if (result.status === 0) {
      process.stdout.write(`[harness-dashboard] ${stamp} report regenerated\n`);
      return;
    }
    const reason =
      result.signal != null ? `signal ${result.signal}` : `exit ${result.status ?? 'unknown'}`;
    process.stderr.write(`[harness-dashboard] ${stamp} report generation failed (${reason})\n`);
    if (result.error) process.stderr.write(`${result.error.message}\n`);
    if (result.stderr) process.stderr.write(result.stderr);
  } finally {
    regenerating = false;
  }
}

function readMetricsJson() {
  const result = spawnSync(process.execPath, [reportScript, '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: SPAWN_MAX_BUFFER,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || `harness-report --json exited ${result.status ?? 'unknown'}`);
  }
  return result.stdout;
}

function serveReport(res) {
  if (!existsSync(reportHtmlPath)) {
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '5' });
    res.end(
      '<!doctype html><meta charset="utf-8"><title>Harness dashboard</title>' +
        '<body style="font-family:sans-serif;padding:40px"><h1>Harness dashboard</h1>' +
        '<p>The report is generating — refresh in a few seconds.</p></body>'
    );
    return;
  }
  try {
    const html = readFileSync(reportHtmlPath);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Failed to read report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function serveMetrics(res) {
  try {
    const json = readMetricsJson();
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(json);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
  }
}

function getGraphGenUiPayload() {
  return buildGraphGenUiPayload({
    repoRoot,
    configPath,
    overrideProvider: process.env.HARNESS_GRAPH_PROVIDER,
  });
}

function serveGraphGenUi(res) {
  try {
    const payload = getGraphGenUiPayload();
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    });
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })
    );
  }
}

function serveGraphHtml(res) {
  try {
    const payload = getGraphGenUiPayload();
    if (!payload.graphHtml.withinRepo) {
      res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error:
            'Configured graphHtmlPath is outside repository root and cannot be served by report-server.',
        })
      );
      return;
    }
    if (!payload.graphHtml.exists) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(
        JSON.stringify({
          ok: false,
          error: 'graph.html is not present at configured graphHtmlPath.',
          graphHtmlPath: payload.graphHtml.configuredPath,
        })
      );
      return;
    }

    const html = readFileSync(payload.graphHtml.absolutePath);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(html);
  } catch (error) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) })
    );
  }
}

function createDashboardServer() {
  return createServer((req, res) => {
    const path = (req.url || '/').split('?')[0];
    if (path === '/healthz') {
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('ok');
      return;
    }
    if (path === '/metrics.json') {
      serveMetrics(res);
      return;
    }
    if (path === '/genui/graph.json' || path === '/genui/graph') {
      serveGraphGenUi(res);
      return;
    }
    if (path === '/graph.html') {
      serveGraphHtml(res);
      return;
    }
    if (path === '/' || path === '/index.html' || path === '/report.html') {
      serveReport(res);
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  });
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const port = parsePositiveInt(flags.port ?? process.env.HARNESS_DASHBOARD_PORT, 8099);
  const host = String(flags.host || process.env.HARNESS_DASHBOARD_HOST || '0.0.0.0').trim();
  const intervalSeconds = parsePositiveInt(
    flags['interval-seconds'] ?? process.env.HARNESS_DASHBOARD_INTERVAL_SECONDS,
    60
  );

  regenerate();
  const timer = setInterval(regenerate, intervalSeconds * 1000);

  const server = createDashboardServer();
  server.listen(port, host, () => {
    process.stdout.write(
      `[harness-dashboard] serving on http://${host}:${port} (interval=${intervalSeconds}s)\n`
    );
  });

  const shutdown = signal => {
    process.stdout.write(`[harness-dashboard] received ${signal}, shutting down\n`);
    clearInterval(timer);
    server.close(() => process.exit(0));
    // Force-exit if connections linger past a short grace window.
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main();
