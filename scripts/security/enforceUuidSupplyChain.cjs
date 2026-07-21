const { execSync } = require('node:child_process');
const fs = require('node:fs');

const MIN_UUID_MAJOR = 11;
const ROOT_UUID_DIR = 'node_modules/uuid';
const UUID_REPLACEMENT_TARGETS = [
  'node_modules/xcode/node_modules/uuid',
  'apps/mobile/node_modules/xcode/node_modules/uuid',
  'node_modules/@storybook/addon-actions/node_modules/uuid',
  'frontend/node_modules/@storybook/addon-actions/node_modules/uuid',
];

function parseMajor(version) {
  const major = Number.parseInt(String(version).split('.')[0], 10);
  return Number.isFinite(major) ? major : Number.NaN;
}

function forceUuidTargetsToRootVersion(repoRoot) {
  if (!fs.existsSync(ROOT_UUID_DIR)) {
    throw new Error('[uuid-hardening] Root uuid package directory not found.');
  }

  for (const target of UUID_REPLACEMENT_TARGETS) {
    if (!fs.existsSync(target)) {
      continue;
    }

    fs.rmSync(target, { recursive: true, force: true });
    const targetParent = target.slice(0, target.lastIndexOf('/'));
    fs.mkdirSync(targetParent, { recursive: true });
    fs.cpSync(ROOT_UUID_DIR, target, { recursive: true });

    console.log(`[uuid-hardening] Replaced ${target} with root uuid package.`);
  }
}

function runNpmLsUuidJson(repoRoot) {
  const command = 'npm ls uuid --all --json';

  try {
    return execSync(command, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr || '') : '';
    const stdout =
      error && typeof error === 'object' && 'stdout' in error ? String(error.stdout || '') : '';

    if (stderr && !stderr.includes('ELSPROBLEMS')) {
      throw new Error(`[uuid-hardening] npm ls failed: ${stderr.trim()}`);
    }

    if (stdout.trim().length === 0) {
      throw new Error('[uuid-hardening] npm ls returned no JSON output.');
    }

    return stdout;
  }
}

function collectUuidVersions(tree, versions = []) {
  if (!tree || typeof tree !== 'object') {
    return versions;
  }

  const dependencies = tree.dependencies;
  if (!dependencies || typeof dependencies !== 'object') {
    return versions;
  }

  for (const [name, dependency] of Object.entries(dependencies)) {
    if (name === 'uuid' && dependency && typeof dependency.version === 'string') {
      versions.push(dependency.version);
    }

    collectUuidVersions(dependency, versions);
  }

  return versions;
}

function ensureNoLegacyUuid(repoRoot) {
  const raw = runNpmLsUuidJson(repoRoot);
  const tree = JSON.parse(raw);
  const versions = collectUuidVersions(tree);

  if (versions.length === 0) {
    throw new Error('[uuid-hardening] No installed uuid packages were discovered.');
  }

  const legacy = [...new Set(versions)].filter(version => {
    const major = parseMajor(version);
    return !Number.isNaN(major) && major < MIN_UUID_MAJOR;
  });

  if (legacy.length > 0) {
    throw new Error(
      `[uuid-hardening] Legacy uuid versions detected (<${MIN_UUID_MAJOR}): ${legacy.join(', ')}`
    );
  }

  console.log(
    `[uuid-hardening] Verified ${versions.length} installed uuid package reference(s); all are >= ${MIN_UUID_MAJOR}.`
  );
}

function main() {
  const repoRoot = process.cwd();

  if (!fs.existsSync('node_modules')) {
    console.log('[uuid-hardening] No node_modules directory found. Skipping.');
    return;
  }

  forceUuidTargetsToRootVersion(repoRoot);
  ensureNoLegacyUuid(repoRoot);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}
