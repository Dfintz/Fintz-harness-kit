/**
 * UI Store
 * Manages UI state including theme, notifications, modals, and sidebar
 */

import type { Modal, Notification, UIStore } from '@/types/store';
import { create } from 'zustand';
import { createJSONStorage, devtools, persist } from 'zustand/middleware';

let notificationIdCounter = 0;
let modalIdCounter = 0;

export const useUIStore = create<UIStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        theme: 'dark',
        sidebarOpen: true,
        notifications: [],
        modals: [],
        loading: {},

        // Theme actions
        toggleTheme: () => {
          set(state => ({
            theme: state.theme === 'dark' ? 'light' : 'dark',
          }));
        },

        setTheme: theme => {
          set({ theme });
        },

        // Sidebar actions
        toggleSidebar: () => {
          set(state => ({
            sidebarOpen: !state.sidebarOpen,
          }));
        },

        setSidebarOpen: open => {
          set({ sidebarOpen: open });
        },

        // Notification actions
        addNotification: notification => {
          const id = `notification-${++notificationIdCounter}`;
          const createdAt = Date.now();

          const newNotification: Notification = {
            id,
            createdAt,
            duration: 5000,
            ...notification,
          };

          set(state => ({
            notifications: [...state.notifications, newNotification],
          }));

          // Auto-remove is handled by GlobalToastRenderer (with slide-out animation).
          // For error notifications (duration: 0), no auto-remove — user must dismiss.
        },

        removeNotification: id => {
          set(state => ({
            notifications: state.notifications.filter(n => n.id !== id),
          }));
        },

        clearNotifications: () => {
          set({ notifications: [] });
        },

        // Modal actions
        openModal: modal => {
          const id = `modal-${++modalIdCounter}`;

          const newModal: Modal = {
            id,
            ...modal,
          };

          set(state => ({
            modals: [...state.modals, newModal],
          }));
        },

        closeModal: id => {
          const { modals } = get();
          const modal = modals.find(m => m.id === id);

          if (modal?.onClose) {
            modal.onClose();
          }

          set(state => ({
            modals: state.modals.filter(m => m.id !== id),
          }));
        },

        closeAllModals: () => {
          const { modals } = get();

          // Call onClose for all modals
          modals.forEach(modal => {
            if (modal.onClose) {
              modal.onClose();
            }
          });

          set({ modals: [] });
        },

        // Loading actions
        setLoading: (key, loading) => {
          set(state => ({
            loading: {
              ...state.loading,
              [key]: loading,
            },
          }));
        },

        clearLoading: () => {
          set({ loading: {} });
        },
      }),
      {
        name: 'ui-storage',
        storage: createJSONStorage(() => localStorage),
        partialize: state => ({
          theme: state.theme,
          sidebarOpen: state.sidebarOpen,
        }),
      }
    ),
    {
      name: 'UIStore',
      enabled: import.meta.env.DEV,
    }
  )
);

// Export selectors
export const selectTheme = (state: UIStore) => state.theme;
export const selectSidebarOpen = (state: UIStore) => state.sidebarOpen;
export const selectNotifications = (state: UIStore) => state.notifications;
export const selectModals = (state: UIStore) => state.modals;
export const selectLoading = (key: string) => (state: UIStore) => state.loading[key] || false;

// Helper hooks
export const useTheme = () => {
  const theme = useUIStore(selectTheme);
  const toggleTheme = useUIStore(state => state.toggleTheme);
  const setTheme = useUIStore(state => state.setTheme);

  return { theme, toggleTheme, setTheme };
};

export const useNotification = () => {
  const addNotification = useUIStore(state => state.addNotification);

  return {
    success: (message: string, title?: string, duration?: number) =>
      addNotification({ type: 'success', message, title, ...(duration != null && { duration }) }),
    error: (message: string, title?: string) =>
      addNotification({ type: 'error', message, title, duration: 0 }),
    warning: (message: string, title?: string, duration?: number) =>
      addNotification({ type: 'warning', message, title, ...(duration != null && { duration }) }),
    info: (message: string, title?: string, duration?: number) =>
      addNotification({ type: 'info', message, title, ...(duration != null && { duration }) }),
  };
};

export const useModal = () => {
  const openModal = useUIStore(state => state.openModal);
  const closeModal = useUIStore(state => state.closeModal);
  const closeAllModals = useUIStore(state => state.closeAllModals);

  return { openModal, closeModal, closeAllModals };
};
