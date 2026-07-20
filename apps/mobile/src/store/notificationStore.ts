/**
 * Notification Store for Mobile
 * Tracks real-time notification state and badge counts.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface NotificationStoreState {
  unreadCount: number;
  lastSeenAt: number | null;

  setUnreadCount: (count: number) => void;
  incrementUnread: () => void;
  markAllSeen: () => void;
}

export const useNotificationStore = create<NotificationStoreState>()(
  devtools(
    set => ({
      unreadCount: 0,
      lastSeenAt: null,

      setUnreadCount: (count: number) => set({ unreadCount: count }),

      incrementUnread: () => set(state => ({ unreadCount: state.unreadCount + 1 })),

      markAllSeen: () => set({ unreadCount: 0, lastSeenAt: Date.now() }),
    }),
    { name: 'NotificationStore', enabled: __DEV__ }
  )
);
