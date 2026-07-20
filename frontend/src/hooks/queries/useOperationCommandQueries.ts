/**
 * Operation Command Query Hooks
 *
 * TanStack Query hooks for chain-of-command and operation command operations.
 */

import { operationCommandService } from '@/services/operationCommandService';
import type {
  CommandSummary,
  OperationCommand,
  OperationCommandChain,
} from '@sc-fleet-manager/shared-types';
import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import { activityKeys } from './queryKeys';

// ============================================================================
// Query Hooks
// ============================================================================

/**
 * Hook to get the command chain for an operation
 */
export function useCommandChain(
  activityId: string | undefined,
  options?: Omit<UseQueryOptions<{ chain: OperationCommandChain | null }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: activityKeys.commandChain(activityId ?? ''),
    queryFn: () => operationCommandService.getCommandChain(activityId!),
    enabled: !!activityId,
    ...options,
  });
}

/**
 * Hook to get all commands for an operation.
 * Polls every 5 seconds while active.
 */
export function useOperationCommands(
  activityId: string | undefined,
  options?: Omit<UseQueryOptions<{ commands: CommandSummary[] }>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: activityKeys.commands(activityId ?? ''),
    queryFn: () => operationCommandService.getCommands(activityId!),
    enabled: !!activityId,
    refetchInterval: 5000,
    ...options,
  });
}

/**
 * Hook to get a single command's full details
 */
export function useOperationCommand(
  activityId: string | undefined,
  commandId: string | undefined,
  options?: Omit<UseQueryOptions<OperationCommand>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: activityKeys.command(activityId ?? '', commandId ?? ''),
    queryFn: () => operationCommandService.getCommand(activityId!, commandId!),
    enabled: !!activityId && !!commandId,
    ...options,
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to set up the command chain
 */
export function useSetCommandChain() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      data,
    }: {
      activityId: string;
      data: {
        fleetCommanders: Array<{
          userId: string;
          userName: string;
          fleetId?: string;
          fleetName?: string;
        }>;
        squadronLeaders?: Array<{
          userId: string;
          userName: string;
          squadronName: string;
          reportsToUserId: string;
        }>;
      };
    }) => operationCommandService.setCommandChain(activityId, data),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.commandChain(activityId) });
    },
  });
}

/**
 * Hook to issue a command
 */
export function useIssueCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      data,
    }: {
      activityId: string;
      data: {
        type: string;
        priority?: string;
        message: string;
        targetScope: {
          type: string;
          fleetId?: string;
          squadronName?: string;
          userIds?: string[];
        };
        payload?: Record<string, unknown>;
      };
    }) => operationCommandService.issueCommand(activityId, data),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.commands(activityId) });
    },
  });
}

/**
 * Hook to acknowledge a command
 */
export function useAcknowledgeCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      activityId,
      commandId,
      response,
    }: {
      activityId: string;
      commandId: string;
      response?: string;
    }) => operationCommandService.acknowledgeCommand(activityId, commandId, response),
    onSuccess: (_, { activityId, commandId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.commands(activityId) });
      queryClient.invalidateQueries({
        queryKey: activityKeys.command(activityId, commandId),
      });
    },
  });
}

/**
 * Hook to issue a pre-flight check
 */
export function usePreflightCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ activityId }: { activityId: string }) =>
      operationCommandService.issuePreflightCheck(activityId),
    onSuccess: (_, { activityId }) => {
      queryClient.invalidateQueries({ queryKey: activityKeys.commands(activityId) });
    },
  });
}
