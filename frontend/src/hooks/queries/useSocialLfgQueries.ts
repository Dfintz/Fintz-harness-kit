import { useMutation, useQuery } from '@tanstack/react-query';

import {
  type ConvertGroupToTeamInput,
  type CreateLfgSessionInput,
  type CreateSocialGroupInput,
  socialLfgService,
} from '@/services/socialLfgService';
import { socialLfgKeys, teamKeys } from './queryKeys';

export function useLfgSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: socialLfgKeys.sessions.detail(sessionId ?? ''),
    queryFn: () => socialLfgService.getSessionById(sessionId as string),
    enabled: !!sessionId,
  });
}

export function useSocialGroups(guildId?: string) {
  return useQuery({
    queryKey: socialLfgKeys.groups.list({ guildId }),
    queryFn: () => socialLfgService.getGroups(guildId),
  });
}

export function useCreateSocialGroup() {  return useMutation({
    mutationFn: (input: CreateSocialGroupInput) => socialLfgService.createGroup(input),
    meta: { invalidates: [socialLfgKeys.groups.lists()] },
  });
}

export function useJoinSocialGroup() {  return useMutation({
    mutationFn: (groupId: string) => socialLfgService.joinGroup(groupId),
    meta: { invalidates: [socialLfgKeys.groups.lists()] },
  });
}

export function useSocialLfgSessions(filters?: {
  organizationId?: string;
  activityType?: string;
  status?: string;
  minAvailableSlots?: number;
  tags?: string;
}) {
  return useQuery({
    queryKey: socialLfgKeys.sessions.list(filters),
    queryFn: () => socialLfgService.getSessions(filters),
  });
}

export function useCreateSocialLfgSession() {  return useMutation({
    mutationFn: (input: CreateLfgSessionInput) => socialLfgService.createSession(input),
    meta: { invalidates: [socialLfgKeys.sessions.lists()] },
  });
}

export function useJoinSocialLfgSession() {  return useMutation({
    mutationFn: (sessionId: string) => socialLfgService.joinSession(sessionId),
    meta: { invalidates: [socialLfgKeys.sessions.lists()] },
  });
}

export function useLeaveSocialLfgSession() {  return useMutation({
    mutationFn: (sessionId: string) => socialLfgService.leaveSession(sessionId),
    meta: { invalidates: [socialLfgKeys.sessions.lists()] },
  });
}

export function useStartSocialLfgSession() {  return useMutation({
    mutationFn: (sessionId: string) => socialLfgService.startSession(sessionId),
    meta: { invalidates: [socialLfgKeys.sessions.lists()] },
  });
}

export function useCompleteSocialLfgSession() {  return useMutation({
    mutationFn: (sessionId: string) => socialLfgService.completeSession(sessionId),
    meta: { invalidates: [socialLfgKeys.sessions.lists()] },
  });
}

export function useCancelSocialLfgSession() {  return useMutation({
    mutationFn: (sessionId: string) => socialLfgService.cancelSession(sessionId),
    meta: { invalidates: [socialLfgKeys.sessions.lists()] },
  });
}

export function useConvertLfgToTeam() {  return useMutation({
    mutationFn: ({ groupId, ...input }: ConvertGroupToTeamInput & { groupId: string }) =>
      socialLfgService.convertGroupToTeam(groupId, input),
    meta: { invalidates: [socialLfgKeys.groups.lists(), teamKeys.all] },
  });
}
