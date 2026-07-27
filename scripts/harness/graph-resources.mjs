#!/usr/bin/env node
/**
 * Graph Resources Adapter
 *
 * Converts graph.mjs enumeration API to MCP resource format.
 * Acts as a shim between internal graph module and MCP protocol.
 *
 * Purpose: Direct Node import of graph functions (no npm wrapper overhead).
 * Eliminates ~1000ms subprocess overhead; achieves <100ms latency target.
 *
 * API:
 * - exportGraphLayers() -> [{uri, name, description, mimeType}, ...]
 * - exportGraphNodes(layer) -> [{uri, name, description, mimeType}, ...]
 *
 * Latency Target: <100ms p99 (direct Node import)
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Import graph module (internal; no public export)
 * This is imported directly at module load time (no subprocess)
 */
let graphModule = null;

async function loadGraphModule() {
  if (!graphModule) {
    // Lazy-load graph.mjs module once.
    // This pattern avoids module import overhead at server startup.
    // First call triggers async import; subsequent calls reuse cached module.
    // Direct Node import eliminates ~1000ms subprocess overhead (Phase 2a optimization).
    try {
      graphModule = await import('./graph.mjs');
    } catch (err) {
      console.error('Failed to load graph module:', err.message);
      throw new Error('GRAPH_OFFLINE: graph module unavailable');
    }
  }
  return graphModule;
}

/**
 * Export layers as MCP resources
 * @returns {Promise<Array>} - [{uri, name, description, mimeType}, ...]
 * @throws {Error} - GRAPH_OFFLINE, GRAPH_MALFORMED
 */
export async function exportGraphLayers() {
  try {
    const graph = await loadGraphModule();

    // Call graph.mjs internal layers enumeration
    const layers = graph.listLayers?.() || [];

    // Convert to MCP format
    return layers.map((layer) => ({
      uri: `io.modelcontextprotocol/harness/graph/layers/${layer.name}`,
      name: layer.name,
      description: `Graph layer: ${layer.name} (${layer.nodeCount} nodes)`,
      mimeType: 'application/json',
    }));
  } catch (err) {
    if (err.message.includes('GRAPH_OFFLINE')) throw err;
    throw new Error(`GRAPH_MALFORMED: Failed to export layers: ${err.message}`);
  }
}

/**
 * Export nodes for a specific layer as MCP resources
 * @param {string} layerName - Layer identifier
 * @returns {Promise<Array>} - [{uri, name, description, mimeType}, ...]
 * @throws {Error} - NOT_FOUND, GRAPH_OFFLINE, GRAPH_MALFORMED
 */
export async function exportGraphNodes(layerName) {
  try {
    const graph = await loadGraphModule();

    // Call graph.mjs layer node enumeration
    const nodes = graph.listLayerNodes?.(layerName) || [];

    if (nodes.length === 0) {
      throw new Error(`NOT_FOUND: No nodes in layer ${layerName}`);
    }

    // Convert to MCP format
    return nodes.map((node) => ({
      uri: `io.modelcontextprotocol/harness/graph/nodes/${node.id}`,
      name: node.id,
      description: `Graph node: ${node.id} in layer ${layerName}`,
      mimeType: 'application/json',
    }));
  } catch (err) {
    if (err.message.includes('NOT_FOUND')) throw err;
    if (err.message.includes('GRAPH_OFFLINE')) throw err;
    throw new Error(`GRAPH_MALFORMED: Failed to export nodes: ${err.message}`);
  }
}

/**
 * Validate graph health (optional)
 * @returns {Promise<boolean>} - true if graph is ready
 */
export async function isGraphReady() {
  try {
    const graph = await loadGraphModule();
    return graph.isHealthy?.() ?? true;
  } catch {
    return false;
  }
}

/**
 * Get graph metadata
 * @returns {Promise<Object>} - {timestamp, nodeCount, layerCount, ...}
 */
export async function getGraphMetadata() {
  try {
    const graph = await loadGraphModule();
    return graph.getMetadata?.() ?? { timestamp: new Date().toISOString() };
  } catch (err) {
    throw new Error(`GRAPH_OFFLINE: Failed to get metadata: ${err.message}`);
  }
}
