/**
 * Member Audit & Intel Service (v2)
 *
 * API client for the Membership Audit & Intel subsystem:
 *  - Audit flags (list, get, create, resolve, stats)
 *  - Org watchlist (CRUD)
 *  - Member intel profile
 *
 * Wave 2.1 — Membership Audit & Intel (Phase F)
 */
import type {
  CreateManualFlagDto,
  CreateWatchlistEntryDto,
  ListFlagsQuery,
  ListWatchlistQuery,
  MemberFlagSummary,
  MemberIntelProfile,
  ResolveFlagDto,
  UpdateWatchlistEntryDto,
  UserFlagStats,
  WatchlistEntrySummary,
} from '@sc-fleet-manager/shared-types';

import { apiClient } from './apiClient';
import { BaseService, unwrapResponse } from './baseService';

/* ──────────────────────────────────────────────────────────────────── */
/*  Response wrappers (match backend PaginatedFlags / PaginatedWatchlist) */
/* ──────────────────────────────────────────────────────────────────── */

export interface PaginatedFlags {
  data: MemberFlagSummary[];
  pagination: {
    total: number;
    count: number;
    page: number;
    pageSize: number;
    hasMore: boolean;
    totalPages: number;
  };
}

export interface PaginatedWatchlist {
  data: WatchlistEntrySummary[];
  total: number;
  page: number;
  pageSize: number;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Service                                                            */
/* ──────────────────────────────────────────────────────────────────── */

class MemberAuditService extends BaseService {
  // All methods use orgUrl() with org-scoped V2 paths instead of basePath
  protected basePath = '/api/v2/intel';

  private orgUrl(orgId: string, path: string) {
    return `/api/v2/organizations/${orgId}/intel${path}`;
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Audit Flags                                                       */
  /* ═══════════════════════════════════════════════════════════════════ */

  async listFlags(orgId: string, query?: ListFlagsQuery): Promise<PaginatedFlags> {
    // apiClient.get() already returns the body — do not use unwrapResponse here
    // because PaginatedFlags has a .data field that unwrapResponse mistakes for an envelope.
    const response = await apiClient.get<PaginatedFlags>(this.orgUrl(orgId, '/audit/flags'), {
      params: query,
    });
    return response as unknown as PaginatedFlags;
  }

  async getFlagById(orgId: string, flagId: string): Promise<MemberFlagSummary> {
    const response = await apiClient.get<MemberFlagSummary>(
      this.orgUrl(orgId, `/audit/flags/${flagId}`)
    );
    return unwrapResponse<MemberFlagSummary>(response);
  }

  async createManualFlag(orgId: string, dto: CreateManualFlagDto): Promise<MemberFlagSummary> {
    const response = await apiClient.post<MemberFlagSummary>(
      this.orgUrl(orgId, '/audit/flags'),
      dto
    );
    return unwrapResponse<MemberFlagSummary>(response);
  }

  async resolveFlag(
    orgId: string,
    flagId: string,
    dto: ResolveFlagDto
  ): Promise<MemberFlagSummary> {
    const response = await apiClient.patch<MemberFlagSummary>(
      this.orgUrl(orgId, `/audit/flags/${flagId}/resolve`),
      dto
    );
    return unwrapResponse<MemberFlagSummary>(response);
  }

  async getUserFlagStats(orgId: string, userId: string): Promise<UserFlagStats> {
    const response = await apiClient.get<UserFlagStats>(
      this.orgUrl(orgId, `/audit/users/${userId}/stats`)
    );
    return unwrapResponse<UserFlagStats>(response);
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Org Watchlist                                                     */
  /* ═══════════════════════════════════════════════════════════════════ */

  async listWatchlistEntries(
    orgId: string,
    query?: ListWatchlistQuery
  ): Promise<PaginatedWatchlist> {
    // apiClient.get() already returns the body — do not unwrapResponse here
    // because PaginatedWatchlist has a .data field that unwrapResponse mistakes for an envelope.
    const response = await apiClient.get<PaginatedWatchlist>(this.orgUrl(orgId, '/watchlist'), {
      params: query,
    });
    return response as unknown as PaginatedWatchlist;
  }

  async getWatchlistEntry(orgId: string, entryId: string): Promise<WatchlistEntrySummary> {
    const response = await apiClient.get<WatchlistEntrySummary>(
      this.orgUrl(orgId, `/watchlist/${entryId}`)
    );
    return unwrapResponse<WatchlistEntrySummary>(response);
  }

  async createWatchlistEntry(
    orgId: string,
    dto: CreateWatchlistEntryDto
  ): Promise<WatchlistEntrySummary> {
    const response = await apiClient.post<WatchlistEntrySummary>(
      this.orgUrl(orgId, '/watchlist'),
      dto
    );
    return unwrapResponse<WatchlistEntrySummary>(response);
  }

  async updateWatchlistEntry(
    orgId: string,
    entryId: string,
    dto: UpdateWatchlistEntryDto
  ): Promise<WatchlistEntrySummary> {
    const response = await apiClient.patch<WatchlistEntrySummary>(
      this.orgUrl(orgId, `/watchlist/${entryId}`),
      dto
    );
    return unwrapResponse<WatchlistEntrySummary>(response);
  }

  async deleteWatchlistEntry(orgId: string, entryId: string): Promise<void> {
    await apiClient.delete(this.orgUrl(orgId, `/watchlist/${entryId}`));
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Member Profile                                                    */
  /* ═══════════════════════════════════════════════════════════════════ */

  async getMemberProfile(orgId: string, userId: string): Promise<MemberIntelProfile> {
    const response = await apiClient.get<MemberIntelProfile>(
      this.orgUrl(orgId, `/members/${userId}/profile`)
    );
    return unwrapResponse<MemberIntelProfile>(response);
  }
}

export const memberAuditService = new MemberAuditService();
