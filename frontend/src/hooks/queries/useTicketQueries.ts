import {
  ticketService,
  type AddFeedbackRequest,
  type AddMessageRequest,
  type AssignTicketRequest,
  type CreateTicketRequest,
  type PaginatedResponse,
  type ResolveTicketRequest,
  type Ticket,
  type TicketQueryFilters,
  type TicketStats,
  type UpdateTicketRequest,
} from '@/services/ticketService';
import { useAuthStore } from '@/store/authStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ticketKeys } from './queryKeys';

// Re-export types for convenience
export type {
  AddFeedbackRequest,
  AddMessageRequest,
  AssignTicketRequest,
  CreateTicketRequest,
  PaginatedResponse,
  ResolveTicketRequest,
  Ticket,
  TicketQueryFilters,
  TicketStats,
  UpdateTicketRequest
};

/** Check if the current user has an active organization context */
function useHasOrg(): boolean {
  const user = useAuthStore(state => state.user);
  return !!(user?.activeOrgId || user?.organizationId);
}

/* ── Queries ── */

export function useTickets(filters?: TicketQueryFilters) {
  const hasOrg = useHasOrg();
  return useQuery<PaginatedResponse<Ticket>>({
    queryKey: ticketKeys.list(filters as Record<string, unknown> | undefined),
    queryFn: () => ticketService.getTickets(filters),
    enabled: hasOrg,
  });
}

export function useTicket(id: string | undefined) {
  return useQuery<Ticket>({
    queryKey: ticketKeys.detail(id ?? ''),
    queryFn: () => ticketService.getTicket(id!),
    enabled: !!id,
  });
}

export function useTicketByNumber(ticketNumber: string | undefined) {
  return useQuery<Ticket>({
    queryKey: ticketKeys.byNumber(ticketNumber ?? ''),
    queryFn: () => ticketService.getTicketByNumber(ticketNumber!),
    enabled: !!ticketNumber,
  });
}

export function useTicketStats() {
  const hasOrg = useHasOrg();
  return useQuery<TicketStats>({
    queryKey: ticketKeys.stats(),
    queryFn: () => ticketService.getStats(),
    enabled: hasOrg,
  });
}

/* ── Mutations ── */

export function useCreateTicket() {
  return useMutation({
    mutationFn: (data: CreateTicketRequest) => ticketService.createTicket(data),
    meta: {
      invalidates: [ticketKeys.lists(), ticketKeys.stats()],
    },
  });
}

export function useUpdateTicket() {
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTicketRequest }) =>
      ticketService.updateTicket(id, data),
    meta: {
      invalidates: (_data, variables) => [
        ticketKeys.detail((variables as { id: string }).id),
        ticketKeys.lists(),
      ],
    },
  });
}

export function useDeleteTicket() {
  return useMutation({
    mutationFn: (id: string) => ticketService.deleteTicket(id),
    meta: {
      invalidates: [ticketKeys.lists(), ticketKeys.stats()],
    },
  });
}

export function useAddMessage() {
  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: AddMessageRequest }) =>
      ticketService.addMessage(ticketId, data),
    meta: {
      invalidates: (_data, variables) => [
        ticketKeys.detail((variables as { ticketId: string }).ticketId),
        ticketKeys.lists(),
      ],
    },
  });
}

export function useAssignTicket() {
  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: AssignTicketRequest }) =>
      ticketService.assignTicket(ticketId, data),
    meta: {
      invalidates: (_data, variables) => [
        ticketKeys.detail((variables as { ticketId: string }).ticketId),
        ticketKeys.lists(),
      ],
    },
  });
}

export function useResolveTicket() {
  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: ResolveTicketRequest }) =>
      ticketService.resolveTicket(ticketId, data),
    meta: {
      invalidates: (_data, variables) => [
        ticketKeys.detail((variables as { ticketId: string }).ticketId),
        ticketKeys.lists(),
        ticketKeys.stats(),
      ],
    },
  });
}

export function useCloseTicket() {
  return useMutation({
    mutationFn: (ticketId: string) => ticketService.closeTicket(ticketId),
    meta: {
      invalidates: (_data, ticketId) => [
        ticketKeys.detail(ticketId as string),
        ticketKeys.lists(),
        ticketKeys.stats(),
      ],
    },
  });
}

export function useReopenTicket() {
  return useMutation({
    mutationFn: (ticketId: string) => ticketService.reopenTicket(ticketId),
    meta: {
      invalidates: (_data, ticketId) => [
        ticketKeys.detail(ticketId as string),
        ticketKeys.lists(),
        ticketKeys.stats(),
      ],
    },
  });
}

export function useAddFeedback() {
  return useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: AddFeedbackRequest }) =>
      ticketService.addFeedback(ticketId, data),
    meta: {
      invalidates: (_data, variables) => [
        ticketKeys.detail((variables as { ticketId: string }).ticketId),
      ],
    },
  });
}
