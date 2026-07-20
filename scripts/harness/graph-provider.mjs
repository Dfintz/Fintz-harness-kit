#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { assertSafeCliCommand } from './command-validation.mjs';

export const GRAPH_PROVIDER_VALUES = ['understand-anything', 'graphify', 'both'];
export const DEFAULT_GRAPH_PROVIDER = 'understand-anything';
export const DEFAULT_UA_GRAPH_PATH = '.understand-anything/knowledge-graph.json';
export const DEFAULT_GRAPHIFY_GRAPH_PATH = '.graphify/knowledge-graph.json';
export const DEFAULT_GRAPHIFY_HTML_PATH = '.graphify/graph.html';
export const DEFAULT_GRAPH_EVENTS_PATH = '.github/harness/runs/graph-events.jsonl';

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

function parseJsonLines(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
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

function isPathWithinRoot(root, targetPath) {
  const rel = relative(root, targetPath);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function toAbsoluteMaybe(repoRoot, value) {
  if (typeof value !== 'string' || value.trim().length === 0) return undefined;
  return isAbsolute(value) ? value : resolve(repoRoot, value.trim());
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
  const syncConfig = graphConfig.sync && typeof graphConfig.sync === 'object' ? graphConfig.sync : {};
  const observabilityConfig =
    graphConfig.observability && typeof graphConfig.observability === 'object'
      ? graphConfig.observability
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
  const graphifyRefreshCommand = stringOrUndefined(graphifyConfig.refreshCommand);
  const graphifyRefreshCwd = toAbsoluteMaybe(repoRoot, graphifyConfig.refreshCwd) ?? repoRoot;
  const uaPluginRoot = stringOrUndefined(graphConfig.pluginRoot);
  const graphEventsPath = toAbsolutePath(
    repoRoot,
    observabilityConfig.eventsPath,
    DEFAULT_GRAPH_EVENTS_PATH
  );

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
        refreshSupported: Boolean(graphifyRefreshCommand),
        graphPath: graphifyGraphPath,
        graphHtmlPath: graphifyHtmlPath,
        refreshCommand: graphifyRefreshCommand,
        refreshCwd: graphifyRefreshCwd,
        cliAvailable: graphifyCliAvailable,
        signalPresent: graphifySignal,
      },
    },
    sync: {
      rebuildVectorIndex: syncConfig.rebuildVectorIndex === true,
      rebuildMemoryLinkIndex: syncConfig.rebuildMemoryLinkIndex === true,
      continueOnSyncError: syncConfig.continueOnSyncError === true,
    },
    observability: {
      eventsPath: graphEventsPath,
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
  let target;
  try {
    target = resolveGraphQueryTarget(state);
  } catch (error) {
    emitGraphEvent({
      repoRoot,
      configPath,
      eventType: 'degradation',
      coreStatus: {
        provider: state.selectedProvider,
        activeProviders: state.activeProviders,
        queryGraphPath: null,
        refreshReadiness: computeRefreshReadiness(state),
        degradationReason: error instanceof Error ? error.message : String(error),
      },
      details: { phase: 'query.resolve' },
    });
    throw error;
  }
  if (
    state.selectedProvider === 'both' &&
    target.providerId === 'graphify' &&
    !existsSync(state.providers['understand-anything'].graphPath)
  ) {
    emitGraphEvent({
      repoRoot,
      configPath,
      eventType: 'query.fallback',
      coreStatus: {
        provider: state.selectedProvider,
        activeProviders: state.activeProviders,
        queryProvider: target.providerId,
        queryGraphPath: toWorkspacePath(repoRoot, target.graphPath),
        refreshReadiness: computeRefreshReadiness(state),
        degradationReason: 'understand-anything graph missing; query fallback to graphify',
      },
      details: {
        fallbackFrom: 'understand-anything',
        fallbackTo: 'graphify',
      },
    });
  }
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

function computeRefreshReadiness(state) {
  const byProvider = {};
  for (const providerId of state.activeProviders) {
    const provider = state.providers[providerId];
    if (providerId === 'understand-anything') {
      const pluginRoot = stringOrUndefined(provider.pluginRoot);
      const ready = Boolean(pluginRoot) && !pluginRoot.startsWith('<');
      byProvider[providerId] = {
        supported: provider.refreshSupported,
        ready,
        reason: ready
          ? null
          : 'graph.pluginRoot is required for understand-anything refresh.',
      };
      continue;
    }
    const ready = Boolean(provider.refreshCommand);
    byProvider[providerId] = {
      supported: provider.refreshSupported,
      ready,
      reason: ready
        ? null
        : 'graph.graphify.refreshCommand is required for graphify refresh.',
    };
  }
  const blocked = Object.entries(byProvider)
    .filter(([, readiness]) => !readiness.ready)
    .map(([providerId, readiness]) => `${providerId}: ${readiness.reason}`);
  return {
    ready: blocked.length === 0,
    requiredProviders: state.activeProviders,
    byProvider,
    reason: blocked.length > 0 ? blocked.join(' | ') : null,
  };
}

export function buildGraphStatusCore({
  repoRoot,
  configPath,
  overrideProvider,
  probe = true,
} = {}) {
  const state = resolveGraphProviderState({
    repoRoot,
    configPath,
    overrideProvider,
    probe,
  });
  let queryTarget = null;
  let queryError = null;
  try {
    queryTarget = resolveGraphQueryTarget(state);
  } catch (error) {
    queryError = error instanceof Error ? error.message : String(error);
  }
  const refreshReadiness = computeRefreshReadiness(state);
  const degradationReason = queryError || refreshReadiness.reason || null;
  return {
    provider: state.selectedProvider,
    selectedProvider: state.selectedProvider,
    activeProviders: state.activeProviders,
    queryProvider: queryTarget?.providerId ?? null,
    queryGraphPath: queryTarget?.graphPath ? toWorkspacePath(repoRoot, queryTarget.graphPath) : null,
    refreshReadiness,
    degradationReason,
  };
}

export function emitGraphEvent({
  repoRoot,
  configPath,
  eventType,
  coreStatus,
  details,
} = {}) {
  if (!repoRoot) return { ok: false, error: 'emitGraphEvent requires repoRoot' };
  if (typeof eventType !== 'string' || eventType.trim().length === 0) {
    return { ok: false, error: 'emitGraphEvent requires eventType' };
  }
  const state = resolveGraphProviderState({ repoRoot, configPath, probe: false });
  const payload = {
    timestamp: new Date().toISOString(),
    eventType: eventType.trim(),
    provider: coreStatus?.provider ?? state.selectedProvider,
    activeProviders: coreStatus?.activeProviders ?? state.activeProviders,
    queryProvider: coreStatus?.queryProvider ?? null,
    queryGraphPath: coreStatus?.queryGraphPath ?? null,
    refreshReadiness: coreStatus?.refreshReadiness ?? computeRefreshReadiness(state),
    degradationReason: coreStatus?.degradationReason ?? null,
    details: details && typeof details === 'object' ? details : undefined,
  };
  try {
    mkdirSync(dirname(state.observability.eventsPath), { recursive: true });
    appendFileSync(state.observability.eventsPath, `${JSON.stringify(payload)}\n`, 'utf8');
    return {
      ok: true,
      eventPath: toWorkspacePath(repoRoot, state.observability.eventsPath),
      event: payload,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      event: payload,
    };
  }
}

export function readGraphEvents({ repoRoot, configPath, limit = 20 } = {}) {
  const state = resolveGraphProviderState({ repoRoot, configPath, probe: false });
  const eventPath = state.observability.eventsPath;
  if (!existsSync(eventPath)) {
    return {
      exists: false,
      path: toWorkspacePath(repoRoot, eventPath),
      events: [],
    };
  }
  const parsed = parseJsonLines(readFileSync(eventPath, 'utf8'));
  const boundedLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 20;
  const events = parsed.slice(-boundedLimit);
  return {
    exists: true,
    path: toWorkspacePath(repoRoot, eventPath),
    count: parsed.length,
    events,
  };
}

export function resolveRefreshBackend(state) {
  return resolveRefreshBackends(state)[0];
}

export function resolveRefreshBackends(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('Graph provider state is required.');
  }

  const backends = [];
  const wantUA =
    state.selectedProvider === 'understand-anything' || state.selectedProvider === 'both';
  const wantGraphify =
    state.selectedProvider === 'graphify' || state.selectedProvider === 'both';

  if (wantUA) {
    backends.push({
      providerId: 'understand-anything',
      graphPath: state.providers['understand-anything'].graphPath,
      pluginRoot: state.providers['understand-anything'].pluginRoot,
    });
  }

  if (wantGraphify) {
    const graphify = state.providers.graphify;
    if (!graphify.refreshCommand) {
      if (state.selectedProvider === 'graphify') {
        throw new Error(
          'graph.provider is "graphify", but graph.graphify.refreshCommand is not configured. ' +
            'Action: set graph.graphify.refreshCommand in harness.config.json to a deterministic command that writes graph.graphify.path.'
        );
      }
    } else {
      assertSafeCliCommand(graphify.refreshCommand, {
        label: 'graphify refresh command',
      });
      backends.push({
        providerId: 'graphify',
        graphPath: graphify.graphPath,
        graphHtmlPath: graphify.graphHtmlPath,
        refreshCommand: graphify.refreshCommand,
        refreshCwd: graphify.refreshCwd,
      });
    }
  }

  if (backends.length === 0) {
    throw new Error(
      `No refresh backend resolved for provider "${state.selectedProvider}".`
    );
  }

  return backends;
}

export function buildProviderStatusPayload({ repoRoot, configPath, overrideProvider } = {}) {
  const core = buildGraphStatusCore({ repoRoot, configPath, overrideProvider, probe: true });
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
            refreshCommandConfigured: Boolean(provider.refreshCommand),
            refreshCwd: toWorkspacePath(repoRoot, provider.refreshCwd),
            cliAvailable: provider.cliAvailable,
            signalPresent: provider.signalPresent,
          }),
    };
  }

  return {
    ...core,
    active,
    observability: readGraphEvents({ repoRoot, configPath, limit: 5 }),
  };
}

export function buildGraphGenUiPayload({ repoRoot, configPath, overrideProvider } = {}) {
  const core = buildGraphStatusCore({ repoRoot, configPath, overrideProvider, probe: true });
  const state = resolveGraphProviderState({
    repoRoot,
    configPath,
    overrideProvider,
    probe: true,
  });

  const graphify = state.providers.graphify;
  const htmlAbsolutePath = graphify.graphHtmlPath;
  const htmlWithinRepo = isPathWithinRoot(repoRoot, htmlAbsolutePath);
  const htmlExists = existsSync(htmlAbsolutePath);
  const httpPath = htmlWithinRepo ? '/graph.html' : null;
  return {
    ok: true,
    ...core,
    graphHtml: {
      configuredPath: toWorkspacePath(repoRoot, htmlAbsolutePath),
      absolutePath: htmlAbsolutePath,
      withinRepo: htmlWithinRepo,
      exists: htmlExists,
      httpPath,
    },
    notes:
      htmlWithinRepo && htmlExists
        ? []
        : [
            !htmlWithinRepo
              ? 'Configured graphHtmlPath is outside repo root; report server will refuse to serve it.'
              : 'Configured graphHtmlPath does not exist yet; run graph refresh/export first.',
          ],
    observability: readGraphEvents({ repoRoot, configPath, limit: 10 }),
  };
}
