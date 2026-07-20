/**
 * Voice Server API Service
 *
 * Provides typed API calls for voice server configuration and stats.
 * Uses apiClient pattern matching federationManagementService.
 */

import type {
  AccessibleVoiceServer,
  UpdateVoiceServerConfigRequest,
  VoiceServerConfig,
  VoiceServerStats,
  VoiceServerStatus,
  VoiceServerWhitelistSuggestion,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { unwrapResponse } from './baseService';

const ORG_BASE = '/api/v2/organizations';
const FED_BASE = '/api/v2/federations';

export const voiceServerService = {
  // ── Organization ──────────────────────────────────────────

  async getOrgConfig(orgId: string): Promise<VoiceServerConfig | null> {
    const res = await apiClient.get<VoiceServerConfig | null>(
      `${ORG_BASE}/${orgId}/voice-server/config`
    );
    return unwrapResponse(res);
  },

  async getOrgStatus(orgId: string): Promise<VoiceServerStatus> {
    const res = await apiClient.get<VoiceServerStatus>(`${ORG_BASE}/${orgId}/voice-server/status`);
    return unwrapResponse(res);
  },

  async getOrgStats(orgId: string): Promise<VoiceServerStats | null> {
    const res = await apiClient.get<VoiceServerStats | null>(
      `${ORG_BASE}/${orgId}/voice-server/stats`
    );
    return unwrapResponse(res);
  },

  async updateOrgConfig(
    orgId: string,
    data: UpdateVoiceServerConfigRequest
  ): Promise<VoiceServerConfig | null> {
    const res = await apiClient.put<VoiceServerConfig | null>(
      `${ORG_BASE}/${orgId}/voice-server/config`,
      data
    );
    return unwrapResponse(res);
  },

  async deleteOrgConfig(orgId: string): Promise<void> {
    await apiClient.delete(`${ORG_BASE}/${orgId}/voice-server/config`);
  },

  async getOrgWhitelistSuggestions(orgId: string): Promise<VoiceServerWhitelistSuggestion[]> {
    const res = await apiClient.get<VoiceServerWhitelistSuggestion[]>(
      `${ORG_BASE}/${orgId}/voice-server/sharing/suggestions`
    );
    return unwrapResponse(res);
  },

  // ── Federation ────────────────────────────────────────────

  async getFedConfig(federationId: string): Promise<VoiceServerConfig | null> {
    const res = await apiClient.get<VoiceServerConfig | null>(
      `${FED_BASE}/${federationId}/voice-server/config`
    );
    return unwrapResponse(res);
  },

  async getFedStatus(federationId: string): Promise<VoiceServerStatus> {
    const res = await apiClient.get<VoiceServerStatus>(
      `${FED_BASE}/${federationId}/voice-server/status`
    );
    return unwrapResponse(res);
  },

  async getFedStats(federationId: string): Promise<VoiceServerStats | null> {
    const res = await apiClient.get<VoiceServerStats | null>(
      `${FED_BASE}/${federationId}/voice-server/stats`
    );
    return unwrapResponse(res);
  },

  async updateFedConfig(
    federationId: string,
    data: UpdateVoiceServerConfigRequest
  ): Promise<VoiceServerConfig | null> {
    const res = await apiClient.put<VoiceServerConfig | null>(
      `${FED_BASE}/${federationId}/voice-server/config`,
      data
    );
    return unwrapResponse(res);
  },

  async deleteFedConfig(federationId: string): Promise<void> {
    await apiClient.delete(`${FED_BASE}/${federationId}/voice-server/config`);
  },

  async getFedWhitelistSuggestions(
    federationId: string
  ): Promise<VoiceServerWhitelistSuggestion[]> {
    const res = await apiClient.get<VoiceServerWhitelistSuggestion[]>(
      `${FED_BASE}/${federationId}/voice-server/sharing/suggestions`
    );
    return unwrapResponse(res);
  },

  // ── Accessible voice servers (per-user) ────────────────

  async getAccessible(): Promise<AccessibleVoiceServer[]> {
    const res = await apiClient.get<AccessibleVoiceServer[]>('/api/v2/voice-server/accessible');
    return unwrapResponse(res);
  },
};
