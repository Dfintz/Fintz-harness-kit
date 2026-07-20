/**
 * Notification Query Hooks — Phase 3
 *
 * TanStack Query hooks for notification operations with automatic caching,
 * background refetching, and optimistic updates.
 */

import type {
  NotificationDigest,
  NotificationListParams,
  NotificationPreferences,
  SendNotificationRequest,
} from '@/services/notificationService';
import { notificationService } from '@/services/notificationService';
import type { Notification } from '@/types/apiV2';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { notificationKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch notifications for the current user
 */
export function useNotifications(
  params?: NotificationListParams,
  options?: Omit<UseQueryOptions<Notification[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: notificationKeys.list(params as Record<string, unknown>),
    queryFn: () => notificationService.getNotifications(params),
    // Poll for new notifications every 30 seconds
    refetchInterval: 30_000,
    ...options,
  });
}

/**
 * Hook to fetch notification digest
 */
export function useNotificationDigest(
  digestId?: string,
  options?: Omit<UseQueryOptions<NotificationDigest>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: digestId ? notificationKeys.digestById(digestId) : notificationKeys.digest(),
    queryFn: () => notificationService.getDigest(digestId),
    ...options,
  });
}

/**
 * Hook to fetch notification preferences
 */
export function useNotificationPreferences(
  options?: Omit<UseQueryOptions<NotificationPreferences>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationService.getPreferences(),
    staleTime: 5 * 60 * 1000, // Preferences rarely change — 5 min stale time
    ...options,
  });
}

/**
 * Hook to get unread notification count (derived from useNotifications)
 */
export function useUnreadNotificationCount(
  options?: Omit<UseQueryOptions<Notification[]>, 'queryKey' | 'queryFn'>
) {
  return useNotifications(undefined, {
    ...options,
    select: (notifications: Notification[]) =>
      notifications.filter((n: Notification) => !n.read).length,
  } as unknown as Omit<UseQueryOptions<Notification[]>, 'queryKey' | 'queryFn'>);
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to send a notification
 */
export function useSendNotification() {
  return useMutation({
    mutationFn: (data: SendNotificationRequest) => notificationService.sendNotification(data),
    meta: { invalidates: [notificationKeys.lists()] },
  });
}

/**
 * Hook to mark specific notifications as read
 */
export function useMarkNotificationsAsRead() {
  return useMutation({
    mutationFn: (notificationIds: string[]) => notificationService.markAsRead(notificationIds),
    meta: { invalidates: [notificationKeys.lists()] },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsAsRead() {
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    meta: { invalidates: [notificationKeys.lists()] },
  });
}

/**
 * Hook to delete a notification
 */
export function useDeleteNotification() {
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.deleteNotification(notificationId),
    meta: { invalidates: [notificationKeys.lists()] },
  });
}

/**
 * Hook to update notification preferences
 *
 * NOTE: deliberately does NOT call setQueryData. Notification preferences is
 * a JSONB-backed payload — writing the partial response into cache caused
 * the "settings snap back" class of bugs. Invalidate-and-refetch instead.
 * See /memories/repo/typeorm-jsonb-pitfall.md.
 */
export function useUpdateNotificationPreferences() {
  return useMutation({
    mutationFn: (preferences: Partial<NotificationPreferences>) =>
      notificationService.updatePreferences(preferences),
    meta: {
      invalidates: [notificationKeys.preferences()],
    },
  });
}
