#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';

export const GRAPH_PROVIDER_VALUES = ['understand-anything', 'graphify', 'both'];
export const DEFAULT_GRAPH_PROVIDER = 'understand-anything';
export const DEFAULT_UA_GRAPH_PATH = '.understand-anything/knowledge-graph.json';
export const DEFAULT_GRAPHIFY_GRAPH_PATH = '.graphify/knowledge-graph.json';
export const DEFAULT_GRAPHIFY_HTML_PATH = '.graphify/graph.html';

function toWorkspacePath(repoRoot, absolutePath) {
  return relative(repoRoot, absolutePath).replaceAll('\\', '/');
}

function toAbsolutePath(repoRoot, configuredPath, fallbackRelativePath) {
  const rawPath =
    typeof configuredPath === 'string' && configuredPath.trim().length > 0
      ? configuredPath.trim()
      : fallbackRelativePath;
  if (isAbsolute(rawPath)) return rawPath;
  return resolve(repoRoot, rawPath);
}

function readHarnessConfig(configPath) {
  if (!existsSync(configPath)) return {};
  const raw = readFileSync(configPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') return {};
  return parsed;
}

function stringOrUndefined(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function graphifySignalsPresent() {
  return (
    stringOrUndefined(process.env.GRAPHIFY_API_KEY) ||
    stringOrUndefined(process.env.GRAPHIFY_PROJECT_ID) ||
    stringOrUndefined(process.env.GRAPHIFY_URL) ||
    stringOrUndefined(process.env.GRAPHIFY_HOST)
  );
}

function probeGraphifyCli() {
  const result = spawnSync('graphify', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.status === 0;
}

export function normalizeGraphProvider(value) {
  const normalized = String(value || DEFAULT_GRAPH_PROVIDER)
    .trim()
    .toLowerCase();
  if (GRAPH_PROVIDER_VALUES.includes(normalized)) {
    return normalized;
  }
  throw new Error(
    `Invalid graph provider "${value}". Expected one of: ${GRAPH_PROVIDER_VALUES.join(', ')}.`
  );
}

function activeProvidersFor(provider) {
  if (provider === 'both') return ['understand-anything', 'graphify'];
  return [provider];
}

export function resolveGraphProviderState({
  repoRoot,
  configPath = join(repoRoot, 'harness.config.json'),
  overrideProvider,
  probe = false,
} = {}) {
  if (!repoRoot) {
    throw new Error('resolveGraphProviderState requires repoRoot');
  }

  const config = readHarnessConfig(configPath);
  const graphConfig = config.graph && typeof config.graph === 'object' ? config.graph : {};
  const graphifyConfig =
    graphConfig.graphify && typeof graphConfig.graphify === 'object'
      ? graphConfig.graphify
      : {};
  const selectedProvider = normalizeGraphProvider(overrideProvider ?? graphConfig.provider);
  const activeProviders = activeProvidersFor(selectedProvider);

  const uaGraphPath = toAbsolutePath(repoRoot, graphConfig.path, DEFAULT_UA_GRAPH_PATH);
  const graphifyGraphPath = toAbsolutePath(
    repoRoot,
    graphifyConfig.path,
    DEFAULT_GRAPHIFY_GRAPH_PATH
  );
  const graphifyHtmlPath = toAbsolutePath(
    repoRoot,
    graphConfig.graphHtmlPath ?? graphifyConfig.graphHtmlPath,
    DEFAULT_GRAPHIFY_HTML_PATH
  );
  const uaPluginRoot = stringOrUndefined(graphConfig.pluginRoot);

  const graphifyCliAvailable = probe ? probeGraphifyCli() : null;
  const graphifySignal = Boolean(graphifySignalsPresent());

  return {
    selectedProvider,
    activeProviders,
    graph: {
      uaGraphPath,
      graphifyGraphPath,
      graphifyHtmlPath,
    },
    providers: {
      'understand-anything': {
        id: 'understand-anything',
        available: existsSync(uaGraphPath),
        querySupported: true,
        refreshSupported: true,
        pluginRoot: uaPluginRoot,
        graphPath: uaGraphPath,
      },
      graphify: {
        id: 'graphify',
        available:
          existsSync(graphifyGraphPath) ||
          graphifySignal ||
          (graphifyCliAvailable === true),
        querySupported: existsSync(graphifyGraphPath),
        refreshSupported: false,
        graphPath: graphifyGraphPath,
        graphHtmlPath: graphifyHtmlPath,
        cliAvailable: graphifyCliAvailable,
        signalPresent: graphifySignal,
      },
    },
  };
}

export function resolveGraphQueryTarget(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('Graph provider state is required.');
  }

  if (state.selectedProvider === 'understand-anything') {
    return { providerId: 'understand-anything', graphPath: state.providers['understand-anything'].graphPath };
  }

  if (state.selectedProvider === 'graphify') {
    const graphify = state.providers.graphify;
    if (!graphify.querySupported) {
      throw new Error(
        `graph.provider is "graphify", but no queryable graph snapshot was found at ${graphify.graphPath}. ` +
          'Action: export a compatible graph snapshot there or set graph.provider to "understand-anything" or "both".'
      );
    }
    return { providerId: 'graphify', graphPath: graphify.graphPath };
  }

  if (existsSync(state.providers['understand-anything'].graphPath)) {
    return { providerId: 'understand-anything', graphPath: state.providers['understand-anything'].graphPath };
  }
  if (state.providers.graphify.querySupported) {
    return { providerId: 'graphify', graphPath: state.providers.graphify.graphPath };
  }
  throw new Error(
    `graph.provider is "both", but neither provider has a queryable graph snapshot. ` +
      `Checked ${state.providers['understand-anything'].graphPath} and ${state.providers.graphify.graphPath}.`
  );
}

export function loadGraphForQuery({ repoRoot, configPath, overrideProvider } = {}) {
  const state = resolveGraphProviderState({ repoRoot, configPath, overrideProvider, probe: false });
  const target = resolveGraphQueryTarget(state);
  if (!existsSync(target.graphPath)) {
    throw new Error(`Graph file not found at ${target.graphPath}.`);
  }
  const graph = JSON.parse(readFileSync(target.graphPath, 'utf8'));
  if (!graph || typeof graph !== 'object') {
    throw new Error(`Graph file is not a JSON object: ${target.graphPath}`);
  }
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error(
      `Graph file at ${target.graphPath} is missing nodes/edges arrays required by harness graph queries.`
    );
  }
  return {
    providerState: state,
    providerId: target.providerId,
    graphPath: target.graphPath,
    graph,
  };
}

export function resolveRefreshBackend(state) {
  if (state.selectedProvider === 'graphify') {
    throw new Error(
      'graph.provider is "graphify", but scripts/harness/refresh-graph.mjs currently supports deterministic refresh only via Understand-Anything. ' +
        'Action: set graph.provider to "understand-anything" (or "both") for this refresh path.'
    );
  }
  return {
    providerId: 'understand-anything',
    graphPath: state.providers['understand-anything'].graphPath,
    pluginRoot: state.providers['understand-anything'].pluginRoot,
  };
}

export function buildProviderStatusPayload({ repoRoot, configPath, overrideProvider } = {}) {
  const state = resolveGraphProviderState({
    repoRoot,
    configPath,
    overrideProvider,
    probe: true,
  });
  const active = {};
  for (const providerId of state.activeProviders) {
    const provider = state.providers[providerId];
    active[providerId] = {
      available: provider.available,
      querySupported: provider.querySupported,
      refreshSupported: provider.refreshSupported,
      graphPath: toWorkspacePath(repoRoot, provider.graphPath),
      graphPathExists: existsSync(provider.graphPath),
      ...(providerId === 'understand-anything'
        ? {
            pluginRoot: provider.pluginRoot || null,
          }
        : {
            graphHtmlPath: toWorkspacePath(repoRoot, provider.graphHtmlPath),
            graphHtmlExists: existsSync(provider.graphHtmlPath),
            cliAvailable: provider.cliAvailable,
            signalPresent: provider.signalPresent,
          }),
    };
  }

  return {
    selectedProvider: state.selectedProvider,
    activeProviders: state.activeProviders,
    active,
  };
}
