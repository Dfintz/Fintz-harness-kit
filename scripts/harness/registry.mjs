#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { repoRoot } from "./config.mjs";

export const REGISTRY_PATH = join(repoRoot, ".github", "harness", "registry.json");

let cachedRegistry;

export function loadRegistry() {
  if (cachedRegistry) return cachedRegistry;
  if (!existsSync(REGISTRY_PATH)) {
    throw new Error(`missing registry.json at ${REGISTRY_PATH}`);
  }
  try {
    cachedRegistry = JSON.parse(readFileSync(REGISTRY_PATH, "utf8"));
  } catch (error) {
    throw new Error(
      `invalid registry.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return cachedRegistry;
}

export function getStageRecord(stageName, registry = loadRegistry()) {
  return registry.workflow?.stages?.[stageName] ?? null;
}

export function getStageMetadata(stageName, registry = loadRegistry()) {
  return getStageRecord(stageName, registry)?.stageMetadata ?? null;
}

export function getStagePromptPackMetadata(stageName, registry = loadRegistry()) {
  return getStageMetadata(stageName, registry)?.promptPack ?? null;
}

export function getStageContractMetadata(stageName, registry = loadRegistry()) {
  return getStageMetadata(stageName, registry)?.contract ?? null;
}
