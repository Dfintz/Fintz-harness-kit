/**
 * Command Palette Configuration
 *
 * Maps all application routes, features, and actions to searchable commands
 * Supports fuzzy search, categorization, and keyboard shortcuts
 */

import type { Command, HubId } from './types';

import { generateCommandConfig } from './configGenerators';
import { routeRegistry } from './navigationRegistry';
/**
 * All available commands in the application
 * Organized by category and hub
 *
 * NOTE: Commands are now auto-generated from navigationRegistry
 * This ensures single source of truth for application routes.
 * To add a new command, just add a route entry to navigationRegistry.ts
 */
export const commands: Command[] = generateCommandConfig(routeRegistry);

const CATEGORY_SORT_ORDER: Array<Command['category']> = [
  'dashboard',
  'ops',
  'organization',
  'alliance',
  'community',
  'tools',
  'help',
];

const SEARCH_CACHE_LIMIT = 100;
const searchCache = new Map<string, Command[]>();

function sortCommandsByCategoryAndOrder(commandList: Command[]): Command[] {
  return [...commandList].sort((a, b) => {
    const catA = CATEGORY_SORT_ORDER.indexOf(a.category);
    const catB = CATEGORY_SORT_ORDER.indexOf(b.category);
    if (catA !== catB) {
      return catA - catB;
    }

    return (a.order || 0) - (b.order || 0);
  });
}

const sortedCommands = sortCommandsByCategoryAndOrder(commands);

function getCachedSearchResult(cacheKey: string): Command[] | null {
  const cached = searchCache.get(cacheKey);
  return cached ?? null;
}

function setCachedSearchResult(cacheKey: string, result: Command[]): void {
  searchCache.set(cacheKey, result);
  if (searchCache.size <= SEARCH_CACHE_LIMIT) {
    return;
  }

  const oldestKey = searchCache.keys().next().value;
  if (oldestKey) {
    searchCache.delete(oldestKey);
  }
}

function getDefaultSortedResults(category?: Command['category'], limit?: number): Command[] {
  const filtered = category
    ? sortedCommands.filter(cmd => cmd.category === category)
    : sortedCommands;
  return limit ? filtered.slice(0, limit) : filtered;
}

function scoreCommandForQuery(normalizedQuery: string, command: Command): number {
  const labelScore = fuzzyMatch(normalizedQuery, command.label);
  const descScore = fuzzyMatch(normalizedQuery, command.description) * 0.7;

  let keywordScore = 0;
  if (command.keywords) {
    for (const keyword of command.keywords) {
      const score = fuzzyMatch(normalizedQuery, keyword) * 0.8;
      keywordScore = Math.max(keywordScore, score);
    }
  }

  return Math.max(labelScore, descScore, keywordScore);
}

function searchScoredCommands(
  normalizedQuery: string,
  category?: Command['category']
): Array<{ command: Command; score: number }> {
  const results: Array<{ command: Command; score: number }> = [];

  for (const command of commands) {
    if (category && command.category !== category) {
      continue;
    }

    const totalScore = scoreCommandForQuery(normalizedQuery, command);
    if (totalScore > 0) {
      results.push({ command, score: totalScore });
    }
  }

  return results;
}
/**
 * Fuzzy search implementation - simple but effective
 * Matches substring at word boundaries with progressive scoring
 *
 * @param query - User's search query
 * @param text - Text to search in
 * @returns Match score (0 = no match, higher = better match)
 */
function fuzzyMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();

  if (q === t) return 1000; // Exact match
  if (t.startsWith(q)) return 500; // Prefix match
  if (t.includes(q)) return 300; // Substring match

  // Progressive character matching with distance penalty
  let matchScore = 0;
  let lastIndex = 0;
  for (const char of q) {
    const index = t.indexOf(char, lastIndex);
    if (index === -1) return 0; // Character not found
    matchScore += 10 - (index - lastIndex); // Penalty for distance
    lastIndex = index + 1;
  }

  return matchScore;
}

/**
 * Search commands based on user query
 *
 * @param query - Search query
 * @param options - Search options
 * @returns Sorted list of matching commands
 */
export function searchCommands(
  query: string,
  options?: {
    category?: Command['category'];
    limit?: number;
  }
): Command[] {
  const normalizedQuery = query.trim();
  const category = options?.category;
  const limit = options?.limit;

  if (!normalizedQuery) {
    return getDefaultSortedResults(category, limit);
  }

  const cacheKey = `${normalizedQuery.toLowerCase()}|${category ?? 'all'}|${limit ?? 10}`;
  const cached = getCachedSearchResult(cacheKey);
  if (cached) {
    return cached;
  }

  const results = searchScoredCommands(normalizedQuery, category);

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  // Return top results
  const result = results.slice(0, limit || 10).map(r => r.command);
  setCachedSearchResult(cacheKey, result);
  return result;
}

/**
 * Get commands by category
 */
export function getCommandsByCategory(category: Command['category']): Command[] {
  return sortedCommands.filter(cmd => cmd.category === category);
}

/**
 * Get all unique categories
 */
export function getCategories(): Command['category'][] {
  const categories = new Set(commands.map(c => c.category));
  return Array.from(categories);
}

/**
 * Hub number key mapping (1-4 for quick navigation)
 * Maps number keys to hub paths for one-key navigation
 */
export const hubNumberKeyMap: Record<
  '1' | '2' | '3' | '4',
  { hubId: HubId; path: string; label: string }
> = {
  '1': { hubId: 'dashboard', path: '/dashboard', label: 'Dashboard (1)' },
  '2': { hubId: 'ops', path: '/activities', label: 'Ops Center (2)' },
  '3': { hubId: 'alliance', path: '/federation', label: 'Alliance (3)' },
  '4': { hubId: 'community', path: '/directories', label: 'Community (4)' },
};

/**
 * Get hub navigation shortcut for a number key
 * Returns the hub configuration if the key is valid (1-4)
 */
export function getHubShortcut(numberKey: string): (typeof hubNumberKeyMap)['1'] | null {
  const key = numberKey as keyof typeof hubNumberKeyMap;
  return hubNumberKeyMap[key] || null;
}
