/**
 * Inbox Query Hooks — React Query migration
 *
 * TanStack Query hooks for user inbox (sent contact requests, message detail, replies).
 */

import {
  type ContactRequestListItem,
  type ContactRequestReplyItem,
  contactRequestService,
  type InboxMessageDetail,
} from '@/services/publicDirectoryService';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { inboxKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/** Fetch user's sent messages (inbox list) */
export function useInboxMessages(
  options?: Omit<UseQueryOptions<ContactRequestListItem[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: inboxKeys.messages(),
    queryFn: async () => {
      const result = await contactRequestService.getSentMessages({ limit: 50 });
      return result.data;
    },
    ...options,
  });
}

/** Fetch a single inbox message with replies */
export function useInboxMessageDetail(
  requestId: string | undefined,
  options?: Omit<UseQueryOptions<InboxMessageDetail>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: inboxKeys.detail(requestId!),
    queryFn: () => contactRequestService.getInboxMessage(requestId!),
    enabled: !!requestId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Send a reply to an inbox message.
 *
 * NOTE: appends the new reply onto the cached detail (array append on a
 * non-JSONB shape — safe, see /memories/repo/react-query-meta-invalidates.md).
 * The list invalidation is also routed through `meta.invalidates`.
 */
export function useAddInboxReply() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, message }: { requestId: string; message: string }) =>
      contactRequestService.addInboxReply(requestId, message),
    onSuccess: (reply: ContactRequestReplyItem, { requestId }) => {
      // Optimistically append reply to the cached detail (array append — safe)
      queryClient.setQueryData<InboxMessageDetail>(inboxKeys.detail(requestId), prev =>
        prev ? { ...prev, replies: [...(prev.replies || []), reply] } : undefined
      );
    },
    meta: { invalidates: [inboxKeys.messages()] },
  });
}
