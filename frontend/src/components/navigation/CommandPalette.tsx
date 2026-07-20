/**
 * Command Palette Component
 *
 * Keyboard-driven command and navigation palette (Cmd/Ctrl+K)
 * Provides quick access to all application features with fuzzy search
 */

import { useGlobalSearchQuery } from '@/hooks/queries/useGlobalSearchQueries';
import { useDebounce } from '@/hooks/useDebounce';
import { usePerformanceMonitor } from '@/hooks/usePerformanceMonitor';
import type { GlobalSearchResult } from '@/services/globalSearchService';
import { selectUser, useAuthStore } from '@/store/authStore';
import { meetsMinOrgRole } from '@/utils/roleUtils';
import { sanitizeImageUrl } from '@/utils/sanitize';
import {
  Groups as FederationIcon,
  Business as OrgIcon,
  Person as PersonIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { Avatar, CircularProgress, Dialog, DialogContent, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCommands } from './commandConfig';
import './CommandPalette.css';
import type { Command } from './types';
import { useNavigationIntentPrefetch } from './useNavigationIntentPrefetch';

interface CommandPaletteProps {
  /** Whether the palette is visible */
  isOpen: boolean;
  /** Callback when palette should close */
  onClose: () => void;
}

/**
 * Get accessible result count message for screen readers.
 */
function getResultCountMessage(count: number, query: string): string {
  if (count > 0) {
    const plural = count === 1 ? '' : 's';
    return `${count} result${plural} found`;
  }
  if (query.trim()) {
    return 'No results found';
  }
  return 'Enter text to search';
}

/**
 * Build accessible aria-label for a command item.
 */
function getCommandAriaLabel(cmd: Command): string {
  const base = `${cmd.label}. ${cmd.description}`;
  if (cmd.shortcut) {
    return `${base}. Shortcut: ${cmd.shortcut}`;
  }
  return base;
}

/** Icon for global search result types */
function getResultTypeIcon(type: GlobalSearchResult['type']): React.ReactElement {
  switch (type) {
    case 'organization':
      return <OrgIcon fontSize="small" />;
    case 'federation':
      return <FederationIcon fontSize="small" />;
    case 'user':
      return <PersonIcon fontSize="small" />;
  }
}

/** Label for global search result types */
function getResultTypeLabel(type: GlobalSearchResult['type']): string {
  switch (type) {
    case 'organization':
      return 'Organization';
    case 'federation':
      return 'Federation';
    case 'user':
      return 'User';
  }
}

const CommandPaletteBase: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const theme = useTheme();
  const user = useAuthStore(selectUser);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const organizationId = user?.activeOrgId || user?.organizationId;

  // Debounce query for API call
  const debouncedQuery = useDebounce(query, 300);

  // Performance monitoring in development
  usePerformanceMonitor('CommandPalette');

  // Get command search results, filtered by user permissions
  const results = useMemo(() => {
    const hasOrg = !!organizationId;
    const isAdmin = user?.role === 'admin';

    return searchCommands(query).filter(cmd => {
      if (cmd.adminOnly && !isAdmin) return false;
      if (cmd.requiresOrg && !hasOrg) return false;
      if (cmd.minRole && !isAdmin && !meetsMinOrgRole(user?.orgRole, cmd.minRole)) return false;
      return true;
    });
  }, [query, organizationId, user]);

  const prefetchCommandPath = useNavigationIntentPrefetch(organizationId);

  // Global search for organizations, federations, and users
  const { data: globalResults, isLoading: isGlobalSearchLoading } =
    useGlobalSearchQuery(debouncedQuery);

  // Total selectable items (commands + global results)
  const totalItems = results.length + (globalResults?.length ?? 0);

  // Group results by category
  const groupedResults = useMemo(() => {
    const groups = new Map<Command['category'], Command[]>();
    for (const cmd of results) {
      if (!groups.has(cmd.category)) {
        groups.set(cmd.category, []);
      }
      groups.get(cmd.category)!.push(cmd);
    }
    return groups;
  }, [results]);

  const sortedCategories = useMemo(() => {
    const categoryOrder: Record<Command['category'], number> = {
      dashboard: 1,
      ops: 2,
      organization: 3,
      alliance: 4,
      community: 5,
      tools: 6,
      help: 7,
    };

    return Array.from(groupedResults.keys()).sort((a, b) => categoryOrder[a] - categoryOrder[b]);
  }, [groupedResults]);

  const groupedCommandRows = useMemo(() => {
    let globalIndex = 0;

    return sortedCategories.map(category => {
      const items = groupedResults.get(category) || [];
      const rows = items.map(cmd => {
        const row = {
          cmd,
          globalIndex,
        };
        globalIndex += 1;
        return row;
      });

      return { category, rows };
    });
  }, [groupedResults, sortedCategories]);

  // Focus input when palette opens
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    // Small delay to ensure dialog is rendered.
    const focusTimer = globalThis.setTimeout(() => inputRef.current?.focus(), 50);
    setQuery('');
    setSelectedIndex(0);

    return () => {
      globalThis.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  // Scroll selected item into view (memoized)
  const scrollToSelected = useCallback(() => {
    if (listRef.current) {
      const items = listRef.current.querySelectorAll('.command-palette__item');
      if (items[selectedIndex]) {
        items[selectedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    scrollToSelected();
  }, [isOpen, selectedIndex, scrollToSelected]);

  useEffect(() => {
    if (selectedIndex < 0 || selectedIndex >= results.length) {
      return;
    }

    prefetchCommandPath(results[selectedIndex]?.path);
  }, [selectedIndex, results, prefetchCommandPath]);

  // Execute selected command (memoized)
  const executeCommand = useCallback(
    (cmd: Command) => {
      if (cmd.action) {
        cmd.action();
      }
      if (cmd.path) {
        navigate(cmd.path);
      }
      onClose();
    },
    [navigate, onClose]
  );

  // Navigate to a global search result
  const navigateToResult = useCallback(
    (result: GlobalSearchResult) => {
      navigate(result.url);
      onClose();
    },
    [navigate, onClose]
  );

  // Handle keyboard navigation (memoized)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, Math.max(totalItems - 1, 0)));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;

        case 'Enter':
          e.preventDefault();
          if (selectedIndex < results.length) {
            // It's a command
            if (results[selectedIndex]) {
              executeCommand(results[selectedIndex]);
            }
          } else {
            // It's a global result
            const globalIdx = selectedIndex - results.length;
            if (globalResults?.[globalIdx]) {
              navigateToResult(globalResults[globalIdx]);
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          onClose();
          break;

        default:
          break;
      }
    },
    [results, selectedIndex, executeCommand, navigateToResult, globalResults, onClose, totalItems]
  );

  // Handle mouse enter to update selected index (memoized)
  const handleMouseEnter = useCallback(
    (index: number, cmd?: Command) => {
      setSelectedIndex(index);
      prefetchCommandPath(cmd?.path);
    },
    [prefetchCommandPath]
  );

  // Handle item click (memoized)
  const handleItemClick = useCallback(
    (cmd: Command) => {
      executeCommand(cmd);
    },
    [executeCommand]
  );

  if (!isOpen) return null;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      className="command-palette-dialog"
      aria-labelledby="command-palette-title"
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            maxHeight: '80vh',
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <div className="command-palette">
          <h2 id="command-palette-title" className="sr-only">
            Command Palette
          </h2>
          {/* Search Input */}
          <div className="command-palette__input-wrapper">
            <SearchIcon
              className="command-palette__search-icon"
              aria-hidden="true"
              fontSize="small"
            />
            <input
              ref={inputRef}
              type="text"
              className="command-palette__input"
              placeholder="Search organizations, federations, and users..."
              value={query}
              onChange={e => {
                setQuery(e.currentTarget.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              aria-label="Search organizations, federations, and users"
              aria-autocomplete="list"
              aria-controls="command-palette-results"
            />
            <span className="command-palette__hint" aria-label="Press Escape to close">
              ESC
            </span>
          </div>

          {/* Screen reader announcement for result count */}
          <output className="sr-only" aria-live="polite" aria-atomic="true">
            {getResultCountMessage(totalItems, query)}
          </output>

          {/* Results */}
          <div className="command-palette__results" ref={listRef} id="command-palette-results">
            {results.length === 0 ? (
              <div className="command-palette__empty">
                <Typography variant="body1" color="text.secondary">
                  {query.trim() ? 'No results found' : 'Start typing to search...'}
                </Typography>
              </div>
            ) : (
              <>
                {groupedCommandRows.map((group, catIdx) => {
                  return (
                    <div key={group.category} className="command-palette__category">
                      {sortedCategories.length > 1 && (
                        <div className="command-palette__category-label">
                          {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
                        </div>
                      )}
                      {group.rows.map(({ cmd, globalIndex }) => {
                        const isSelected = selectedIndex === globalIndex;

                        return (
                          <button
                            type="button"
                            key={cmd.id}
                            className={`command-palette__item ${isSelected ? 'command-palette__item--selected' : ''}`}
                            onMouseEnter={() => handleMouseEnter(globalIndex, cmd)}
                            onClick={() => handleItemClick(cmd)}
                            aria-label={getCommandAriaLabel(cmd)}
                            tabIndex={-1}
                          >
                            <div className="command-palette__item-content">
                              <div className="command-palette__item-label">{cmd.label}</div>
                              <div className="command-palette__item-description">
                                {cmd.description}
                              </div>
                            </div>
                            {cmd.shortcut && (
                              <div className="command-palette__item-shortcut">{cmd.shortcut}</div>
                            )}
                          </button>
                        );
                      })}
                      {catIdx < sortedCategories.length - 1 && (
                        <div className="command-palette__divider" />
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Global Search Results ── */}
            {debouncedQuery.trim().length >= 2 && (
              <>
                <div className="command-palette__divider" />
                <div className="command-palette__category">
                  <div className="command-palette__category-label">
                    Search Results
                    {isGlobalSearchLoading && <CircularProgress size={12} sx={{ ml: 1 }} />}
                  </div>
                  {!isGlobalSearchLoading && (!globalResults || globalResults.length === 0) && (
                    <div className="command-palette__empty command-palette__empty--compact">
                      <Typography variant="body2" color="text.secondary">
                        No organizations, federations, or users found
                      </Typography>
                    </div>
                  )}
                  {globalResults?.map((result, idx) => {
                    const globalIndex = results.length + idx;
                    const isSelected = selectedIndex === globalIndex;

                    return (
                      <button
                        type="button"
                        key={`global-${result.type}-${result.id}`}
                        className={`command-palette__item ${isSelected ? 'command-palette__item--selected' : ''}`}
                        onMouseEnter={() => handleMouseEnter(globalIndex)}
                        onClick={() => navigateToResult(result)}
                        aria-label={`${getResultTypeLabel(result.type)}: ${result.title}`}
                        tabIndex={-1}
                      >
                        <div className="command-palette__result-row">
                          <Avatar
                            src={sanitizeImageUrl(result.avatarUrl) || undefined}
                            alt={result.title}
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: alpha(theme.palette.primary.main, 0.2),
                              color: theme.palette.primary.main,
                              fontSize: '0.85rem',
                            }}
                          >
                            {!result.avatarUrl && getResultTypeIcon(result.type)}
                          </Avatar>
                          <div className="command-palette__item-content">
                            <div className="command-palette__item-label">{result.title}</div>
                            {result.subtitle && (
                              <div className="command-palette__item-description">
                                {result.subtitle}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="command-palette__item-shortcut command-palette__type-badge">
                          {getResultTypeLabel(result.type)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer Tips */}
          {totalItems > 0 && (
            <div className="command-palette__footer">
              <div className="command-palette__hint-group">
                <kbd className="command-palette__kbd" aria-label="Up and down arrows to navigate">
                  ↑↓
                </kbd>
                <span className="command-palette__hint-text">Navigate</span>
              </div>
              <div className="command-palette__hint-group">
                <kbd className="command-palette__kbd" aria-label="Return key to select">
                  Return
                </kbd>
                <span className="command-palette__hint-text">Select</span>
              </div>
              <div className="command-palette__hint-group">
                <kbd className="command-palette__kbd" aria-label="Escape key to close">
                  Esc
                </kbd>
                <span className="command-palette__hint-text">Close</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Memoize component to prevent unnecessary re-renders
export const CommandPalette = React.memo(CommandPaletteBase);
