/**
 * Organization Settings Query Hooks
 *
 * TanStack Query hooks for org settings, Discord guild management,
 * and public profile editing in OrgSettings page.
 */

import { apiClient } from '@/services/apiClient';
import { discordService, type GuildSettingsDTO } from '@/services/discordService';
import {
  publicDirectoryService,
  type ProfileUpdateInput,
  type PublicOrgProfile,
} from '@/services/publicDirectoryService';
import { useAuthStore } from '@/store/authStore';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  applicationKeys,
  discordSettingsKeys,
  organizationKeys,
  publicDirectoryKeys,
} from './queryKeys';

// ============================================================================
// Types
// ============================================================================

export interface OrgSettingsData {
  enableTeams?: boolean;
  visibility?: string;
  [key: string]: unknown;
}

export interface DiscordGuild {
  guildId: string;
  guildName: string;
  guildIconUrl?: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

// ============================================================================
// Settings Queries
// ============================================================================

export function useOrgSettings(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.settings(orgId ?? ''),
    queryFn: async (): Promise<OrgSettingsData> => {
      const response = await apiClient.get<{
        data?: { settings: OrgSettingsData };
        settings?: OrgSettingsData;
      }>(`/api/v2/organizations/${orgId}/settings`);
      const data = response?.data;
      return data?.data?.settings ?? data?.settings ?? {};
    },
    enabled: !!orgId,
  });
}

export function useUpdateOrgSettings(orgId: string | undefined) {
  // Invalidation lives in `meta.invalidates`; the global handler in
  // `queryClient.ts` calls invalidateQueries on success. Because this mutation
  // patches a JSONB column (Organization.settings), do NOT add an optimistic
  // setQueryData here — pair it with the JsonbDirtySubscriber server-side fix
  // so the refetch returns the real persisted value.
  return useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      await apiClient.patch(`/api/v2/organizations/${orgId}/settings`, updates);
    },
    meta: {
      invalidates: orgId ? [organizationKeys.settings(orgId), applicationKeys.mode(orgId)] : [],
    },
  });
}

// ============================================================================
// Discord Guild Queries
// ============================================================================

export function useDiscordGuilds(orgId: string | undefined) {
  return useQuery({
    queryKey: organizationKeys.discordGuilds(orgId ?? ''),
    queryFn: async (): Promise<DiscordGuild[]> => {
      const response = await apiClient.get<DiscordGuild[] | { data?: DiscordGuild[] }>(
        `/api/v2/organizations/${orgId}/discord/guilds`
      );
      // Handle both envelope shapes: { data: [...] } or direct array
      const payload = response?.data;
      const guilds = Array.isArray(payload) ? payload : (payload?.data ?? []);
      return guilds.filter((g: DiscordGuild) => g.isActive);
    },
    enabled: !!orgId,
  });
}

export function useDiscordGuildRoles(guildId: string | undefined) {
  return useQuery({
    queryKey: ['discord', 'guild', guildId, 'roles'],
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const response = await apiClient.get<{ roles: { id: string; name: string }[] }>(
        `/api/v2/discord/guilds/${guildId}/roles`
      );
      return response.data?.roles ?? [];
    },
    enabled: !!guildId,
    staleTime: 5 * 60 * 1000,
  });
}

export interface GuildMembershipStatus {
  isInGuild: boolean;
  displayName?: string;
  joinedAt?: string;
  roles?: { id: string; name: string; color?: string }[];
  reason?: string;
}

export function useMyGuildMembership(guildId: string | undefined) {
  const userId = useAuthStore(state => state.user?.id);
  return useQuery({
    // User-scoped: include userId so a previous user's guild membership cannot leak
    // into the next signed-in user's view (e.g. on a shared browser).
    queryKey: ['discord', 'guild', guildId, 'my-membership', userId ?? null],
    queryFn: async (): Promise<GuildMembershipStatus> => {
      const response = await apiClient.get<GuildMembershipStatus>(
        `/api/v2/discord/guilds/${guildId}/my-membership`
      );
      return response.data;
    },
    enabled: !!userId && !!guildId,
    staleTime: 2 * 60 * 1000,
  });
}

export function useDiscordGuildChannels(guildId: string | undefined) {
  return useQuery({
    queryKey: ['discord', 'guild', guildId, 'channels'],
    queryFn: async (): Promise<{ id: string; name: string; type: number }[]> => {
      const response = await apiClient.get<{
        channels?: { id: string; name: string; type: number }[];
        data?: { channels?: { id: string; name: string; type: number }[] };
      }>(`/api/v2/discord/guilds/${guildId}/channels`);
      return response.data?.channels ?? response.data?.data?.channels ?? [];
    },
    enabled: !!guildId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConnectDiscordGuild(orgId: string | undefined) {
  return useMutation({
    mutationFn: async (input: { guildId: string; guildName: string }) => {
      await apiClient.post(`/api/v2/organizations/${orgId}/discord/connect`, input);
    },
    meta: {
      invalidates: orgId ? [organizationKeys.discordGuilds(orgId)] : [],
    },
  });
}

export function useDisconnectDiscordGuild(orgId: string | undefined) {
  return useMutation({
    mutationFn: async (guildId: string) => {
      await apiClient.delete(`/api/v2/organizations/${orgId}/discord/disconnect/${guildId}`);
    },
    meta: {
      invalidates: orgId ? [organizationKeys.discordGuilds(orgId)] : [],
    },
  });
}

// ============================================================================
// Discord Guild Settings Queries
// ============================================================================

/**
 * Fetch all guild settings (all tabs) for a specific guild under an organization.
 * Replaces the manual loadSettings() + hydrateGuildSettings() useEffect pattern.
 * Data is cached and automatically refetched on mount and window focus.
 */
export function useGuildSettings(orgId: string | undefined, guildId: string | undefined) {
  return useQuery({
    queryKey: discordSettingsKeys.guild(orgId ?? '', guildId ?? ''),
    queryFn: (): Promise<GuildSettingsDTO> => discordService.getGuildSettings(orgId!, guildId!),
    enabled: !!orgId && !!guildId,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Invalidate the guild settings cache after any settings mutation.
 * Returns a callback that save handlers can call after a successful save
 * instead of manually re-fetching via hydrateGuildSettings().
 */
export function useInvalidateGuildSettings(orgId: string | undefined, guildId: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    if (orgId && guildId) {
      // eslint-disable-next-line no-restricted-syntax -- non-mutation callback (Refresh button / post-save); meta.invalidates doesn't apply
      queryClient.invalidateQueries({
        queryKey: discordSettingsKeys.guild(orgId, guildId),
      });
    }
  };
}

// ============================================================================
// Public Profile Queries
// ============================================================================

export function usePublicProfile(orgId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: organizationKeys.publicProfile(orgId ?? ''),
    queryFn: () => publicDirectoryService.getOwnProfile(orgId ?? ''),
    enabled: !!orgId && enabled,
  });
}

export function useUpdatePublicProfile(orgId: string | undefined) {
  return useMutation({
    mutationFn: async (data: ProfileUpdateInput): Promise<PublicOrgProfile> => {
      return publicDirectoryService.updateProfile(orgId ?? '', data);
    },
    meta: {
      // Public org cards on the directory listing read logo/banner from the same
      // profile — invalidate org listing + stats caches so updates appear
      // immediately instead of waiting for the 5-min staleTime to expire.
      invalidates: orgId
        ? [
            organizationKeys.publicProfile(orgId),
            publicDirectoryKeys.orgs(),
            publicDirectoryKeys.orgStats(),
          ]
        : [],
    },
  });
}
