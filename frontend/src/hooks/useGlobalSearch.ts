import { logger } from '@/utils/logger';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from './useDebounce';

/**
 * Global Search Hook with Cmd+K support
 * Issue #160: Global Search - Cross-feature search with Cmd+K
 */

export interface SearchResult {
  id: string;
  type: 'fleet' | 'ship' | 'member' | 'activity' | 'organization' | 'route' | 'page';
  title: string;
  subtitle?: string;
  icon?: string;
  url?: string;
  action?: () => void;
  metadata?: Record<string, unknown>;
}

export interface SearchCategory {
  id: string;
  label: string;
  icon?: string;
  results: SearchResult[];
}

export interface GlobalSearchConfig {
  placeholder?: string;
  debounceMs?: number;
  maxResults?: number;
  searchFn?: (query: string) => Promise<SearchResult[]>;
  shortcuts?: SearchShortcut[];
}

export interface SearchShortcut {
  key: string;
  label: string;
  action: () => void;
}

interface GlobalSearchState {
  isOpen: boolean;
  query: string;
  debouncedQuery: string;
  results: SearchResult[];
  categories: SearchCategory[];
  isLoading: boolean;
  selectedIndex: number;
  recentSearches: string[];
}

function navigateToInternalPath(path: string): void {
  // Only allow true relative app paths (single leading slash, not //).
  if (!/^\/(?!\/)/.test(path)) {
    return;
  }

  globalThis.history.pushState({}, '', path);
  const popStateEvent =
    typeof PopStateEvent === 'function' ? new PopStateEvent('popstate') : new Event('popstate');
  globalThis.dispatchEvent(popStateEvent);
}

const DEFAULT_SHORTCUTS: SearchShortcut[] = [
  { key: 'f', label: 'Go to Fleet', action: () => navigateToInternalPath('/fleet') },
  { key: 's', label: 'Go to Ships', action: () => navigateToInternalPath('/fleet/ships') },
  { key: 'a', label: 'Go to Activities', action: () => navigateToInternalPath('/activities') },
  { key: 't', label: 'Go to Trading', action: () => navigateToInternalPath('/trading') },
  { key: 'd', label: 'Go to Dashboard', action: () => navigateToInternalPath('/dashboard') },
];

const RECENT_SEARCHES_KEY = 'global-search-recent';
const MAX_RECENT_SEARCHES = 5;

/**
 * Global search hook with keyboard navigation and Cmd+K activation
 */
export function useGlobalSearch(config: GlobalSearchConfig = {}) {
  const {
    placeholder = 'Search everything...',
    debounceMs = 300,
    maxResults = 10,
    searchFn,
    shortcuts = DEFAULT_SHORTCUTS,
  } = config;

  const [state, setState] = useState<GlobalSearchState>({
    isOpen: false,
    query: '',
    debouncedQuery: '',
    results: [],
    categories: [],
    isLoading: false,
    selectedIndex: 0,
    recentSearches: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<() => void>(() => undefined);
  const selectResultRef = useRef<(result: SearchResult) => void>(() => undefined);
  const debouncedQuery = useDebounce(state.query, debounceMs);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (saved) {
        setState(prev => ({ ...prev, recentSearches: JSON.parse(saved) }));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const setQuery = useCallback((query: string) => {
    setState(prev => ({ ...prev, query, selectedIndex: 0 }));
  }, []);

  const open = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: true }));
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      query: '',
      results: [],
      categories: [],
      selectedIndex: 0,
    }));
  }, []);

  const selectResult = useCallback(
    (result: SearchResult) => {
      // Save to recent searches
      setState(prev => {
        const newRecent = [
          result.title,
          ...prev.recentSearches.filter(r => r !== result.title),
        ].slice(0, MAX_RECENT_SEARCHES);

        try {
          localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(newRecent));
        } catch {
          // Ignore localStorage errors
        }

        return { ...prev, recentSearches: newRecent };
      });

      // Execute action or navigate
      if (result.action) {
        result.action();
      } else if (result.url) {
        navigateToInternalPath(result.url);
      }

      close();
    },
    [close]
  );

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    selectResultRef.current = selectResult;
  }, [selectResult]);

  // Handle Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setState(prev => ({ ...prev, isOpen: true }));
        setTimeout(() => inputRef.current?.focus(), 0);
        return;
      }

      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        e.preventDefault();
        closeRef.current();
        return;
      }

      // Shortcut handling when search is open with Cmd/Ctrl held
      if (state.isOpen && (e.metaKey || e.ctrlKey)) {
        const shortcut = shortcuts.find(s => s.key === e.key.toLowerCase());
        if (shortcut) {
          e.preventDefault();
          shortcut.action();
          closeRef.current();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, state.isOpen]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setState(prev => ({
        ...prev,
        debouncedQuery,
        results: [],
        categories: [],
        isLoading: false,
      }));
      return;
    }

    const performSearch = async () => {
      setState(prev => ({ ...prev, isLoading: true }));

      try {
        let results: SearchResult[] = [];

        if (searchFn) {
          results = await searchFn(debouncedQuery);
        } else {
          // Default mock search - replace with actual API call
          results = getDefaultSearchResults(debouncedQuery);
        }

        // Limit results
        results = results.slice(0, maxResults);

        // Group results by type
        const categories = groupResultsByType(results);

        setState(prev => ({
          ...prev,
          debouncedQuery,
          results,
          categories,
          isLoading: false,
          selectedIndex: 0,
        }));
      } catch (error) {
        logger.error('Search error:', error instanceof Error ? error : new Error(String(error)));
        setState(prev => ({
          ...prev,
          results: [],
          categories: [],
          isLoading: false,
        }));
      }
    };

    performSearch();
  }, [debouncedQuery, maxResults, searchFn]);

  // Keyboard navigation
  useEffect(() => {
    if (!state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const totalResults = state.results.length;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setState(prev => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % Math.max(totalResults, 1),
          }));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setState(prev => ({
            ...prev,
            selectedIndex:
              (prev.selectedIndex - 1 + Math.max(totalResults, 1)) % Math.max(totalResults, 1),
          }));
          break;
        case 'Enter':
          e.preventDefault();
          if (state.results[state.selectedIndex]) {
            selectResultRef.current(state.results[state.selectedIndex]);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.isOpen, state.results, state.selectedIndex]);

  const clearRecentSearches = useCallback(() => {
    setState(prev => ({ ...prev, recentSearches: [] }));
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  return {
    // State
    isOpen: state.isOpen,
    query: state.query,
    results: state.results,
    categories: state.categories,
    isLoading: state.isLoading,
    selectedIndex: state.selectedIndex,
    recentSearches: state.recentSearches,
    // Actions
    setQuery,
    open,
    close,
    selectResult,
    clearRecentSearches,
    // Config
    placeholder,
    shortcuts,
    // Ref
    inputRef,
  };
}

// Helper functions

function getDefaultSearchResults(query: string): SearchResult[] {
  // Default mock results - replace with actual search implementation
  const lowerQuery = query.toLowerCase();
  const results: SearchResult[] = [];

  // Pages
  const pages = [
    { id: 'dashboard', title: 'Dashboard', url: '/dashboard' },
    { id: 'fleet', title: 'Fleet Management', url: '/fleet' },
    { id: 'ships', title: 'Ships', url: '/fleet/ships' },
    { id: 'activities', title: 'Activities', url: '/activities' },
    { id: 'trading', title: 'Trading', url: '/trading' },
    { id: 'calendar', title: 'Calendar', url: '/activities?tab=calendar' },
    { id: 'settings', title: 'Settings', url: '/settings' },
    { id: 'profile', title: 'Profile', url: '/profile' },
  ];

  pages.forEach(page => {
    if (page.title.toLowerCase().includes(lowerQuery)) {
      results.push({
        id: page.id,
        type: 'page',
        title: page.title,
        subtitle: 'Navigate to page',
        url: page.url,
      });
    }
  });

  return results;
}

function groupResultsByType(results: SearchResult[]): SearchCategory[] {
  const groups: Record<string, SearchResult[]> = {};

  results.forEach(result => {
    if (!groups[result.type]) {
      groups[result.type] = [];
    }
    groups[result.type].push(result);
  });

  const typeLabels: Record<string, string> = {
    page: 'Pages',
    fleet: 'Fleets',
    ship: 'Ships',
    member: 'Members',
    activity: 'Activities',
    organization: 'Organizations',
    route: 'Trading Routes',
  };

  return Object.entries(groups).map(([type, items]) => ({
    id: type,
    label: typeLabels[type] || type,
    results: items,
  }));
}
