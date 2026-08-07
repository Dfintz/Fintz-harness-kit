#!/usr/bin/env node
/**
 * harness-help — unified help and onboarding guide for the Fintz Harness Kit.
 *
 * Prints a structured overview of all features, commands, and workflows,
 * grouped by use case. Replaces the need to read multiple README sections.
 *
 * Usage:
 *   npm run harness:help
 *   npm run harness:help -- --topic search
 *   npm run harness:help -- --topic modes
 *   npm run harness:help -- --topic loops
 *   npm run harness:help -- --list
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const harnessDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(harnessDir, '..', '..');

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
};

const USE_COLOR = process.stdout.isTTY && process.env.NO_COLOR !== '1';
const c = USE_COLOR ? C : Object.fromEntries(Object.keys(C).map(k => [k, '']));

function h1(text) { return `\n${c.bold}${c.cyan}${'═'.repeat(60)}${c.reset}\n${c.bold}${c.cyan}  ${text}${c.reset}\n${c.bold}${c.cyan}${'═'.repeat(60)}${c.reset}`; }
function h2(text) { return `\n${c.bold}${c.yellow}  ▶ ${text}${c.reset}`; }
function cmd(name, desc) { return `  ${c.green}${name.padEnd(42)}${c.reset}${c.dim}${desc}${c.reset}`; }
function note(text) { return `  ${c.dim}${text}${c.reset}`; }
function example(text) { return `  ${c.blue}$ ${text}${c.reset}`; }
function badge(text, color = 'cyan') { return `${c[color]}[${text}]${c.reset}`; }
function sep() { return `  ${c.dim}${'─'.repeat(58)}${c.reset}`; }

// ---------------------------------------------------------------------------
// Topic definitions
// ---------------------------------------------------------------------------

const TOPICS = {

  quickstart: {
    title: 'Quick Start',
    summary: 'Get up and running in 5 minutes',
    render() {
      return [
        h1('⚡ Quick Start'),
        '',
        '  The harness is a project-agnostic AI agent framework with:',
        '  • 7-stage workflow machine (Understand → Architect → Implement → Review → Feedback)',
        '  • Local LLM support via Ollama (works offline, no API keys needed)',
        '  • Open WebUI integration for browser-based chat',
        '  • File search, document ingestion, and memory system',
        '',
        h2('1. Install prerequisites'),
        example('node --version          # needs ≥ 20'),
        example('npm install             # install harness dependencies'),
        example('npm run harness:health -- --fast   # verify setup'),
        '',
        h2('2. Check your system (Ubuntu only)'),
        example('bash scripts/setup-ubuntu.sh       # hardware discovery + model recommendations'),
        note('  Also detects: Open WebUI, harness proxy, dashboard, HTTP adapter — all ports'),
        example('bash scripts/setup-ubuntu.sh --json  # machine-readable output for automation'),
        '',
        h2('3. Start the chat interface'),
        example('npm run harness:webui:full          # starts Open WebUI + harness proxy'),
        note('Then open http://localhost:3000 in your browser'),
        '',
        h2('4. Use the harness'),
        note('In Open WebUI, type any message. Mode prefixes control depth:'),
        example('/ask: what is the stage machine?    # quick answer'),
        example('/dev: add auth to the API           # code + review'),
        example('/full: redesign the auth workflow   # full 7-stage cycle'),
        '',
        h2('5. Run a convergence loop'),
        example('npm run harness:loop build-fix -- --check-only'),
        '',
        note('Run  npm run harness:help -- --list  to see all topics'),
      ].join('\n');
    },
  },

  modes: {
    title: 'Operating Modes & Mode Prefixes',
    summary: 'assistant / dev / full modes and /ask: /dev: /full: prefixes',
    render() {
      return [
        h1('🎭 Operating Modes'),
        '',
        '  Type a mode prefix at the start of any message in Open WebUI to control',
        '  how deeply the harness processes your request.',
        '',
        h2('Mode prefix cheat sheet'),
        sep(),
        `  ${c.bold}Prefix${c.reset}               ${c.bold}Mode${c.reset}         ${c.bold}Stages${c.reset}                            ${c.bold}Local model${c.reset}`,
        sep(),
        `  ${c.green}/ask: <message>${c.reset}      assistant    implement only                    llama3.1:8b`,
        `  ${c.green}/dev: <message>${c.reset}      coder        understand→implement→review       qwen2.5-coder:14b`,
        `  ${c.green}/code: <message>${c.reset}     coder        (alias for /dev:)                 qwen2.5-coder:14b`,
        `  ${c.green}/full: <message>${c.reset}     feature      all 7 stages, cross-model review  qwen2.5:32b`,
        `  ${c.green}/review: <message>${c.reset}   review       understand + review stages only   qwen2.5:14b`,
        `  ${c.green}/loop:NAME <msg>${c.reset}     any          signals loop intent in context     —`,
        sep(),
        '',
        h2('Named models in Open WebUI'),
        note('Create these in Open WebUI → Admin → Models → Create Model:'),
        '',
        `  ${c.cyan}harness-assistant${c.reset}  Base: llama3.1:8b     System prompt: templates/openwebui/system-prompt-assistant.md`,
        `  ${c.cyan}harness-dev${c.reset}        Base: qwen2.5-coder:14b  System prompt: templates/openwebui/system-prompt-dev.md`,
        `  ${c.cyan}harness-full${c.reset}       Base: qwen2.5:32b     System prompt: templates/openwebui/system-prompt-full.md`,
        '',
        h2('Mode routing from CLI'),
        example('node scripts/harness/prompt-middleware.mjs --task "add auth" --pretty'),
        example('node scripts/harness/prompt-middleware.mjs --task "explain X" --profile assistant'),
        example('npm run harness:proxy:modes    # show all mode→stage mappings'),
      ].join('\n');
    },
  },

  search: {
    title: 'File Search & Document Ingestion',
    summary: 'Index and search files, PDFs, DOCX, XLSX, and images',
    render() {
      return [
        h1('🔍 File Search & Document Ingestion'),
        '',
        h2('Index files for semantic search (requires Ollama + nomic-embed-text)'),
        example('ollama pull nomic-embed-text'),
        example('npm run harness:file-index -- --root /path/to/docs'),
        example('npm run harness:search -- --query "authentication flow" --root .'),
        '',
        h2('Index specific file types'),
        example('npm run harness:file-index -- --root /var/log --ext .log,.txt'),
        example('npm run harness:search -- --query "error handling" --root . --top 5'),
        '',
        h2('Document extraction (PDF, DOCX, XLSX, images)'),
        note('First check what extractors are available on your system:'),
        example('npm run harness:doc:ingest:probe'),
        '',
        note('Install extractors on Ubuntu:'),
        example('sudo apt install poppler-utils libreoffice-common'),
        example('pip3 install python-docx openpyxl'),
        example('ollama pull llava    # for image analysis'),
        '',
        note('Extract and index documents:'),
        example('npm run harness:doc:ingest -- --file report.pdf'),
        example('npm run harness:doc:ingest -- --file spreadsheet.xlsx --json'),
        example('npm run harness:doc:ingest -- --file diagram.png --vision-model llava'),
        '',
        h2('Unified memory search (works without Ollama)'),
        example('npm run harness:memory:search -- --query "approval workflow" --no-vector'),
        example('npm run harness:memory:search -- --query "deployment process"'),
        '',
        h2('Rebuild search indexes'),
        example('npm run harness:vector:rebuild    # rebuild semantic index (needs Ollama)'),
        example('npm run harness:memory:rebuild-links  # rebuild code cross-reference index'),
      ].join('\n');
    },
  },

  loops: {
    title: 'Convergence & Workflow Loops',
    summary: 'Run build-fix, test-fix, tdd-cycle, doc-workflow, and more',
    render() {
      return [
        h1('🔄 Loops'),
        '',
        note('Loops run checks repeatedly until they pass or maxIterations is reached.'),
        '',
        h2('Available loops'),
        sep(),
        cmd('build-fix', 'lint + typecheck + build until green'),
        cmd('test-fix', 'test suite until all pass'),
        cmd('tdd-cycle', 'test-driven development cycle'),
        cmd('ci-green', 'full CI pipeline convergence'),
        cmd('review-fix', 'review findings + fix cycle'),
        cmd('doc-workflow', 'document readability improvement'),
        cmd('feature-cycle', 'full feature workflow'),
        cmd('plan-review', 'architecture plan review'),
        cmd('diagnose', 'root-cause diagnosis loop'),
        cmd('harness-evolve', 'harness self-improvement (experimental)'),
        sep(),
        '',
        h2('Run a loop'),
        example('npm run harness:loops                          # list all loops'),
        example('node scripts/harness/run-loop.mjs build-fix --check-only  # check without agent'),
        '',
        note('With local Ollama agent:'),
        example('node scripts/harness/run-loop.mjs build-fix \\'),
        note('  --agent "node scripts/harness/ollama-agent.mjs --model qwen2.5-coder:14b"'),
        '',
        h2('Document improvement loop'),
        example('npm run harness:doc:verify -- --file README.md   # check readability'),
        example('npm run harness:doc:loop -- --agent "node scripts/harness/ollama-agent.mjs"'),
        '',
        h2('Loop with mode prefix in Open WebUI'),
        note('In Open WebUI chat, type /loop:build-fix to signal loop intent:'),
        example('/loop:build-fix fix the three failing tests'),
      ].join('\n');
    },
  },

  memory: {
    title: 'Memory, Lessons & Ontology',
    summary: 'Save lessons, search memory, manage the knowledge base',
    render() {
      return [
        h1('🧠 Memory, Lessons & Ontology'),
        '',
        h2('Save a new lesson (guided)'),
        example('npm run harness:teach'),
        note('  Interactive prompts → saved as candidate in .github/harness/memory/lessons/'),
        '',
        note('Non-interactive:'),
        example('npm run harness:teach -- --title "npm cache quirk" \\'),
        note('  --context "CI build" --fix "npm cache clean --force" --why "Prevents stale locks"'),
        '',
        h2('Search all memory surfaces'),
        example('npm run harness:memory:search -- --query "approval workflow"'),
        example('npm run harness:memory:search -- --query "Docker setup" --no-vector'),
        '',
        h2('OKF (Open Knowledge Format) migration'),
        example('npm run harness:okf:migrate              # write an approved-manifest preview'),
        example('node scripts/harness/okf-migrate.mjs --apply-manifest <path> --manifest-sha256 <digest>'),
        example('npm run harness:okf:phase0               # audit OKF coverage'),
        '',
        h2('Ontology — concept lookup'),
        example('npm run harness:ontology -- list'),
        example('npm run harness:ontology -- search --query "approval"'),
        example('npm run harness:ontology -- concept --id stage-machine'),
        example('npm run harness:ontology -- related --id memory-system'),
        '',
        h2('Memory curation & maintenance'),
        example('npm run harness:memory:curate            # validate and flag stale entries'),
        example('npm run harness:memory:links             # show memory→code link index'),
        example('npm run harness:memory:rebuild-links     # rebuild link index'),
      ].join('\n');
    },
  },

  webui: {
    title: 'Open WebUI & Chat Interface',
    summary: 'Browser chat with harness routing via Docker',
    render() {
      return [
        h1('💬 Open WebUI — Browser Chat Interface'),
        '',
        note('Open WebUI gives you a ChatGPT-like interface for local Ollama models.'),
        note('The harness proxy automatically injects routing context into every message.'),
        '',
        h2('Start the full stack'),
        example('npm run harness:webui:full          # start proxy + Open WebUI'),
        note('  Then open http://localhost:3000'),
        '',
        h2('Individual services'),
        example('npm run harness:proxy               # harness proxy only (port 11435)'),
        example('npm run harness:proxy:modes         # show mode→profile mapping'),
        example('npm run harness:dashboard           # metrics dashboard (port 8099)'),
        '',
        h2('Harness control panel'),
        note('Live stage progress + approve/reject buttons — no CLI needed:'),
        example('npm run harness:dashboard'),
        note('  Then open http://localhost:8099/control?role=operator'),
        note('  Or http://localhost:8099/control?role=end-user   (approvals only)'),
        '',
        h2('Teams notifications & approvals'),
        example('npm run harness:teams:notify -- stage-complete --dry-run'),
        example('HARNESS_TEAMS_WEBHOOK_URL=https://... npm run harness:teams:notify -- approval-needed'),
        note(''),
        note('For interactive approval buttons in Teams, deploy the bi-directional agent:'),
        example('npm run harness:teams:agent'),
        note('  Requires: HARNESS_TEAMS_BOT_APP_ID, HARNESS_TEAMS_BOT_APP_PASSWORD'),
        note('  See: .github/TEAMS-INTEGRATION.md for Azure Bot Service setup'),
        '',
        h2('Docker compose profiles'),
        example('docker compose -f docker-compose.harness.yml --profile dashboard up -d'),
        example('docker compose -f docker-compose.harness.yml --profile webui up -d'),
        example('npm run harness:webui:down          # stop Open WebUI stack'),
      ].join('\n');
    },
  },

  api: {
    title: 'HTTP API & MCP Server',
    summary: 'REST endpoints for all tools, OpenAPI schema, MCP stdio server',
    render() {
      return [
        h1('🔌 HTTP API & MCP Server'),
        '',
        h2('HTTP adapter — REST access to all 24 MCP tools'),
        example('npm run harness:http                # start API server (port 8100, no auth)'),
        example('HARNESS_API_KEY=secret npm run harness:http   # with authentication'),
        example('npm run harness:http:schema         # print OpenAPI 3.0 schema'),
        '',
        note('Call a tool:'),
        example('curl http://localhost:8100/tools/harness-loops \\'),
        note('  -H "X-Harness-API-Key: your-secret"'),
        '',
        note('Available endpoints:'),
        note('  GET  /tools          — list all tools'),
        note('  POST /tools/:name    — call a tool'),
        note('  GET  /openapi.json   — OpenAPI 3.0 schema'),
        note('  GET  /.well-known/oauth-authorization-server  — OAuth 2.0 stub'),
        '',
        h2('MCP stdio server (VS Code / Claude / Cursor)'),
        example('node scripts/harness/mcp-server.mjs'),
        note('  Registered automatically via .vscode/mcp.json'),
        note('  24 tools: graph, memory, vector, routing, catalog, command dispatch'),
        '',
        h2('Approval workflow via API'),
        example('npm run harness:state -- status'),
        example('npm run harness:state -- approve --decision approved --run-id <id>'),
        example('npm run harness:state -- approvals'),
      ].join('\n');
    },
  },

  stages: {
    title: 'Harness Stage Machine',
    summary: 'The 7-stage workflow: Understand, Architect, Implement, Review, Feedback',
    render() {
      return [
        h1('⚙️  Harness Stage Machine'),
        '',
        note('The harness routes every non-trivial task through up to 7 stages,'),
        note('each with a dedicated model, skill, and review gate.'),
        '',
        h2('Full stage sequence'),
        `  ${c.cyan}1. Understand${c.reset}         — graph-first impact analysis (claude-opus-5)`,
        `  ${c.cyan}2. Architect${c.reset}          — architecture brief + 5 gates (gpt-5.6-sol)`,
        `  ${c.cyan}3. Architect Challenge${c.reset} — independent pressure-test (gpt-5.3-codex)`,
        `  ${c.cyan}4. Implement${c.reset}          — code changes + self-review (gpt-5.4)`,
        `  ${c.cyan}5. Review Breadth${c.reset}     — wide correctness pass (claude-opus-5)`,
        `  ${c.cyan}6. Review Depth${c.reset}       — structural gate review (claude-opus-4-8)`,
        `  ${c.cyan}7. Feedback${c.reset}           — verdict table + brief update (gpt-5.6-sol)`,
        '',
        h2('Route a task'),
        example('node scripts/harness/prompt-router.mjs route --task "add auth" --json'),
        example('node scripts/harness/prompt-router.mjs handoff --task "add auth"'),
        example('npm run harness:route -- --task "refactor login"'),
        '',
        h2('Routing profiles'),
        cmd('feature', 'all 7 stages (default for complex work)'),
        cmd('coder', 'understand → implement → review-breadth'),
        cmd('assistant', 'implement only (one-shot)'),
        cmd('review', 'review stages only'),
        cmd('wayfinder', 'understand + architect (planning only)'),
        '',
        h2('Create a prompt pack for multi-session work'),
        example('npm run harness:prompt-pack -- --profile feature --task "redesign auth"'),
        '',
        h2('Approval gates'),
        example('npm run harness:state -- status           # check active run'),
        example('npm run harness:state -- approve --decision approved --run-id <id>'),
        note('  Or use the control panel: http://localhost:8099/control'),
      ].join('\n');
    },
  },

  install: {
    title: 'Installation & Setup',
    summary: 'System requirements, Ubuntu setup, Ollama models',
    render() {
      const ubuntuScript = existsSync(join(repoRoot, 'scripts', 'setup-ubuntu.sh'));
      return [
        h1('🛠  Installation & Setup'),
        '',
        h2('System requirements'),
        note('  Node.js ≥ 20, npm, git'),
        note('  Docker (optional — for Open WebUI and sidecars)'),
        note('  Ollama (optional — for local LLM inference)'),
        '',
        h2('Quick install'),
        example('git clone https://github.com/Dfintz/Fintz-harness-kit'),
        example('cd Fintz-harness-kit'),
        example('npm install'),
        example('npm run harness:health -- --fast'),
        '',
        h2('Ubuntu setup (recommended for production)'),
        ...(ubuntuScript
          ? [
              note('  Run the discovery script — it detects your hardware and recommends models:'),
              example('bash scripts/setup-ubuntu.sh'),
              '',
              note('  For automated install of all dependencies:'),
              example('bash scripts/setup-ubuntu.sh --install'),
            ]
          : [
              note('  Ubuntu setup script not found — run npm install first'),
            ]
        ),
        '',
        h2('Pull recommended Ollama models'),
        note('  For 50 GB Intel CPU server (see hardware-profile in harness.config.json):'),
        example('ollama pull nomic-embed-text    # embeddings (required for search)'),
        example('ollama pull qwen2.5-coder:14b  # dev/coder mode'),
        example('ollama pull llama3.1:8b        # assistant mode (faster)'),
        example('ollama pull qwen2.5:32b        # full feature mode (best quality)'),
        '',
        h2('Verify everything works'),
        example('npm run harness:health -- --fast'),
        example('npm run harness:graph -- status'),
        example('npm run harness:vector -- status'),
        example('npm run harness:doc:ingest:probe    # check document extractors'),
      ].join('\n');
    },
  },

  knowledge: {
    title: 'Knowledge Graph',
    summary: 'Graph provider, refresh, querying with call-graph edges',
    render() {
      return [
        h1('🗺  Knowledge Graph'),
        '',
        note('The harness uses understand-anything (Tree-sitter AST) to build a committed'),
        note('code graph. LLMs USE the graph but do NOT build it.'),
        '',
        h2('Check graph status'),
        example('npm run harness:graph -- status          # freshness vs HEAD'),
        example('npm run harness:graph -- provider-status # provider configuration'),
        '',
        h2('Refresh the graph (requires understand-anything plugin)'),
        example('export UNDERSTAND_PLUGIN_ROOT=/opt/understand-anything-plugin'),
        example('node scripts/harness/refresh-graph.mjs'),
        note('  Ubuntu: git clone https://github.com/... /opt/understand-anything-plugin'),
        '',
        h2('Graph edge types (after refresh)'),
        note('  contains — file contains function/class'),
        note('  imports  — file imports another file'),
        note('  calls    — function calls another function (INFERRED, import-filtered)'),
        '',
        h2('Query the graph via MCP tools'),
        example('node scripts/harness/mcp-tools.mjs graph-neighbors --node-id "file:src/app.ts"'),
        example('node scripts/harness/mcp-tools.mjs graph-dependents --file-path "src/auth.ts"'),
        example('node scripts/harness/mcp-tools.mjs graph-hubs --top 10'),
      ].join('\n');
    },
  },

};

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const flags = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) { flags._.push(arg); continue; }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) { flags[key] = next; i += 1; } else { flags[key] = true; }
  }
  return flags;
}

function printAllTopics() {
  process.stdout.write(h1('📖 Harness Help — Topic Index') + '\n\n');
  for (const [key, topic] of Object.entries(TOPICS)) {
    process.stdout.write(`  ${c.green}${key.padEnd(14)}${c.reset}${c.bold}${topic.title}${c.reset}\n`);
    process.stdout.write(`  ${' '.repeat(14)}${c.dim}${topic.summary}${c.reset}\n\n`);
  }
  process.stdout.write(note('Usage: npm run harness:help -- --topic <name>') + '\n');
  process.stdout.write(note('       npm run harness:help -- --topic quickstart') + '\n\n');
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.list) {
    printAllTopics();
    return;
  }

  const topicKey = flags.topic || flags._[0];

  if (!topicKey) {
    // Default: show quickstart + topic index
    process.stdout.write(TOPICS.quickstart.render() + '\n');
    process.stdout.write('\n' + h2('All topics') + '\n\n');
    for (const [key, topic] of Object.entries(TOPICS)) {
      process.stdout.write(`  ${c.green}npm run harness:help -- --topic ${key.padEnd(12)}${c.reset}${c.dim}${topic.summary}${c.reset}\n`);
    }
    process.stdout.write('\n');
    return;
  }

  const topic = TOPICS[topicKey];
  if (!topic) {
    process.stderr.write(`[harness:help] Unknown topic: "${topicKey}"\n`);
    process.stderr.write(`Available: ${Object.keys(TOPICS).join(', ')}\n`);
    process.exit(2);
  }

  process.stdout.write(topic.render() + '\n\n');
}

main().catch(err => {
  process.stderr.write(`[harness:help] ${err.message}\n`);
  process.exit(1);
});
