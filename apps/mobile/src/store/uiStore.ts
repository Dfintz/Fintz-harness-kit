/**
 * UI Store for Mobile
 * Manages client-only UI state: theme mode, toast notifications.
 */

import { asyncStorage } from '@/utils/storage';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark';

interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

interface UIState {
  theme: ThemeMode;
  toasts: ToastNotification[];

  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  addToast: (toast: Omit<ToastNotification, 'id'>) => void;
  removeToast: (id: string) => void;
  clearToasts: () => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    persist(
      set => ({
        theme: 'dark',
        toasts: [],

        toggleTheme: () => set(state => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),

        setTheme: (theme: ThemeMode) => set({ theme }),

        addToast: toast =>
          set(state => ({
            toasts: [...state.toasts, { ...toast, id: Date.now().toString() }],
          })),

        removeToast: id => set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

        clearToasts: () => set({ toasts: [] }),
      }),
      {
        name: 'ui-storage',
        storage: createJSONStorage(() => asyncStorage),
        partialize: state => ({ theme: state.theme }),
      }
    ),
    { name: 'UIStore', enabled: __DEV__ }
  )
);
