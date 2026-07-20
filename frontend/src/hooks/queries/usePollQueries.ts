/**
 * Poll Query Hooks
 *
 * TanStack React Query hooks for the Poll/Voting subsystem.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import {
  pollService,
  type CastVoteInput,
  type CreatePollInput,
  type MirrorPollToDiscordInput,
  type PaginatedPollResponse,
  type Poll,
  type PollFilters,
  type PollResults,
  type UpdatePollInput,
} from '@/services/pollService';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pollKeys } from './queryKeys';

const POLL_RESULTS_LIVE_REFETCH_MS = 10_000;

// Re-export types for convenience
export type {
  PollDiscordMirror,
  PollOption,
  PollStatus,
  PollType,
  PollVisibility,
} from '@/services/pollService';
export type {
  CastVoteInput,
  CreatePollInput,
  MirrorPollToDiscordInput,
  PaginatedPollResponse,
  Poll,
  PollFilters,
  PollResults,
  UpdatePollInput,
};

/* ── Queries ── */

export function usePolls(filters?: PollFilters) {
  return useQuery<PaginatedPollResponse>({
    queryKey: pollKeys.list(filters as Record<string, unknown> | undefined),
    queryFn: () => pollService.getPolls(filters),
  });
}

export function usePoll(id: string | undefined) {
  return useQuery<Poll>({
    queryKey: pollKeys.detail(id ?? ''),
    queryFn: () => pollService.getPoll(id!),
    enabled: !!id,
  });
}

export function usePollResults(pollId: string | undefined, enableLiveUpdates = false) {
  return useQuery<PollResults>({
    queryKey: pollKeys.results(pollId ?? ''),
    queryFn: () => pollService.getResults(pollId!),
    enabled: !!pollId,
    refetchInterval: enableLiveUpdates ? POLL_RESULTS_LIVE_REFETCH_MS : false,
    refetchIntervalInBackground: false,
  });
}

/* ── Mutations ── */

export function useCreatePoll() {
  return useMutation({
    mutationFn: (data: CreatePollInput) => pollService.createPoll(data),
    meta: { invalidates: [pollKeys.lists()] },
  });
}

export function useUpdatePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePollInput }) =>
      pollService.updatePoll(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: pollKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: pollKeys.lists() });
    },
  });
}

export function useDeletePoll() {
  return useMutation({
    mutationFn: (id: string) => pollService.deletePoll(id),
    meta: { invalidates: [pollKeys.lists()] },
  });
}

export function useCastVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, data }: { pollId: string; data: CastVoteInput }) =>
      pollService.castVote(pollId, data),
    onSuccess: (_, { pollId }) => {
      queryClient.invalidateQueries({ queryKey: pollKeys.results(pollId) });
      queryClient.invalidateQueries({ queryKey: pollKeys.detail(pollId) });
      queryClient.invalidateQueries({ queryKey: pollKeys.lists() });
    },
  });
}

export function useClosePoll() {
  return useMutation({
    mutationFn: (id: string) => pollService.closePoll(id),
    meta: { invalidates: [pollKeys.lists()] },
  });
}

export function useMirrorPollToDiscord() {
  return useMutation({
    mutationFn: ({ pollId, data }: { pollId: string; data: MirrorPollToDiscordInput }) =>
      pollService.mirrorPollToDiscord(pollId, data),
  });
}
