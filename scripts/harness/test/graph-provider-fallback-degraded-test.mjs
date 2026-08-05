#!/usr/bin/env node

/**
 * Deterministic tests for degraded graph-provider fallback behavior.
 *
 * Scenarios covered:
 * 1) provider=both with missing understand-anything graph falls back to graphify,
 *    preserves degraded refresh readiness metadata, and emits query.fallback event.
 * 2) provider=understand-anything with missing UA graph falls back to local graph
 *    when discoverable, while still reporting degraded refresh readiness.
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  buildGraphStatusCore,
  loadGraphForQuery,
  readGraphEvents,
} from '../graph-provider.mjs';

const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

function pass(message) {
  results.passed += 1;
  console.log(`  PASS ${message}`);
}

function fail(message) {
  results.failed += 1;
  results.errors.push(message);
  console.log(`  FAIL ${message}`);
}

function assert(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function writeJson(filePath, payload) {
  mkdirSync(resolve(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8');
}

function writeGraphFixture(filePath) {
  writeJson(filePath, {
    generatedAt: new Date(0).toISOString(),
    project: { gitCommitHash: 'fixture' },
    nodes: [],
    edges: [],
    layers: [],
  });
}

function withEnvOverride(name, value, fn) {
  const original = Object.prototype.hasOwnProperty.call(process.env, name)
    ? process.env[name]
    : undefined;
  if (value === undefined || value === null) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
  try {
    return fn();
  } finally {
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
}

function runBothProviderFallbackScenario() {
  console.log('\n=== Scenario 1: both -> graphify fallback when UA graph missing ===');
  const repoRoot = mkdtempSync(join(tmpdir(), 'graph-fallback-both-'));
  try {
    const configPath = join(repoRoot, 'harness.config.json');
    const graphifyPath = join(repoRoot, '.graphify', 'knowledge-graph.json');

    writeGraphFixture(graphifyPath);
    writeJson(configPath, {
      graph: {
        provider: 'both',
        path: '.understand-anything/knowledge-graph.json',
        graphify: {
          path: '.graphify/knowledge-graph.json',
          refreshCommand: 'echo graphify-refresh',
        },
        observability: {
          eventsPath: '.github/harness/runs/graph-events.jsonl',
        },
      },
    });

    const core = withEnvOverride('UNDERSTAND_PLUGIN_ROOT', '', () =>
      buildGraphStatusCore({
        repoRoot,
        configPath,
        probe: false,
      })
    );

    assert(core.provider === 'both', 'core provider is both');
    assert(core.queryProvider === 'graphify', 'query provider falls back to graphify');
    assert(core.refreshReadiness.ready === false, 'refresh readiness reports degraded state');
    assert(
      String(core.degradationReason || '').includes('graph.pluginRoot or UNDERSTAND_PLUGIN_ROOT is required'),
      'degradation reason includes missing plugin root guidance'
    );

    const loaded = withEnvOverride('UNDERSTAND_PLUGIN_ROOT', '', () =>
      loadGraphForQuery({ repoRoot, configPath })
    );
    assert(loaded.providerId === 'graphify', 'loadGraphForQuery resolves graphify backend');

    const events = readGraphEvents({ repoRoot, configPath, limit: 10 });
    const fallbackEvent = (events.events || []).find(event => event.eventType === 'query.fallback');
    assert(events.exists === true, 'events log exists after fallback load');
    assert(Boolean(fallbackEvent), 'query.fallback event is emitted');
    assert(
      fallbackEvent?.details?.fallbackFrom === 'understand-anything' &&
        fallbackEvent?.details?.fallbackTo === 'graphify',
      'query.fallback event details record source and target provider'
    );
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

function runUaProviderLocalFallbackScenario() {
  console.log('\n=== Scenario 2: understand-anything -> local fallback when UA graph missing ===');
  const repoRoot = mkdtempSync(join(tmpdir(), 'graph-fallback-ua-local-'));
  try {
    const configPath = join(repoRoot, 'harness.config.json');
    const localGraphPath = join(repoRoot, 'knowledge-graph.json');

    writeGraphFixture(localGraphPath);
    writeJson(configPath, {
      graph: {
        provider: 'understand-anything',
        path: '.understand-anything/knowledge-graph.json',
      },
    });

    const core = withEnvOverride('UNDERSTAND_PLUGIN_ROOT', '', () =>
      buildGraphStatusCore({
        repoRoot,
        configPath,
        probe: false,
      })
    );

    assert(core.provider === 'understand-anything', 'core provider is understand-anything');
    assert(core.queryProvider === 'local', 'query provider falls back to local graph');
    assert(core.refreshReadiness.ready === false, 'refresh readiness remains degraded without plugin root');
    assert(
      String(core.degradationReason || '').includes('graph.pluginRoot or UNDERSTAND_PLUGIN_ROOT is required'),
      'degradation reason still points to missing UA plugin root'
    );

    const loaded = withEnvOverride('UNDERSTAND_PLUGIN_ROOT', '', () =>
      loadGraphForQuery({ repoRoot, configPath })
    );
    assert(loaded.providerId === 'local', 'loadGraphForQuery resolves local backend');
    const raw = readFileSync(localGraphPath, 'utf8');
    assert(raw.includes('"nodes": []'), 'local graph fixture remains intact for deterministic reads');
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

function run() {
  console.log('Deterministic degraded-provider fallback checks\n');
  runBothProviderFallbackScenario();
  runUaProviderLocalFallbackScenario();

  console.log('\nSummary');
  console.log(`  Passed: ${results.passed}`);
  console.log(`  Failed: ${results.failed}`);

  if (results.failed > 0) {
    console.log('\nFailures');
    for (const error of results.errors) {
      console.log(`  - ${error}`);
    }
    process.exit(1);
  }

  console.log('\nAll degraded fallback checks passed.');
}

run();
