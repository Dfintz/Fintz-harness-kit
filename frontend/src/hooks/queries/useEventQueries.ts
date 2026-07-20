/**
 * Event Query Hooks — Sprint 22-A React Query Migration
 *
 * TanStack Query hooks for event management with automatic caching,
 * background refetching, and cache invalidation.
 */

import {
  eventService,
  type CreateEventInput,
  type EventData,
  type UpdateEventInput,
} from '@/services/eventService';
import { useMutation, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { eventKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to fetch all events
 */
export function useEvents(
  params?: { startDate?: string; endDate?: string },
  options?: Omit<UseQueryOptions<EventData[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...eventKeys.lists(), params],
    queryFn: () => eventService.getEvents(params),
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new event
 */
export function useCreateEvent() {  return useMutation({
    mutationFn: (data: CreateEventInput) => eventService.createEvent(data),
    meta: { invalidates: [eventKeys.lists()] },
  });
}

/**
 * Hook to update an existing event
 */
export function useUpdateEvent() {  return useMutation({
    mutationFn: ({ eventId, data }: { eventId: string; data: UpdateEventInput }) =>
      eventService.updateEvent(eventId, data),
    meta: { invalidates: [eventKeys.lists()] },
  });
}

/**
 * Hook to delete an event
 */
export function useDeleteEvent() {  return useMutation({
    mutationFn: (eventId: string) => eventService.deleteEvent(eventId),
    meta: { invalidates: [eventKeys.lists()] },
  });
}

/**
 * Hook to add an attendee to an event
 */
export function useAddEventAttendee() {  return useMutation({
    mutationFn: ({ eventId, attendeeId }: { eventId: string; attendeeId: string }) =>
      eventService.addAttendee(eventId, attendeeId),
    meta: { invalidates: [eventKeys.lists()] },
  });
}

/**
 * Hook to remove an attendee from an event
 */
export function useRemoveEventAttendee() {  return useMutation({
    mutationFn: ({ eventId, attendeeId }: { eventId: string; attendeeId: string }) =>
      eventService.removeAttendee(eventId, attendeeId),
    meta: { invalidates: [eventKeys.lists()] },
  });
}

/**
 * Hook to share an event with an organization
 */
export function useShareEventWithOrg() {  return useMutation({
    mutationFn: ({ eventId, orgId }: { eventId: string; orgId: string }) =>
      eventService.shareWithOrg(eventId, orgId),
    meta: { invalidates: [eventKeys.lists()] },
  });
}

/**
 * Hook to unshare an event with an organization
 */
export function useUnshareEventWithOrg() {  return useMutation({
    mutationFn: ({ eventId, orgId }: { eventId: string; orgId: string }) =>
      eventService.unshareWithOrg(eventId, orgId),
    meta: { invalidates: [eventKeys.lists()] },
  });
}
