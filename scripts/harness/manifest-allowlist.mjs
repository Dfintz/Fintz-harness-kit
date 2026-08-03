import { readdirSync } from "node:fs";
import * as nodeFs from "node:fs";
import { join, sep } from "node:path";

function trimTrailingForwardSlashes(value) {
  let text = String(value ?? "");
  while (text.endsWith("/")) {
    text = text.slice(0, -1);
  }
  return text;
}

export function createManifestAllowlist({ rootDir, fail }) {
  const rootInput = String(rootDir ?? "").trim().replaceAll("\\", "/");
  const rootLooksAbsolute = /^[A-Za-z]:\//.test(rootInput) || rootInput.startsWith("/");
  const rootPath = rootInput.replaceAll("/", sep);
  const rootSlash = `${trimTrailingForwardSlashes(rootPath.replaceAll("\\", "/"))}/`;

  function failOrThrow(message) {
    if (typeof fail === "function") {
      fail(message);
    }
    throw new Error(message);
  }

  if (!rootInput || !rootLooksAbsolute) {
    failOrThrow("allowlist rootDir must be an absolute path.");
  }

  function ensureSafeRelativePath(pathValue, label) {
    const normalized = String(pathValue ?? "").trim().replaceAll("\\", "/");
    if (!normalized) {
      failOrThrow(`${label} is required.`);
    }
    if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
      failOrThrow(`${label} must be relative to allowlist root.`);
    }
    if (normalized.includes("\0")) {
      failOrThrow(`${label} contains invalid null-byte path data.`);
    }
    const segments = normalized.split("/");
    for (const segment of segments) {
      if (!segment || segment === "." || segment === "..") {
        failOrThrow(`${label} contains invalid traversal segments.`);
      }
      if (!/^[A-Za-z0-9._ -]+$/.test(segment)) {
        failOrThrow(`${label} contains unsupported path characters.`);
      }
    }
    return segments.join("/");
  }

  function toRelativePath(pathValue, label) {
    const normalized = String(pathValue ?? "").trim().replaceAll("\\", "/");
    if (!normalized) {
      failOrThrow(`${label} is required.`);
    }
    if (normalized.startsWith("/") || /^[A-Za-z]:\//.test(normalized)) {
      const absoluteSlash = trimTrailingForwardSlashes(normalized);
      if (!(absoluteSlash === rootSlash.slice(0, -1) || absoluteSlash.startsWith(rootSlash))) {
        failOrThrow(`${label} must resolve under allowlist root.`);
      }
      const relative = absoluteSlash.slice(rootSlash.length);
      return relative ? ensureSafeRelativePath(relative, label) : "";
    }
    return ensureSafeRelativePath(normalized, label);
  }

  function materializeRelativePath(relativePath, label) {
    const safeRelative = ensureSafeRelativePath(relativePath, label);
    return `${rootSlash}${safeRelative}`.replaceAll("/", sep);
  }

  function buildManifestMap() {
    const map = new Map();
    const queue = [{ absoluteDir: rootPath, relativeDir: "" }];
    while (queue.length > 0) {
      const next = queue.pop();
      const entries = readdirSync(next.absoluteDir, { withFileTypes: true });
      for (const entry of entries) {
        const childRelative = next.relativeDir
          ? `${next.relativeDir}/${entry.name}`
          : entry.name;
        const childAbsolute = join(next.absoluteDir, entry.name);
        if (entry.isDirectory()) {
          queue.push({ absoluteDir: childAbsolute, relativeDir: childRelative });
          continue;
        }
        if (entry.isFile()) {
          map.set(childRelative.replaceAll("\\", "/"), childAbsolute);
        }
      }
    }
    return map;
  }

  function selectRelativePath(relativePath, label) {
    const safeRelative = ensureSafeRelativePath(relativePath, label);
    const selected = buildManifestMap().get(safeRelative);
    if (!selected) {
      failOrThrow(`${label} not found in allowlist manifest: ${safeRelative}`);
    }
    return selected;
  }

  function selectPath(pathValue, label) {
    return selectRelativePath(toRelativePath(pathValue, label), label);
  }

  function readUtf8Relative(relativePath, label) {
    const selectedPath = selectRelativePath(relativePath, label);
    return nodeFs["readFileSync"](selectedPath, "utf8");
  }

  function readUtf8Path(pathValue, label) {
    const selectedPath = selectPath(pathValue, label);
    return nodeFs["readFileSync"](selectedPath, "utf8");
  }

  return {
    rootPath,
    toRelativePath,
    materializeRelativePath,
    selectRelativePath,
    selectPath,
    readUtf8Relative,
    readUtf8Path,
  };
}
