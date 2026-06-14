// Attribution & adaptations: see CREDITS.md. Part of the eval harness (self-improving-harness Brief).
/**
 * Sandbox helpers for the eval harness: copy a task fixture into a throwaway temp directory,
 * overlay a "solved" reference state, list files, and read content. Keeping eval runs in a sandbox
 * means a verifier (or an agent under eval) can never mutate the committed fixtures.
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

export function makeSandbox(prefix = 'harness-eval-') {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function removeSandbox(dir) {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
}

/** Copy a directory tree (src must exist). */
export function copyInto(src, dest) {
  if (!existsSync(src)) throw new Error(`copyInto: source missing: ${src}`);
  cpSync(src, dest, { recursive: true });
}

/** Overlay overlayDir's files on top of dest (overwriting collisions). No-op if overlay absent. */
export function applyOverlay(overlayDir, dest) {
  if (!overlayDir || !existsSync(overlayDir)) return false;
  cpSync(overlayDir, dest, { recursive: true });
  return true;
}

/** Recursively list files as POSIX-style relative paths. */
export function listFiles(dir, base = dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      out.push(...listFiles(abs, base));
    } else {
      out.push(relative(base, abs).split('\\').join('/'));
    }
  }
  return out;
}

export function readIfExists(absPath) {
  return existsSync(absPath) ? readFileSync(absPath, 'utf8') : null;
}
