import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type FederationAmbassadorPermission,
  type FederationAmbassadorRole,
  type FederationAnnouncementAudience,
  type FederationAssociationType,
  type FederationIntelClassification,
  type FederationRole,
  type FederationSettings,
  type FederationTeamMember,
  type FederationTeamStatus,
  type FederationTeamType,
  type FederationVotingMode,
  type FederationWikiVisibility,
  type GovernanceSettings,
  type ProposalStatus,
  type ProposalType,
  type ResourceAccessLevel,
  type ResourceType,
  type TreatyType,
  type VoteChoice,
  federationManagementService,
} from '@/services/federationManagementService';
import { useAuthStore } from '@/store/authStore';
import { federationManagementKeys } from './queryKeys';

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Hook to fetch all federations the current user's org belongs to.
 *
 * User-scoped: cache key includes the signed-in user's id so a previous user's
 * federation memberships cannot be served to the next signed-in user from cache.
 */
export function useMyFederations() {
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({
    queryKey: federationManagementKeys.myList(userId),
    queryFn: () => federationManagementService.getMyFederations(),
    enabled: !!userId,
  });
}

export function useFederation(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.detail(federationId ?? ''),
    queryFn: () => federationManagementService.getFederation(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationProposals(
  federationId: string | undefined,
  status?: ProposalStatus | 'all'
) {
  const resolvedStatus = status === 'all' ? undefined : status;
  return useQuery({
    queryKey: federationManagementKeys.proposalList(federationId ?? '', resolvedStatus),
    queryFn: () => federationManagementService.listProposals(federationId!, resolvedStatus),
    enabled: !!federationId,
  });
}

export function useFederationStats(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.stats(federationId ?? ''),
    queryFn: () => federationManagementService.getStats(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationContributions(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.contributions(federationId ?? ''),
    queryFn: () => federationManagementService.getContributions(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationSettings(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.settings(federationId ?? ''),
    queryFn: () => federationManagementService.getSettings(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationFleets(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.fleets(federationId ?? ''),
    queryFn: () => federationManagementService.getFleets(federationId!),
    enabled: !!federationId,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useDisbandFederation() {
  return useMutation({
    mutationFn: (id: string) => federationManagementService.disbandFederation(id),
    meta: { invalidates: [federationManagementKeys.all] },
  });
}

export function useUpdateFederation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: Partial<{
        name: string;
        description: string;
        isPublic: boolean;
        tags: string[];
        logoUrl: string;
        bannerUrl: string;
        discordUrl: string;
        websiteUrl: string;
        reviewDate: string | null;
        expiryDate: string | null;
        autoRenew: boolean;
        governance: Partial<GovernanceSettings>;
      }>;
    }) => federationManagementService.updateFederation(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: federationManagementKeys.detail(id) });
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      targetOrgId,
      targetOrgName,
      role,
      associationType,
    }: {
      federationId: string;
      targetOrgId: string;
      targetOrgName: string;
      role?: FederationRole;
      associationType?: FederationAssociationType;
    }) =>
      federationManagementService.inviteMember(
        federationId,
        targetOrgId,
        targetOrgName,
        role,
        associationType
      ),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, memberId }: { federationId: string; memberId: string }) =>
      federationManagementService.removeMember(federationId, memberId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useAcceptFederationInvitation() {
  return useMutation({
    mutationFn: (federationId: string) =>
      federationManagementService.acceptInvitation(federationId),
    meta: { invalidates: [federationManagementKeys.all] },
  });
}

export function useDeclineFederationInvitation() {
  return useMutation({
    mutationFn: ({ federationId, memberId }: { federationId: string; memberId: string }) =>
      federationManagementService.declineInvitation(federationId, memberId),
    meta: { invalidates: [federationManagementKeys.all] },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      memberId,
      role,
    }: {
      federationId: string;
      memberId: string;
      role: FederationRole;
    }) => federationManagementService.updateMemberRole(federationId, memberId, role),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        type: ProposalType;
        title: string;
        description: string;
        votingDurationDays?: number;
        metadata?: Record<string, unknown>;
      };
    }) => federationManagementService.createProposal(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.proposals(federationId),
      });
    },
  });
}

export function useCastVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      proposalId,
      vote,
      comment,
    }: {
      federationId: string;
      proposalId: string;
      vote: VoteChoice;
      comment?: string;
    }) => federationManagementService.castVote(federationId, proposalId, vote, comment),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.proposals(federationId),
      });
    },
  });
}

export function useAddFederationResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        name: string;
        type: ResourceType;
        accessLevel?: ResourceAccessLevel;
        description: string;
      };
    }) => federationManagementService.addResource(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useRemoveFederationResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, resourceId }: { federationId: string; resourceId: string }) =>
      federationManagementService.removeResource(federationId, resourceId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useCreateTreaty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        name: string;
        type: TreatyType;
        terms: string[];
        effectiveDate?: string;
        expirationDate?: string;
      };
    }) => federationManagementService.createTreaty(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useRespondToTreaty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      treatyId,
      action,
    }: {
      federationId: string;
      treatyId: string;
      action: 'sign' | 'reject';
    }) => federationManagementService.respondToTreaty(federationId, treatyId, action),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useTerminateTreaty() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, treatyId }: { federationId: string; treatyId: string }) =>
      federationManagementService.terminateTreaty(federationId, treatyId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useUpdateFederationSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: Partial<FederationSettings>;
    }) => federationManagementService.updateSettings(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.settings(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useUpdateSuccessionMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: { successionMode: 'fixed' | 'rotation' | 'election'; leaderTermDays?: number };
    }) => federationManagementService.updateSuccessionMode(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useSucceedChairman() {
  return useMutation({
    mutationFn: (federationId: string) => federationManagementService.succeedChairman(federationId),
    meta: {
      invalidates: (_data, federationId) => [federationManagementKeys.detail(federationId)],
    },
  });
}

// ─── Ambassador Queries ───────────────────────────────────────────────────────

export function useFederationAmbassadors(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.ambassadors(federationId ?? ''),
    queryFn: () => federationManagementService.listAmbassadors(federationId!),
    enabled: !!federationId,
  });
}

export function useMyAmbassadorProfile(federationId: string | undefined) {
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({
    queryKey: federationManagementKeys.myAmbassador(federationId ?? '', userId),
    queryFn: () => federationManagementService.getMyAmbassadorProfile(federationId!),
    enabled: !!userId && !!federationId,
  });
}

// ─── Ambassador Mutations ─────────────────────────────────────────────────────

export function useAppointAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        userId: string;
        userName: string;
        organizationId: string;
        organizationName: string;
        role?: FederationAmbassadorRole;
        permissions?: FederationAmbassadorPermission[];
        title?: string;
        isExternal?: boolean;
      };
    }) => federationManagementService.appointAmbassador(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.ambassadors(federationId),
      });
    },
  });
}

export function useUpdateAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      ambassadorId,
      data,
    }: {
      federationId: string;
      ambassadorId: string;
      data: {
        role?: FederationAmbassadorRole;
        permissions?: FederationAmbassadorPermission[];
        title?: string | null;
        isActive?: boolean;
      };
    }) => federationManagementService.updateAmbassador(federationId, ambassadorId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.ambassadors(federationId),
      });
    },
  });
}

export function useRemoveAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, ambassadorId }: { federationId: string; ambassadorId: string }) =>
      federationManagementService.removeAmbassador(federationId, ambassadorId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.ambassadors(federationId),
      });
    },
  });
}

// ─── Wiki Queries ─────────────────────────────────────────────────────────────

export function useFederationWikiPages(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.wikiPages(federationId ?? ''),
    queryFn: () => federationManagementService.listWikiPages(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationWikiTree(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.wikiTree(federationId ?? ''),
    queryFn: () => federationManagementService.getWikiTree(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationWikiPage(
  federationId: string | undefined,
  pageId: string | undefined
) {
  return useQuery({
    queryKey: federationManagementKeys.wikiPage(federationId ?? '', pageId ?? ''),
    queryFn: () => federationManagementService.getWikiPage(federationId!, pageId!),
    enabled: !!federationId && !!pageId,
  });
}

// ─── Wiki Mutations ───────────────────────────────────────────────────────────

export function useCreateFederationWikiPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        title: string;
        content?: string;
        parentPageId?: string | null;
        tags?: string[];
        visibility?: FederationWikiVisibility;
      };
    }) => federationManagementService.createWikiPage(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.wikiPages(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.wikiTree(federationId),
      });
    },
  });
}

export function useUpdateFederationWikiPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      pageId,
      data,
    }: {
      federationId: string;
      pageId: string;
      data: {
        title?: string;
        content?: string;
        tags?: string[];
        changeDescription?: string;
        isLocked?: boolean;
        visibility?: FederationWikiVisibility;
      };
    }) => federationManagementService.updateWikiPage(federationId, pageId, data),
    onSuccess: (_data, { federationId, pageId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.wikiPages(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.wikiPage(federationId, pageId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.wikiTree(federationId),
      });
    },
  });
}

export function useDeleteFederationWikiPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, pageId }: { federationId: string; pageId: string }) =>
      federationManagementService.deleteWikiPage(federationId, pageId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.wikiPages(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.wikiTree(federationId),
      });
    },
  });
}

// ─── Announcement Queries ──────────────────────────────────────────────────────

export function useFederationAnnouncements(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.announcements(federationId ?? ''),
    queryFn: () => federationManagementService.listFederationAnnouncements(federationId!),
    enabled: !!federationId,
  });
}

// ─── Announcement Mutations ────────────────────────────────────────────────────

export function useCreateFederationAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        title: string;
        content: string;
        targetAudience?: FederationAnnouncementAudience;
      };
    }) => federationManagementService.createFederationAnnouncement(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.announcements(federationId),
      });
    },
  });
}

export function useDeleteFederationAnnouncement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      announcementId,
    }: {
      federationId: string;
      announcementId: string;
    }) => federationManagementService.deleteFederationAnnouncement(federationId, announcementId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.announcements(federationId),
      });
    },
  });
}

export function useToggleAnnouncementPin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      announcementId,
    }: {
      federationId: string;
      announcementId: string;
    }) => federationManagementService.toggleAnnouncementPin(federationId, announcementId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.announcements(federationId),
      });
    },
  });
}

export function usePostFederationAnnouncementToDiscord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      announcementId,
      channelId,
    }: {
      federationId: string;
      announcementId: string;
      channelId: string;
    }) =>
      federationManagementService.postFederationAnnouncementToDiscord(
        federationId,
        announcementId,
        channelId
      ),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.announcements(federationId),
      });
    },
  });
}

// ─── Poll Queries ───────────────────────────────────────────────────────────────

export function useFederationPolls(federationId: string | undefined, status?: string) {
  return useQuery({
    queryKey: federationManagementKeys.polls(federationId ?? ''),
    queryFn: () => federationManagementService.listFederationPolls(federationId!, status),
    enabled: !!federationId,
  });
}

export function useFederationPollResults(
  federationId: string | undefined,
  pollId: string | undefined
) {
  return useQuery({
    queryKey: federationManagementKeys.pollResults(federationId ?? '', pollId ?? ''),
    queryFn: () => federationManagementService.getFederationPollResults(federationId!, pollId!),
    enabled: !!federationId && !!pollId,
  });
}

// ─── Poll Mutations ─────────────────────────────────────────────────────────────

export function useCreateFederationPoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        title: string;
        description?: string;
        pollType?: string;
        options: Array<{ label: string; description?: string }>;
        votingMode?: FederationVotingMode;
        isAnonymous?: boolean;
        maxSelections?: number;
        endsAt?: string;
      };
    }) => federationManagementService.createFederationPoll(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.polls(federationId),
      });
    },
  });
}

export function useCastFederationVote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      pollId,
      optionId,
    }: {
      federationId: string;
      pollId: string;
      optionId: string;
    }) => federationManagementService.castFederationVote(federationId, pollId, optionId),
    onSuccess: (_data, { federationId, pollId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.polls(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.pollResults(federationId, pollId),
      });
    },
  });
}

export function useCloseFederationPoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, pollId }: { federationId: string; pollId: string }) =>
      federationManagementService.closeFederationPoll(federationId, pollId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.polls(federationId),
      });
    },
  });
}

export function useDeleteFederationPoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, pollId }: { federationId: string; pollId: string }) =>
      federationManagementService.deleteFederationPoll(federationId, pollId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.polls(federationId),
      });
    },
  });
}

export function usePostFederationPollToDiscord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      pollId,
      channelId,
    }: {
      federationId: string;
      pollId: string;
      channelId: string;
    }) => federationManagementService.postFederationPollToDiscord(federationId, pollId, channelId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.polls(federationId),
      });
    },
  });
}

// ─── Team Queries ───────────────────────────────────────────────────────────────

export function useFederationTeams(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.teams(federationId ?? ''),
    queryFn: () => federationManagementService.listFederationTeams(federationId!),
    enabled: !!federationId,
  });
}

// ─── Team Mutations ─────────────────────────────────────────────────────────────

export function useCreateFederationTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        name: string;
        description?: string;
        type?: FederationTeamType;
        maxMembers?: number;
      };
    }) => federationManagementService.createFederationTeam(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.teams(federationId),
      });
    },
  });
}

export function useUpdateFederationTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      teamId,
      data,
    }: {
      federationId: string;
      teamId: string;
      data: {
        name?: string;
        description?: string | null;
        type?: FederationTeamType;
        maxMembers?: number;
        status?: FederationTeamStatus;
      };
    }) => federationManagementService.updateFederationTeam(federationId, teamId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.teams(federationId),
      });
    },
  });
}

export function useAddFederationTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      teamId,
      member,
    }: {
      federationId: string;
      teamId: string;
      member: FederationTeamMember;
    }) => federationManagementService.addFederationTeamMember(federationId, teamId, member),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.teams(federationId),
      });
    },
  });
}

export function useRemoveFederationTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      teamId,
      memberUserId,
    }: {
      federationId: string;
      teamId: string;
      memberUserId: string;
    }) =>
      federationManagementService.removeFederationTeamMember(federationId, teamId, memberUserId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.teams(federationId),
      });
    },
  });
}

export function useDeleteFederationTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, teamId }: { federationId: string; teamId: string }) =>
      federationManagementService.deleteFederationTeam(federationId, teamId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.teams(federationId),
      });
    },
  });
}

// ─── Intel Queries ──────────────────────────────────────────────────────────────

export function useFederationIntel(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.intel(federationId ?? ''),
    queryFn: () => federationManagementService.listFederationIntel(federationId!),
    enabled: !!federationId,
  });
}

// ─── Intel Mutations ────────────────────────────────────────────────────────────

export function useSubmitFederationIntel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: {
        title: string;
        content: string;
        classification?: FederationIntelClassification;
        tags?: string[];
        visibleToTreaties?: string[];
      };
    }) => federationManagementService.submitFederationIntel(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.intel(federationId),
      });
    },
  });
}

export function useApproveFederationIntel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, intelId }: { federationId: string; intelId: string }) =>
      federationManagementService.approveFederationIntel(federationId, intelId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.intel(federationId),
      });
    },
  });
}

export function useArchiveFederationIntel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, intelId }: { federationId: string; intelId: string }) =>
      federationManagementService.archiveFederationIntel(federationId, intelId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.intel(federationId),
      });
    },
  });
}

export function useDeleteFederationIntel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, intelId }: { federationId: string; intelId: string }) =>
      federationManagementService.deleteFederationIntel(federationId, intelId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.intel(federationId),
      });
    },
  });
}

// ─── Personnel Queries ─────────────────────────────────────────────────────

export function useFederationPersonnel(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.personnel(federationId ?? ''),
    queryFn: () => federationManagementService.listFederationPersonnel(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationPersonnelSummary(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.personnelSummary(federationId ?? ''),
    queryFn: () => federationManagementService.getFederationPersonnelSummary(federationId!),
    enabled: !!federationId,
  });
}

// ─── Application Queries ──────────────────────────────────────────────────────

export function useFederationApplicationMode(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.applicationMode(federationId ?? ''),
    queryFn: () => federationManagementService.getFederationApplicationMode(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationApplications(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.applications(federationId ?? ''),
    queryFn: () => federationManagementService.listFederationApplications(federationId!),
    enabled: !!federationId,
  });
}

// ─── Application Mutations ────────────────────────────────────────────────────

export function useSubmitFederationApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      data,
    }: {
      federationId: string;
      data: { message?: string; formResponses?: Record<string, string>; source?: string };
    }) => federationManagementService.submitFederationApplication(federationId, data),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.applications(federationId),
      });
    },
  });
}

export function useReviewFederationApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      appId,
      decision,
      note,
    }: {
      federationId: string;
      appId: string;
      decision: 'approved' | 'rejected';
      note?: string;
    }) =>
      federationManagementService.reviewFederationApplication(federationId, appId, decision, note),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.applications(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.detail(federationId),
      });
    },
  });
}

export function useWithdrawFederationApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId, appId }: { federationId: string; appId: string }) =>
      federationManagementService.withdrawFederationApplication(federationId, appId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.applications(federationId),
      });
    },
  });
}

// ─── Discord Queries ──────────────────────────────────────────────────────────

export function useFederationDiscordStatus(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.discordStatus(federationId ?? ''),
    queryFn: () => federationManagementService.getFederationDiscordStatus(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationDiscordConflicts(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.discordConflicts(federationId ?? ''),
    queryFn: () => federationManagementService.getFederationDiscordConflicts(federationId!),
    enabled: !!federationId,
  });
}

// ─── Discord Mutations ────────────────────────────────────────────────────────

export function useSetupFederationDiscord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      guildId,
      guildName,
    }: {
      federationId: string;
      guildId: string;
      guildName: string;
    }) => federationManagementService.setupFederationDiscord(federationId, guildId, guildName),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.discordStatus(federationId),
      });
    },
  });
}

export function useUnlinkFederationDiscord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ federationId }: { federationId: string }) =>
      federationManagementService.unlinkFederationDiscord(federationId),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.discordStatus(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.discordConflicts(federationId),
      });
    },
  });
}

export function useResolveFederationDiscordConflict() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      federationId,
      discordUserId,
      chosenOrgId,
    }: {
      federationId: string;
      discordUserId: string;
      chosenOrgId: string;
    }) =>
      federationManagementService.resolveFederationDiscordConflict(
        federationId,
        discordUserId,
        chosenOrgId
      ),
    onSuccess: (_data, { federationId }) => {
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.discordConflicts(federationId),
      });
      queryClient.invalidateQueries({
        queryKey: federationManagementKeys.discordStatus(federationId),
      });
    },
  });
}

// ── Federation Discord Guild Settings Queries ─────────────────

export function useFederationGuildSettingsList(federationId: string | undefined) {
  return useQuery({
    queryKey: federationManagementKeys.guildSettings(federationId!),
    queryFn: () => federationManagementService.getFederationGuildSettingsList(federationId!),
    enabled: !!federationId,
  });
}

export function useFederationGuildSettings(
  federationId: string | undefined,
  guildId: string | undefined
) {
  return useQuery({
    queryKey: federationManagementKeys.guildSettingsDetail(federationId!, guildId!),
    queryFn: () => federationManagementService.getFederationGuildSettings(federationId!, guildId!),
    enabled: !!federationId && !!guildId,
  });
}

export function useUpdateFederationGuildSettingsSection() {
  return useMutation({
    mutationFn: ({
      federationId,
      guildId,
      section,
      data,
    }: {
      federationId: string;
      guildId: string;
      section: string;
      data: Record<string, unknown>;
    }) =>
      federationManagementService.updateFederationGuildSettingsSection(
        federationId,
        guildId,
        section,
        data
      ),
    meta: {
      invalidates: (_data: unknown, vars: { federationId: string; guildId: string }) => [
        federationManagementKeys.guildSettingsDetail(vars.federationId, vars.guildId),
        federationManagementKeys.guildSettings(vars.federationId),
      ],
    },
  });
}

// Re-export types for convenience
export type {
  FederationAmbassador,
  FederationAmbassadorPermission,
  FederationAmbassadorRole,
  FederationAnnouncement,
  FederationAnnouncementAudience,
  FederationApplication,
  FederationApplicationMode,
  FederationApplicationModeResponse,
  FederationDiscordConflict,
  FederationDiscordGuildSettingsDTO,
  FederationDiscordStatus,
  FederationFleetItem,
  FederationFleetsResponse,
  FederationIntelClassification,
  FederationIntelEntry,
  FederationIntelStatus,
  FederationMember,
  FederationPersonnel,
  FederationPersonnelSummary,
  FederationPoll,
  FederationPollResults,
  FederationProposal,
  FederationResource,
  FederationRole,
  FederationSettings,
  FederationStats,
  FederationTeam,
  FederationTeamMember,
  FederationTeamType,
  FederationTreaty,
  FederationVotingMode,
  FederationWikiPage,
  FederationWikiTreeNode,
  FederationWikiVisibility,
  ManagedFederation,
  MemberContribution,
  ProposalStatus,
  ProposalType,
  ResourceType,
  TreatyType,
  VoteChoice,
} from '@/services/federationManagementService';
