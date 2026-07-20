/**
 * Notification Query Hooks for Mobile
 * TanStack Query hooks for notification operations.
 * Ported from frontend/src/hooks/queries/useNotificationQueries.ts
 */

import type {
  NotificationListParams,
  NotificationPreferences,
} from '@/services/notificationService';
import { notificationService } from '@/services/notificationService';
import type { Notification } from '@/types/apiV2';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { notificationKeys } from './queryKeys';

export function useNotifications(
  params?: NotificationListParams,
  options?: Omit<UseQueryOptions<Notification[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: notificationKeys.list(params as Record<string, unknown>),
    queryFn: () => notificationService.getNotifications(params),
    refetchInterval: 30_000,
    ...options,
  });
}

export function useNotificationPreferences(
  options?: Omit<UseQueryOptions<NotificationPreferences>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationService.getPreferences(),
    staleTime: 5 * 60 * 1000,
    ...options,
  });
}

export function useUnreadNotificationCount(
  options?: Omit<UseQueryOptions<Notification[]>, 'queryKey' | 'queryFn'>
) {
  return useNotifications(undefined, {
    ...options,
    select: (notifications: Notification[]) =>
      notifications.filter((n: Notification) => !n.read).length,
  } as unknown as Omit<UseQueryOptions<Notification[]>, 'queryKey' | 'queryFn'>);
}

// Mutations

export function useMarkNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationIds: string[]) => notificationService.markAsRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationService.deleteNotification(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    },
  });
}
