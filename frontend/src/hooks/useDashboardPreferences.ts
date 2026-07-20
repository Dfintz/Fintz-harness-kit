/**
 * useDashboardPreferences — Persists widget layout preferences to localStorage.
 *
 * Tracks:
 *  - Which widgets are visible (hiddenWidgets set)
 *  - Widget display order (ordered array of widgetIds)
 *  - Collapsed state per widget
 *
 * Preferences are keyed per-user so switching accounts doesn't bleed.
 */

import { useAuthStore } from '@/store/authStore';
import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY_PREFIX = 'sc_dashboard_prefs_';

export interface DashboardPreferences {
  /** Set of widget IDs the user has hidden */
  hiddenWidgets: string[];
  /** Ordered list of widget IDs (determines render order) */
  widgetOrder: string[];
  /** Map of widgetId → collapsed state */
  collapsedWidgets: string[];
  /** Ordered list of quick action paths to show (empty = show all defaults) */
  quickActionPaths: string[];
}

const DEFAULT_PREFS: DashboardPreferences = {
  hiddenWidgets: [],
  widgetOrder: [],
  collapsedWidgets: [],
  quickActionPaths: [],
};

function loadPrefs(userId: string): DashboardPreferences {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<DashboardPreferences>;
    return {
      hiddenWidgets: parsed.hiddenWidgets ?? [],
      widgetOrder: parsed.widgetOrder ?? [],
      collapsedWidgets: parsed.collapsedWidgets ?? [],
      quickActionPaths: parsed.quickActionPaths ?? [],
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

function savePrefs(userId: string, prefs: DashboardPreferences): void {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(prefs));
  } catch {
    // Storage full — silently ignore
  }
}

export interface UseDashboardPreferencesReturn {
  prefs: DashboardPreferences;
  /** Check if a widget should be rendered */
  isVisible: (widgetId: string) => boolean;
  /** Hide a widget */
  hideWidget: (widgetId: string) => void;
  /** Show a previously hidden widget */
  showWidget: (widgetId: string) => void;
  /** Toggle widget collapsed state */
  toggleCollapsed: (widgetId: string) => void;
  /** Check if a widget is collapsed */
  isCollapsed: (widgetId: string) => boolean;
  /** Reorder widgets (move widgetId to newIndex). Pass currentWidgetIds to bootstrap order on first reorder. */
  reorderWidget: (widgetId: string, newIndex: number, currentWidgetIds?: string[]) => void;
  /** Reset all preferences to defaults */
  resetPreferences: () => void;
  /** Get the ordered list of visible widgets given a default widget set */
  getOrderedWidgets: <T extends { widgetId: string }>(defaults: T[]) => T[];
  /** All hidden widget IDs (for "Customize" panel) */
  hiddenWidgetIds: string[];
  /** Set the quick action paths the user wants to display */
  setQuickActionPaths: (paths: string[]) => void;
  /** Get the saved quick action paths (empty = show all defaults) */
  quickActionPaths: string[];
}

export function useDashboardPreferences(): UseDashboardPreferencesReturn {
  const userId = useAuthStore(state => state.user?.id) ?? 'anonymous';
  const [prefs, setPrefs] = useState<DashboardPreferences>(() => loadPrefs(userId));

  // Reset preferences when userId changes to prevent preference bleed
  useEffect(() => {
    setPrefs(loadPrefs(userId));
  }, [userId]);

  const persist = useCallback(
    (next: DashboardPreferences) => {
      setPrefs(next);
      savePrefs(userId, next);
    },
    [userId]
  );

  const isVisible = useCallback(
    (widgetId: string) => !prefs.hiddenWidgets.includes(widgetId),
    [prefs.hiddenWidgets]
  );

  const hideWidget = useCallback(
    (widgetId: string) => {
      const next = {
        ...prefs,
        hiddenWidgets: [...new Set([...prefs.hiddenWidgets, widgetId])],
      };
      persist(next);
    },
    [prefs, persist]
  );

  const showWidget = useCallback(
    (widgetId: string) => {
      const next = {
        ...prefs,
        hiddenWidgets: prefs.hiddenWidgets.filter(id => id !== widgetId),
      };
      persist(next);
    },
    [prefs, persist]
  );

  const isCollapsed = useCallback(
    (widgetId: string) => prefs.collapsedWidgets.includes(widgetId),
    [prefs.collapsedWidgets]
  );

  const toggleCollapsed = useCallback(
    (widgetId: string) => {
      const isNowCollapsed = prefs.collapsedWidgets.includes(widgetId);
      const next = {
        ...prefs,
        collapsedWidgets: isNowCollapsed
          ? prefs.collapsedWidgets.filter(id => id !== widgetId)
          : [...prefs.collapsedWidgets, widgetId],
      };
      persist(next);
    },
    [prefs, persist]
  );

  const reorderWidget = useCallback(
    (widgetId: string, newIndex: number, currentWidgetIds?: string[]) => {
      // Bootstrap from current visual order when no persisted order exists
      let order: string[];
      if (prefs.widgetOrder.length > 0) {
        order = [...prefs.widgetOrder];
      } else if (currentWidgetIds) {
        order = [...currentWidgetIds];
      } else {
        order = [];
      }
      const currentIdx = order.indexOf(widgetId);
      if (currentIdx !== -1) {
        order.splice(currentIdx, 1);
      }
      order.splice(newIndex, 0, widgetId);
      persist({ ...prefs, widgetOrder: order });
    },
    [prefs, persist]
  );

  const resetPreferences = useCallback(() => {
    persist({ ...DEFAULT_PREFS });
  }, [persist]);

  const getOrderedWidgets = useCallback(
    <T extends { widgetId: string }>(defaults: T[]): T[] => {
      // Filter out hidden
      const visible = defaults.filter(w => !prefs.hiddenWidgets.includes(w.widgetId));
      // Apply custom order if set
      if (prefs.widgetOrder.length === 0) return visible;
      return visible.sort((a, b) => {
        const ai = prefs.widgetOrder.indexOf(a.widgetId);
        const bi = prefs.widgetOrder.indexOf(b.widgetId);
        // Un-ordered items go to the end
        const aIdx = ai === -1 ? 9999 : ai;
        const bIdx = bi === -1 ? 9999 : bi;
        return aIdx - bIdx;
      });
    },
    [prefs.hiddenWidgets, prefs.widgetOrder]
  );

  const hiddenWidgetIds = useMemo(() => prefs.hiddenWidgets, [prefs.hiddenWidgets]);

  const setQuickActionPaths = useCallback(
    (paths: string[]) => {
      persist({ ...prefs, quickActionPaths: paths });
    },
    [prefs, persist]
  );

  const quickActionPaths = useMemo(() => prefs.quickActionPaths, [prefs.quickActionPaths]);

  return {
    prefs,
    isVisible,
    hideWidget,
    showWidget,
    toggleCollapsed,
    isCollapsed,
    reorderWidget,
    resetPreferences,
    getOrderedWidgets,
    hiddenWidgetIds,
    setQuickActionPaths,
    quickActionPaths,
  };
}
