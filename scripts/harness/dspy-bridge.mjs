#!/usr/bin/env node
/**
 * dspy-bridge.mjs — Node.js bridge to the DSPy MIPROv2 Python sidecar.
 *
 * Provides the harness-native interface for the DSPy instruction optimizer:
 * - Detects the Python executable
 * - Validates DSPy availability (--check-deps)
 * - Invokes dspy-optimize.py via subprocess
 * - Reports results in harness log format
 *
 * The Python sidecar (scripts/harness/dspy-optimize.py) handles all DSPy calls.
 * This bridge never imports DSPy directly — it is a thin subprocess wrapper.
 *
 * Usage:
 *   node scripts/harness/dspy-bridge.mjs --check-deps
 *   node scripts/harness/dspy-bridge.mjs --optimize --target <path> --eval-set <path> --output <path>
 *   node scripts/harness/dspy-bridge.mjs --self-test
 *
 * Options:
 *   --check-deps          Verify Python 3.10+ and dspy>=2.4 are installed
 *   --optimize            Run dspy-optimize.py with forwarded options
 *   --target <path>       Skill/instruction file to optimize
 *   --eval-set <path>     Routing eval set JSON (forwarded to Python)
 *   --output <path>       Write optimized instruction here
 *   --model <name>        DSPy LM model string (default: ollama_chat/llama3.2)
 *   --api-base <url>      LM API base URL (default: http://localhost:11434)
 *   --max-trials N        MIPROv2 num_trials (default: 10)
 *   --python <path>       Python executable (default: auto-detect python3 / python)
 *   --self-test           Run deterministic validation (no Python or LLM needed)
 *   --help                Show this message
 *
 * Exit codes: 0 success / deps OK, 1 optimization no improvement, 2 error.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIDECAR = join(repoRoot, 'scripts', 'harness', 'dspy-optimize.py');

// ---------- Python detection ----------

const PYTHON_CANDIDATES = ['python3', 'python'];

/**
 * Find the first Python executable that is available on PATH.
 * @returns {string|null} executable name or null
 */
export function detectPython(candidates = PYTHON_CANDIDATES) {
  for (const cmd of candidates) {
    const result = spawnSync(cmd, ['--version'], { encoding: 'utf8', timeout: 5000 });
    if (result.status === 0 && result.stdout?.startsWith('Python ')) {
      return cmd;
    }
  }
  return null;
}

/**
 * Parse "Python X.Y.Z" version string into [major, minor].
 * @param {string} versionOutput  e.g. "Python 3.11.2\n"
 * @returns {[number, number]|null}
 */
export function parsePythonVersion(versionOutput) {
  const match = String(versionOutput).match(/Python\s+(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

// ---------- CLI arg parser ----------

function parseArgs(argv) {
  const args = {
    checkDeps: false,
    optimize: false,
    target: undefined,
    evalSet: undefined,
    output: undefined,
    model: process.env.OLLAMA_MODEL
      ? `ollama_chat/${process.env.OLLAMA_MODEL.split(':')[0]}`
      : 'ollama_chat/qwen2.5',
    apiBase: 'http://localhost:11434',
    maxTrials: 10,
    python: undefined,
    selfTest: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check-deps') args.checkDeps = true;
    else if (a === '--optimize') args.optimize = true;
    else if (a === '--self-test') args.selfTest = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--target') args.target = argv[++i];
    else if (a === '--eval-set') args.evalSet = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--api-base') args.apiBase = argv[++i];
    else if (a === '--max-trials') args.maxTrials = Number(argv[++i]);
    else if (a === '--python') args.python = argv[++i];
    else {
      console.error(`[dspy-bridge] Unknown option: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(
    [
      'Node.js bridge to the DSPy MIPROv2 Python sidecar.',
      '',
      'Usage:',
      '  node scripts/harness/dspy-bridge.mjs --check-deps',
      '  node scripts/harness/dspy-bridge.mjs --optimize --target <path> --eval-set <path> --output <path>',
      '  node scripts/harness/dspy-bridge.mjs --self-test',
      '',
      'Options:',
      '  --check-deps          Verify Python 3.10+ and dspy>=2.4 are installed',
      '  --optimize            Run the DSPy MIPROv2 optimizer',
      '  --target <path>       Skill/instruction file to optimize',
      '  --eval-set <path>     Routing eval set JSON',
      '  --output <path>       Write optimized instruction here',
      '  --model <name>        DSPy LM model (default: ollama_chat/qwen2.5)',
      '  --api-base <url>      LM API base URL (default: http://localhost:11434)',
      '  --max-trials N        MIPROv2 num_trials (default: 10)',
      '  --python <path>       Python executable (default: auto-detect)',
      '  --self-test           Deterministic validation (no Python needed)',
      '',
      'Install Python deps: pip install -r scripts/harness/requirements-dspy.txt',
    ].join('\n')
  );
}

// ---------- subprocess invocation ----------

const SIDECAR_FALLBACK = join(repoRoot, 'scripts', 'harness', 'dspy-optimize-ollama.py');

/**
 * Invoke the Python sidecar with the given arguments.
 * @param {string} python  Python executable
 * @param {string[]} pyArgs  Arguments to pass to dspy-optimize.py
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function invokeSidecar(python, pyArgs) {
  const result = spawnSync(python, [SIDECAR, ...pyArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000, // 10 minutes for a MIPROv2 run
  });
  return {
    status: result.status ?? 2,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

/**
 * Invoke the simplified Ollama-based optimizer as a fallback.
 * Used when full DSPy is unavailable (e.g., due to litellm Rust dependency issues).
 * @param {string} python  Python executable
 * @param {string[]} pyArgs  Arguments to pass to dspy-optimize-ollama.py
 * @returns {{ status: number, stdout: string, stderr: string }}
 */
export function invokeSidecarFallback(python, pyArgs) {
  if (!existsSync(SIDECAR_FALLBACK)) {
    return {
      status: 2,
      stdout: '',
      stderr: '[dspy-bridge] Fallback optimizer not found: ' + SIDECAR_FALLBACK,
    };
  }
  const result = spawnSync(python, [SIDECAR_FALLBACK, ...pyArgs], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
  });
  return {
    status: result.status ?? 2,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

// ---------- self-test ----------

function runSelfTest() {
  const cases = [
    {
      name: 'detectPython: returns string or null (not undefined)',
      run: () => {
        const py = detectPython();
        return py === null || typeof py === 'string';
      },
    },
    {
      name: 'parsePythonVersion: parses "Python 3.11.2"',
      run: () => {
        const v = parsePythonVersion('Python 3.11.2\n');
        return Array.isArray(v) && v[0] === 3 && v[1] === 11;
      },
    },
    {
      name: 'parsePythonVersion: returns null for unrecognised input',
      run: () => parsePythonVersion('not python') === null,
    },
    {
      name: 'parsePythonVersion: parses "Python 3.10.0"',
      run: () => {
        const v = parsePythonVersion('Python 3.10.0');
        return Array.isArray(v) && v[0] === 3 && v[1] === 10;
      },
    },
    {
      name: 'sidecar path: dspy-optimize.py exists in repo',
      run: () => existsSync(SIDECAR),
    },
    {
      name: 'requirements file: requirements-dspy.txt exists',
      run: () => existsSync(join(repoRoot, 'scripts', 'harness', 'requirements-dspy.txt')),
    },
    {
      name: 'invokeSidecar: returns object with status/stdout/stderr keys',
      run: () => {
        // Test with a fake python command that exits immediately
        const r = invokeSidecar('node', ['--version']);
        return (
          typeof r === 'object' &&
          'status' in r &&
          'stdout' in r &&
          'stderr' in r &&
          typeof r.status === 'number'
        );
      },
    },
  ];

  let passed = 0;
  console.log(`[dspy-bridge] Running ${cases.length} self-tests...`);
  for (const c of cases) {
    let ok = false;
    try {
      ok = c.run() === true;
    } catch (e) {
      console.log(`      ${e instanceof Error ? e.message : String(e)}`);
    }
    console.log(`  ${ok ? '✓' : '✗'} ${c.name}`);
    if (ok) passed += 1;
  }
  console.log(`\n[dspy-bridge] ${passed}/${cases.length} self-tests passed`);
  return passed === cases.length ? 0 : 1;
}

// ---------- main ----------

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.selfTest) process.exit(runSelfTest());
  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const python = args.python || detectPython();
  if (!python) {
    console.error('[dspy-bridge] Python not found on PATH. Install Python 3.10+.');
    process.exit(2);
  }

  if (args.checkDeps) {
    console.log(`[dspy-bridge] using Python: ${python}`);
    const { status, stdout, stderr } = invokeSidecar(python, ['--check-deps']);
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    process.exit(status);
  }

  if (args.optimize) {
    if (!args.target || !args.evalSet || !args.output) {
      console.error('[dspy-bridge] --optimize requires --target, --eval-set, and --output');
      process.exit(2);
    }

    const pyArgs = [
      '--target',
      resolve(repoRoot, args.target),
      '--eval-set',
      resolve(repoRoot, args.evalSet),
      '--output',
      resolve(repoRoot, args.output),
      '--model',
      args.model,
      '--api-base',
      args.apiBase,
      '--max-trials',
      String(args.maxTrials),
    ];

    console.log(`[dspy-bridge] invoking dspy-optimize.py (${python})`);
    let { status, stdout, stderr } = invokeSidecar(python, pyArgs);

    // Fallback to simplified Ollama-based optimizer if full DSPy fails with import error
    if (
      status !== 0 &&
      stderr &&
      (stderr.includes('dspy not importable') ||
        stderr.includes('ModuleNotFoundError') ||
        stderr.includes('No module named'))
    ) {
      console.log('[dspy-bridge] Full DSPy unavailable, trying simplified Ollama optimizer...');
      const result = invokeSidecarFallback(python, pyArgs);
      status = result.status;
      stdout = result.stdout;
      stderr = result.stderr;
    }

    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    process.exit(status);
  }

  printHelp();
  process.exit(0);
}

if (
  import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` ||
  process.argv[1]?.endsWith('dspy-bridge.mjs')
) {
  main();
}
