#!/usr/bin/env node
/**
 * Deterministic knowledge-graph refresh using the local Understand plugin.
 *
 * This script is designed for host usage and containerized usage.
 * It refreshes .understand-anything/knowledge-graph.json and can optionally
 * auto-commit only that file.
 *
 * Usage:
 *   node scripts/harness/refresh-graph.mjs --plugin-root <path>
 *   node scripts/harness/refresh-graph.mjs --provider understand-anything --plugin-root <path>
 *   node scripts/harness/refresh-graph.mjs --plugin-root <path> --commit
 *   node scripts/harness/refresh-graph.mjs --plugin-root <path> --with-local-state
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  buildGraphStatusCore,
  emitGraphEvent,
  resolveGraphProviderState,
  resolveRefreshBackends,
} from './graph-provider.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EXTRACTED_EDGE_TYPES = new Set(['imports', 'contains', 'exports']);

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

    if (arg === '--commit' || arg === '--with-local-state') {
      flags[arg.slice(2)] = true;
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }

    flags[key] = next;
    i += 1;
  }
  return flags;
}

function toPosix(pathValue) {
  return pathValue.replace(/\\/g, '/');
}

function isCodeCategory(category) {
  return category === 'code' || category === 'script';
}

function complexityFromLines(lines) {
  if (lines <= 80) return 'simple';
  if (lines <= 300) return 'moderate';
  return 'complex';
}

function inferNodeType(filePath, fileCategory) {
  const normalized = toPosix(filePath);
  const base = basename(normalized);
  const ext = extname(normalized).toLowerCase();

  if (fileCategory === 'docs') return 'document';
  if (fileCategory === 'config') return 'config';

  if (fileCategory === 'infra') {
    if (
      base === 'Dockerfile' ||
      base.startsWith('Dockerfile.') ||
      base.startsWith('docker-compose.') ||
      base === 'compose.yml' ||
      base === 'compose.yaml'
    ) {
      return 'service';
    }
    if (
      normalized.startsWith('.github/workflows/') ||
      normalized.startsWith('.circleci/') ||
      base === '.gitlab-ci.yml'
    ) {
      return 'pipeline';
    }
    if (ext === '.tf' || ext === '.tfvars') return 'resource';
    return 'config';
  }

  if (fileCategory === 'data') {
    if (ext === '.sql') return 'table';
    if (ext === '.graphql' || ext === '.gql' || ext === '.proto' || ext === '.prisma') {
      return 'schema';
    }
    return 'schema';
  }

  return 'file';
}

function summarizeFile(filePath, fileCategory, language, lineCount) {
  const name = basename(filePath);
  if (fileCategory === 'docs') {
    return `Documentation file ${name}`;
  }
  if (fileCategory === 'infra') {
    return `Infrastructure file ${name}`;
  }
  return `${fileCategory} ${language} file (${lineCount} lines)`;
}

function normalizeLineRange(value) {
  if (!Array.isArray(value) || value.length < 2) return [1, 1];
  const start = Number(value[0]);
  const end = Number(value[1]);
  const normalizedStart = Number.isFinite(start) && start > 0 ? Math.floor(start) : 1;
  const normalizedEnd =
    Number.isFinite(end) && end >= normalizedStart ? Math.floor(end) : normalizedStart;
  return [normalizedStart, normalizedEnd];
}

function normalizeCodeAnalysis(analysis) {
  const functions = Array.isArray(analysis?.functions)
    ? analysis.functions
        .filter(item => item && typeof item.name === 'string' && item.name.length > 0)
        .map(item => ({
          name: item.name,
          lineRange: normalizeLineRange(item.lineRange),
          params: Array.isArray(item.params)
            ? item.params.filter(param => typeof param === 'string')
            : [],
        }))
    : [];

  const classes = Array.isArray(analysis?.classes)
    ? analysis.classes
        .filter(item => item && typeof item.name === 'string' && item.name.length > 0)
        .map(item => ({
          name: item.name,
          lineRange: normalizeLineRange(item.lineRange),
          methods: Array.isArray(item.methods)
            ? item.methods.filter(method => typeof method === 'string')
            : [],
          properties: Array.isArray(item.properties)
            ? item.properties.filter(property => typeof property === 'string')
            : [],
        }))
    : [];

  return { functions, classes };
}

function normalizeDefinitions(analysis) {
  return Array.isArray(analysis?.definitions)
    ? analysis.definitions
        .filter(item => item && typeof item.name === 'string' && item.name.length > 0)
        .map(item => ({
          kind: typeof item.kind === 'string' ? item.kind : 'schema',
          name: item.name,
          fields: Array.isArray(item.fields)
            ? item.fields.filter(field => typeof field === 'string')
            : [],
          lineRange: normalizeLineRange(item.lineRange),
        }))
    : [];
}

function normalizeServices(analysis) {
  return Array.isArray(analysis?.services)
    ? analysis.services
        .filter(item => item && typeof item.name === 'string' && item.name.length > 0)
        .map(item => ({
          name: item.name,
          image: typeof item.image === 'string' ? item.image : undefined,
          ports: Array.isArray(item.ports) ? item.ports : [],
          lineRange: normalizeLineRange(item.lineRange),
        }))
    : [];
}

function normalizeEndpoints(analysis) {
  return Array.isArray(analysis?.endpoints)
    ? analysis.endpoints
        .filter(item => item && typeof item.path === 'string' && item.path.length > 0)
        .map(item => ({
          method: typeof item.method === 'string' ? item.method : undefined,
          path: item.path,
          lineRange: normalizeLineRange(item.lineRange),
        }))
    : [];
}

function normalizeSteps(analysis) {
  return Array.isArray(analysis?.steps)
    ? analysis.steps
        .filter(item => item && typeof item.name === 'string' && item.name.length > 0)
        .map(item => ({
          name: item.name,
          lineRange: normalizeLineRange(item.lineRange),
        }))
    : [];
}

function normalizeResources(analysis) {
  return Array.isArray(analysis?.resources)
    ? analysis.resources
        .filter(item => item && typeof item.name === 'string' && item.name.length > 0)
        .map(item => ({
          name: item.name,
          kind: typeof item.kind === 'string' ? item.kind : 'resource',
          lineRange: normalizeLineRange(item.lineRange),
        }))
    : [];
}

function hasNonCodeStructure(payload) {
  return (
    payload.definitions.length > 0 ||
    payload.services.length > 0 ||
    payload.endpoints.length > 0 ||
    payload.steps.length > 0 ||
    payload.resources.length > 0
  );
}

function runNodeScript(scriptPath, args, cwd) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout || `exit code ${result.status}`;
    throw new Error(`Failed script ${scriptPath}: ${details}`);
  }

  return (result.stdout || '').trim();
}

function runGit(args, cwd, allowFailure = false) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0 && !allowFailure) {
    const stderr = (result.stderr || '').trim();
    throw new Error(`git ${args.join(' ')} failed: ${stderr || result.status}`);
  }

  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
  };
}

function ensureGraphRelativePath(projectRoot, absoluteGraphPath) {
  const graphRelativePath = toPosix(relative(projectRoot, absoluteGraphPath));
  if (graphRelativePath.startsWith('..')) {
    throw new Error(
      `Configured graph path ${absoluteGraphPath} is outside the project root (${projectRoot}).`
    );
  }
  return graphRelativePath;
}

function validateGraphShape(graphPath) {
  if (!existsSync(graphPath)) {
    throw new Error(`Graph file not found after refresh: ${graphPath}`);
  }
  let graph;
  try {
    graph = JSON.parse(readFileSync(graphPath, 'utf8'));
  } catch (error) {
    throw new Error(
      `Graph file is not valid JSON at ${graphPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    throw new Error(`Graph file at ${graphPath} is missing required nodes/edges arrays.`);
  }
  return graph;
}

function runGraphifyRefreshBackend(projectRoot, backend) {
  const graphRelativePath = ensureGraphRelativePath(projectRoot, backend.graphPath);
  const command = String(backend.refreshCommand || '').trim();
  if (!command) {
    throw new Error('Graphify refresh backend is missing refreshCommand.');
  }

  const result = spawnSync(command, {
    cwd: backend.refreshCwd || projectRoot,
    shell: true,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout || `exit ${result.status ?? 'unknown'}`;
    throw new Error(
      `Graphify refresh command failed (${command}): ${details}. ` +
        'Action: verify graph.graphify.refreshCommand and Graphify runtime setup.'
    );
  }

  const graph = validateGraphShape(backend.graphPath);
  return {
    provider: 'graphify',
    graphPath: graphRelativePath,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    refreshCommand: command,
  };
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'y') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'n') {
    return false;
  }
  return fallback;
}

function emitGraphEventWarning(outcome) {
  if (outcome?.ok) return;
  const message = outcome?.error || 'unknown event-write failure';
  process.stderr.write(`[refresh-graph] observability event write failed: ${message}\n`);
}

function emitRefreshEvent({
  projectRoot,
  configPath,
  providerOverride,
  eventType,
  details,
  degradationReason = null,
}) {
  let coreStatus;
  try {
    coreStatus = buildGraphStatusCore({
      repoRoot: projectRoot,
      configPath,
      overrideProvider: providerOverride,
      probe: false,
    });
  } catch (error) {
    coreStatus = {
      provider: providerOverride || null,
      activeProviders: [],
      queryProvider: null,
      queryGraphPath: null,
      refreshReadiness: {
        ready: false,
        requiredProviders: [],
        byProvider: {},
        reason: error instanceof Error ? error.message : String(error),
      },
      degradationReason: error instanceof Error ? error.message : String(error),
    };
  }
  if (degradationReason) {
    coreStatus.degradationReason = degradationReason;
  }
  const outcome = emitGraphEvent({
    repoRoot: projectRoot,
    configPath,
    eventType,
    coreStatus,
    details,
  });
  emitGraphEventWarning(outcome);
}

function parseJsonMaybe(text) {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function runPostRefreshSync({ projectRoot, providerState }) {
  const syncConfig = providerState.sync || {};
  const tasks = [];
  if (syncConfig.rebuildVectorIndex) {
    tasks.push({
      id: 'vector-index',
      script: join(projectRoot, 'scripts', 'harness', 'vector-search.mjs'),
      args: ['index', '--scope', 'all'],
    });
  }
  if (syncConfig.rebuildMemoryLinkIndex) {
    tasks.push({
      id: 'memory-link-index',
      script: join(projectRoot, 'scripts', 'harness', 'memory-link-index.mjs'),
      args: ['build'],
    });
  }

  const runs = [];
  for (const task of tasks) {
    const startedAt = new Date().toISOString();
    try {
      const output = runNodeScript(task.script, task.args, projectRoot);
      runs.push({
        id: task.id,
        ok: true,
        startedAt,
        completedAt: new Date().toISOString(),
        output: parseJsonMaybe(output) ?? output,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      runs.push({
        id: task.id,
        ok: false,
        startedAt,
        completedAt: new Date().toISOString(),
        error: errorMessage,
      });
      if (!syncConfig.continueOnSyncError) {
        throw new Error(`Post-refresh sync step "${task.id}" failed: ${errorMessage}`);
      }
    }
  }

  return {
    configured: tasks.map(task => task.id),
    continueOnSyncError: syncConfig.continueOnSyncError === true,
    runs,
  };
}

function showHelp() {
  const payload = {
    usage: {
      command: 'node scripts/harness/refresh-graph.mjs [--plugin-root <path>] [options]',
      options: {
        '--project-root <path>': 'Project root to analyze (default: repository root).',
        '--plugin-root <path>':
          'Understand plugin root (required only when refreshing understand-anything backend).',
        '--provider <name>': 'Graph provider override (understand-anything|graphify|both).',
        '--commit': 'Commit only the configured graph file when it changed.',
        '--commit-message <text>': 'Override commit message.',
        '--with-local-state': 'Also write .understand-anything/meta.json and fingerprints.json.',
      },
    },
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    showHelp();
    return;
  }

  const projectRoot = resolve(String(flags['project-root'] || repoRoot));
  const configPath = join(projectRoot, 'harness.config.json');
  const providerOverride = flags.provider || process.env.HARNESS_GRAPH_PROVIDER;
  let providerState = null;

  try {
    providerState = resolveGraphProviderState({
      repoRoot: projectRoot,
      configPath,
      overrideProvider: providerOverride,
    });
    const refreshBackends = resolveRefreshBackends(providerState);
    emitRefreshEvent({
      projectRoot,
      configPath,
      providerOverride,
      eventType: 'refresh.start',
      details: {
        selectedProvider: providerState.selectedProvider,
        refreshBackends: refreshBackends.map(item => item.providerId),
      },
    });
    const uaBackend = refreshBackends.find(backend => backend.providerId === 'understand-anything');
    const graphifyBackend = refreshBackends.find(backend => backend.providerId === 'graphify');

    if (!uaBackend) {
      const graphifySummary = runGraphifyRefreshBackend(projectRoot, graphifyBackend);
      const postRefreshSync = runPostRefreshSync({ projectRoot, providerState });
      let committed = false;
      let commitHash = null;
      const shouldCommit =
        Boolean(flags.commit) || parseBoolean(process.env.GRAPH_REFRESH_AUTO_COMMIT, false);
      if (shouldCommit) {
        const commitMessage = String(
          flags['commit-message'] ||
            process.env.GRAPH_REFRESH_COMMIT_MESSAGE ||
            'chore(harness): refresh knowledge graph'
        );
        const worktreeChanged = runGit(
          ['diff', '--quiet', '--', graphifySummary.graphPath],
          projectRoot,
          true
        ).status;
        const stagedChanged = runGit(
          ['diff', '--cached', '--quiet', '--', graphifySummary.graphPath],
          projectRoot,
          true
        ).status;
        const hasGraphChanges = worktreeChanged === 1 || stagedChanged === 1;
        if (hasGraphChanges) {
          runGit(['commit', '--only', '-m', commitMessage, '--', graphifySummary.graphPath], projectRoot);
          committed = true;
          commitHash = runGit(['rev-parse', 'HEAD'], projectRoot).stdout;
        }
      }

      const summary = {
        generatedAt: new Date().toISOString(),
        projectRoot,
        provider: providerState.selectedProvider,
        refreshBackends: [graphifySummary],
        graphPath: graphifySummary.graphPath,
        postRefreshSync,
      };
      emitRefreshEvent({
        projectRoot,
        configPath,
        providerOverride,
        eventType: 'refresh.success',
        details: { summary, committed, commitHash },
      });
      process.stdout.write(`${JSON.stringify({ ok: true, summary, committed, commitHash }, null, 2)}\n`);
      return;
    }

    const pluginRootRaw = String(
      flags['plugin-root'] || process.env.UNDERSTAND_PLUGIN_ROOT || uaBackend.pluginRoot || ''
    ).trim();
    if (!pluginRootRaw) {
      throw new Error(
        `Missing plugin root for provider ${providerState.selectedProvider}. ` +
          'Provide --plugin-root, UNDERSTAND_PLUGIN_ROOT, or graph.pluginRoot.'
      );
    }
    const pluginRoot = resolve(pluginRootRaw);

    const scanScript = join(pluginRoot, 'skills', 'understand', 'scan-project.mjs');
    const extractImportScript = join(pluginRoot, 'skills', 'understand', 'extract-import-map.mjs');
    const coreIndexPath = join(pluginRoot, 'packages', 'core', 'dist', 'index.js');

    for (const requiredPath of [scanScript, extractImportScript, coreIndexPath]) {
      if (!existsSync(requiredPath)) {
        throw new Error(`Missing required plugin file: ${requiredPath}`);
      }
    }

    const uaDir = join(projectRoot, '.understand-anything');
    const intermediateDir = join(uaDir, 'intermediate');
    mkdirSync(intermediateDir, { recursive: true });
    const graphRelativePath = ensureGraphRelativePath(projectRoot, uaBackend.graphPath);

    const scanPath = join(intermediateDir, 'scan-script.json');
    const importInputPath = join(intermediateDir, 'import-input.json');
    const importMapPath = join(intermediateDir, 'import-map.json');
    const summaryPath = join(intermediateDir, 'full-rebuild-summary.json');

    runNodeScript(scanScript, [projectRoot, scanPath], projectRoot);

    const scan = JSON.parse(readFileSync(scanPath, 'utf8'));
    const scanFiles = Array.isArray(scan.files) ? scan.files : [];

    const importInput = {
      projectRoot: toPosix(projectRoot),
      files: scanFiles,
    };
    writeFileSync(importInputPath, JSON.stringify(importInput, null, 2));
    runNodeScript(extractImportScript, [importInputPath, importMapPath], projectRoot);

    const importPayload = JSON.parse(readFileSync(importMapPath, 'utf8'));
    const importMap =
      importPayload && typeof importPayload.importMap === 'object' && importPayload.importMap !== null
        ? importPayload.importMap
        : {};

    const coreModule = await import(pathToFileURL(coreIndexPath).href);
    const {
      TreeSitterPlugin,
      PluginRegistry,
      builtinLanguageConfigs,
      registerAllParsers,
      GraphBuilder,
      detectLayers,
      generateHeuristicTour,
      validateGraph,
      saveGraph,
      saveMeta,
      saveFingerprints,
      buildFingerprintStore,
    } = coreModule;

    const tsConfigs = builtinLanguageConfigs.filter(config => config.treeSitter);
    const tsPlugin = new TreeSitterPlugin(tsConfigs);
    await tsPlugin.init();

    const registry = new PluginRegistry();
    registry.register(tsPlugin);
    registerAllParsers(registry);

    const gitCommitHash = execSync('git rev-parse HEAD', {
      cwd: projectRoot,
      encoding: 'utf8',
    }).trim();

    const builder = new GraphBuilder(scan.projectName || basename(projectRoot), gitCommitHash);

    let analyzedFiles = 0;
    for (const file of scanFiles) {
      const relPath = toPosix(String(file.path || ''));
      if (!relPath) continue;

      const absolutePath = join(projectRoot, relPath);
      if (!existsSync(absolutePath)) continue;

      let content;
      try {
        content = readFileSync(absolutePath, 'utf8');
      } catch {
        continue;
      }

      const lineCount = content.length === 0 ? 0 : content.split(/\r?\n/).length;
      const fileCategory = String(file.fileCategory || 'code');
      const language = String(file.language || 'unknown');
      const complexity = complexityFromLines(lineCount);

      const tags = [`language:${language}`, `category:${fileCategory}`];
      const summary = summarizeFile(relPath, fileCategory, language, lineCount);

      let analysis = null;
      try {
        analysis = registry.analyzeFile(relPath, content);
      } catch {
        analysis = null;
      }

      if (isCodeCategory(fileCategory)) {
        const normalizedCode = normalizeCodeAnalysis(analysis);
        const meta = {
          fileSummary: summary,
          tags,
          complexity,
          summaries: {},
        };

        if (normalizedCode.functions.length > 0 || normalizedCode.classes.length > 0) {
          builder.addFileWithAnalysis(relPath, normalizedCode, meta);
        } else {
          builder.addFile(relPath, {
            summary,
            tags,
            complexity,
          });
        }
      } else {
        const normalizedNonCode = {
          definitions: normalizeDefinitions(analysis),
          services: normalizeServices(analysis),
          endpoints: normalizeEndpoints(analysis),
          steps: normalizeSteps(analysis),
          resources: normalizeResources(analysis),
        };

        const meta = {
          nodeType: inferNodeType(relPath, fileCategory),
          summary,
          tags,
          complexity,
          ...normalizedNonCode,
        };

        if (hasNonCodeStructure(normalizedNonCode)) {
          builder.addNonCodeFileWithAnalysis(relPath, meta);
        } else {
          builder.addNonCodeFile(relPath, meta);
        }
      }

      analyzedFiles += 1;
    }

    for (const [source, targets] of Object.entries(importMap)) {
      if (!Array.isArray(targets)) continue;
      const normalizedSource = toPosix(source);
      for (const target of targets) {
        if (typeof target !== 'string') continue;
        builder.addImportEdge(normalizedSource, toPosix(target));
      }
    }

    let graph = builder.build();
    graph.project = {
      ...graph.project,
      name: scan.projectName || graph.project.name,
      description: scan.projectDescription || graph.project.description || '',
      frameworks: Array.isArray(scan.frameworks) ? scan.frameworks : graph.project.frameworks,
      languages: Array.isArray(scan.languages)
        ? [...new Set(scan.languages)].sort((left, right) =>
            String(left).localeCompare(String(right))
          )
        : graph.project.languages,
      analyzedAt: new Date().toISOString(),
      gitCommitHash,
    };

    graph.layers = detectLayers(graph);
    graph.tour = generateHeuristicTour(graph);
    graph.edges = graph.edges.map(edge => ({
      ...edge,
      confidence: edge.confidence || (EXTRACTED_EDGE_TYPES.has(edge.type) ? 'EXTRACTED' : 'INFERRED'),
    }));

    const validation = validateGraph(graph);
    if (!validation.success || !validation.data) {
      const issueText = Array.isArray(validation.issues)
        ? validation.issues.map(issue => issue.message).join('; ')
        : '';
      const details = validation.fatal || issueText || 'unknown validation failure';
      throw new Error(`Graph validation failed: ${details}`);
    }

    const finalGraph = validation.data;
    saveGraph(projectRoot, finalGraph);

    const withLocalState = Boolean(flags['with-local-state']);
    if (withLocalState) {
      saveMeta(projectRoot, {
        lastAnalyzedAt: new Date().toISOString(),
        gitCommitHash,
        version: finalGraph.version || '1.0.0',
        analyzedFiles,
      });
      const sourceFilePaths = scanFiles.map(file => toPosix(String(file.path || ''))).filter(Boolean);

      const store = buildFingerprintStore(projectRoot, sourceFilePaths, registry, gitCommitHash);
      saveFingerprints(projectRoot, store);
    }

    const refreshBackendSummaries = [
      {
        provider: 'understand-anything',
        graphPath: graphRelativePath,
        analyzedFiles,
        nodeCount: finalGraph.nodes.length,
        edgeCount: finalGraph.edges.length,
        layerCount: finalGraph.layers.length,
        tourSteps: finalGraph.tour.length,
        validationIssues: Array.isArray(validation.issues) ? validation.issues : [],
      },
    ];

    if (graphifyBackend) {
      refreshBackendSummaries.push(runGraphifyRefreshBackend(projectRoot, graphifyBackend));
    }

    const postRefreshSync = runPostRefreshSync({ projectRoot, providerState });

    const summary = {
      generatedAt: new Date().toISOString(),
      projectRoot,
      pluginRoot,
      provider: providerState.selectedProvider,
      refreshBackends: refreshBackendSummaries,
      graphPath: graphRelativePath,
      analyzedFiles,
      totalScanFiles: scanFiles.length,
      nodeCount: finalGraph.nodes.length,
      edgeCount: finalGraph.edges.length,
      layerCount: finalGraph.layers.length,
      tourSteps: finalGraph.tour.length,
      validationIssues: Array.isArray(validation.issues) ? validation.issues : [],
      withLocalState,
      postRefreshSync,
    };
    writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    let committed = false;
    let commitHash = null;
    const shouldCommit =
      Boolean(flags.commit) || parseBoolean(process.env.GRAPH_REFRESH_AUTO_COMMIT, false);
    if (shouldCommit) {
      const commitMessage = String(
        flags['commit-message'] ||
          process.env.GRAPH_REFRESH_COMMIT_MESSAGE ||
          'chore(harness): refresh knowledge graph'
      );

      const graphPaths = [...new Set(refreshBackendSummaries.map(item => item.graphPath).filter(Boolean))];
      const worktreeChanged = runGit(['diff', '--quiet', '--', ...graphPaths], projectRoot, true).status;
      const stagedChanged = runGit(
        ['diff', '--cached', '--quiet', '--', ...graphPaths],
        projectRoot,
        true
      ).status;

      const hasGraphChanges = worktreeChanged === 1 || stagedChanged === 1;
      if (hasGraphChanges) {
        runGit(['commit', '--only', '-m', commitMessage, '--', ...graphPaths], projectRoot);
        committed = true;
        commitHash = runGit(['rev-parse', 'HEAD'], projectRoot).stdout;
      }
    }

    emitRefreshEvent({
      projectRoot,
      configPath,
      providerOverride,
      eventType: 'refresh.success',
      details: { summary, committed, commitHash },
    });
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: true,
          summary,
          committed,
          commitHash,
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    emitRefreshEvent({
      projectRoot,
      configPath,
      providerOverride,
      eventType: 'refresh.fail',
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
      degradationReason: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

main().catch(error => {
  process.stderr.write(
    `${JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )}\n`
  );
  process.exit(1);
});
