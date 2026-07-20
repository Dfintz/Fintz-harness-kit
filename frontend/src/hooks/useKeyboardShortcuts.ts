import { useEffect, useCallback, useRef } from 'react';
import { logger } from '@/utils/logger';
import _Refresh from '@mui/icons-material/Refresh';

/**
 * Keyboard shortcut definition
 */
interface KeyboardShortcut {
    key: string;
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    description: string;
    action: () => void;
}

/**
 * Options for keyboard shortcuts hook
 */
interface UseKeyboardShortcutsOptions {
    enabled?: boolean;
    preventDefault?: boolean;
    ignoreInputs?: boolean;
}

/**
 * Hook for managing keyboard shortcuts
 * 
 * @param shortcuts - Array of keyboard shortcut definitions
 * @param options - Configuration options
 * @returns Object with methods to add/remove shortcuts
 * 
 * @example
 * ```tsx
 * useKeyboardShortcuts([
 *   { key: 'k', ctrl: true, description: 'Search', action: () => openSearch() },
 *   { key: 'Escape', description: 'Close modal', action: () => closeModal() },
 * ]);
 * ```
 */
export const useKeyboardShortcuts = (
    shortcuts: KeyboardShortcut[],
    options: UseKeyboardShortcutsOptions = {}
) => {
    const {
        enabled = true,
        preventDefault = true,
        ignoreInputs = true,
    } = options;

    const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);

    // Update ref when shortcuts change
    useEffect(() => {
        shortcutsRef.current = shortcuts;
    }, [shortcuts]);

    const handleKeyDown = useCallback((event: KeyboardEvent) => {
        if (!enabled) return;

        // Ignore if focus is in an input field
        if (ignoreInputs) {
            const target = event.target as HTMLElement;
            // Ensure target has tagName before accessing it
            if (target && target.tagName) {
                const tagName = target.tagName.toLowerCase();
                if (
                    tagName === 'input' ||
                    tagName === 'textarea' ||
                    tagName === 'select' ||
                    target.isContentEditable
                ) {
                    return;
                }
            }
        }

        for (const shortcut of shortcutsRef.current) {
            const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
            
            // Helper function to check modifier match
            const modifierMatches = (required: boolean | undefined, pressed: boolean): boolean => {
                // If explicitly required (true), must be pressed
                // If explicitly not required (false), must not be pressed
                // If undefined (not specified), don't care about the state
                if (required === true) return pressed;
                if (required === false) return !pressed;
                return true; // undefined means we don't care
            };
            
            // Check all modifiers - Ctrl/Meta are treated as equivalent on Mac
            const ctrlOrMeta = event.ctrlKey || event.metaKey;
            const ctrlMatches = modifierMatches(shortcut.ctrl, ctrlOrMeta);
            const altMatches = modifierMatches(shortcut.alt, event.altKey);
            const shiftMatches = modifierMatches(shortcut.shift, event.shiftKey);

            if (keyMatches && ctrlMatches && altMatches && shiftMatches) {
                if (preventDefault) {
                    event.preventDefault();
                }
                shortcut.action();
                break;
            }
        }
    }, [enabled, preventDefault, ignoreInputs]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Return helper functions
    return {
        /**
         * Get all registered shortcuts
         */
        getShortcuts: () => shortcutsRef.current,
        
        /**
         * Format shortcut key combination for display
         */
        formatShortcut: (shortcut: KeyboardShortcut): string => {
            const parts: string[] = [];
            if (shortcut.ctrl) parts.push('Ctrl');
            if (shortcut.alt) parts.push('Alt');
            if (shortcut.shift) parts.push('Shift');
            if (shortcut.meta) parts.push('⌘');
            parts.push(shortcut.key.toUpperCase());
            return parts.join(' + ');
        },
    };
};

/**
 * Common keyboard shortcuts for the application
 */
export const commonShortcuts = {
    search: (action: () => void): KeyboardShortcut => ({
        key: 'k',
        ctrl: true,
        description: 'Open search',
        action,
    }),
    escape: (action: () => void): KeyboardShortcut => ({
        key: 'Escape',
        description: 'Close/Cancel',
        action,
    }),
    save: (action: () => void): KeyboardShortcut => ({
        key: 's',
        ctrl: true,
        description: 'Save',
        action,
    }),
    newItem: (action: () => void): KeyboardShortcut => ({
        key: 'n',
        ctrl: true,
        description: 'New item',
        action,
    }),
    delete: (action: () => void): KeyboardShortcut => ({
        key: 'Delete',
        description: 'Delete',
        action,
    }),
    refresh: (action: () => void): KeyboardShortcut => ({
        key: 'r',
        ctrl: true,
        description: 'Refresh',
        action,
    }),
    help: (action: () => void): KeyboardShortcut => ({
        key: '?',
        shift: true,
        description: 'Show keyboard shortcuts',
        action,
    }),
    goHome: (action: () => void): KeyboardShortcut => ({
        key: 'h',
        alt: true,
        description: 'Go to dashboard',
        action,
    }),
    goFleet: (action: () => void): KeyboardShortcut => ({
        key: 'f',
        alt: true,
        description: 'Go to fleet',
        action,
    }),
    goCalendar: (action: () => void): KeyboardShortcut => ({
        key: 'c',
        alt: true,
        description: 'Go to calendar',
        action,
    }),
    goTrading: (action: () => void): KeyboardShortcut => ({
        key: 't',
        alt: true,
        description: 'Go to trading',
        action,
    }),
    toggleSidebar: (action: () => void): KeyboardShortcut => ({
        key: 'b',
        ctrl: true,
        description: 'Toggle sidebar',
        action,
    }),
    toggleTheme: (action: () => void): KeyboardShortcut => ({
        key: 'd',
        ctrl: true,
        shift: true,
        description: 'Toggle dark/light mode',
        action,
    }),
};

/**
 * Hook for displaying keyboard shortcuts help dialog
 */
export const useKeyboardShortcutsHelp = () => {
    const shortcuts: KeyboardShortcut[] = [];

    const showHelp = useCallback(() => {
        // Create modal content for shortcuts
        logger.info('Keyboard Shortcuts:');
        shortcuts.forEach((shortcut) => {
            const key = [
                shortcut.ctrl && 'Ctrl',
                shortcut.alt && 'Alt',
                shortcut.shift && 'Shift',
                shortcut.meta && '⌘',
                shortcut.key.toUpperCase(),
            ].filter(Boolean).join(' + ');
            logger.info(`${key}: ${shortcut.description}`);
        });
    }, [shortcuts]);

    return { showHelp };
};
