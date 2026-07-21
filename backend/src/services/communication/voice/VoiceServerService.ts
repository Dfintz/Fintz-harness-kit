/**
 * VoiceServerService — Queries external voice servers and provides stats.
 *
 * Supports Mumble (ICE/gRPC), TeamSpeak (ServerQuery), and generic servers.
 * Platform-hosted Mumble access is gated by PLATFORM_MUMBLE_FEDERATION_ID.
 *
 * Pattern: Singleton (matches VoiceChannelService).
 * Does NOT extend TenantService — tenant isolation enforced at controller/route layer.
 */

import type {
  AccessibleVoiceServer,
  VoiceServerConfig,
  VoiceServerStats,
  VoiceServerStatus,
  VoiceServerWhitelistSuggestion,
} from '@sc-fleet-manager/shared-types';
import { In } from 'typeorm';

import { trackMetric } from '../../../config/applicationInsights';
import { AppDataSource } from '../../../data-source';
import {
  AllianceDiplomacy,
  AllianceType,
  DiplomacyStatus,
} from '../../../models/AllianceDiplomacy';
import { Federation } from '../../../models/Federation';
import { FederationMember } from '../../../models/FederationMember';
import { Organization } from '../../../models/Organization';
import { OrganizationMembership } from '../../../models/OrganizationMembership';
import {
  OrganizationRelationship,
  RelationshipStatus,
  RelationshipType,
} from '../../../models/OrganizationRelationship';
import { ForbiddenError, NotFoundError, ValidationError } from '../../../utils/apiErrors';
import { mapWithConcurrency } from '../../../utils/asyncConcurrency';
import { decrypt, encrypt } from '../../../utils/encryption';
import { logger } from '../../../utils/logger';
import { cache } from '../../../utils/redis';
import { isPrivateHostResolved } from '../../../utils/ssrfProtection';
import { PermissionManagerService } from '../../security/permissions/PermissionManagerService';

import { voiceAuditLogger } from './VoiceAuditLogger';

const VOICE_STATUS_CACHE_TTL = 60; // 1 minute
const VOICE_STATS_CACHE_TTL = 300; // 5 minutes
/** Longer TTL for CAS background job consumption — avoids blocking job with UDP I/O */
const VOICE_CAS_CACHE_TTL = 900; // 15 minutes (matches CAS job interval)
const TEAMSPEAK_QUERY_DEFAULT_PORT = 10011;

export class VoiceServerService {
  private static instance: VoiceServerService;
  private static readonly ACCESS_POLICY_CONCURRENCY = 6;

  private readonly orgRepo = AppDataSource.getRepository(Organization);
  private readonly fedRepo = AppDataSource.getRepository(Federation);
  private readonly fedMemberRepo = AppDataSource.getRepository(FederationMember);
  private readonly membershipRepo = AppDataSource.getRepository(OrganizationMembership);
  private readonly diplomacyRepo = AppDataSource.getRepository(AllianceDiplomacy);
  private readonly relationshipRepo = AppDataSource.getRepository(OrganizationRelationship);
  private readonly permissionManager = new PermissionManagerService();

  private constructor() {
    logger.info('VoiceServerService initialized');
  }

  public static getInstance(): VoiceServerService {
    if (!VoiceServerService.instance) {
      VoiceServerService.instance = new VoiceServerService();
    }
    return VoiceServerService.instance;
  }

  // ── Organization Voice Server ────────────────────────────────

  /**
   * Get voice server config for an organization (sanitized — no passwords).
   */
  async getOrgVoiceConfig(organizationId: string): Promise<VoiceServerConfig | null> {
    const org = await this.orgRepo.findOne({
      where: { id: organizationId },
      select: ['id', 'settings'],
    });
    if (!org) {
      throw new NotFoundError('Organization not found');
    }
    return this.sanitizeConfig(org.settings?.voiceServer ?? null);
  }

  /**
   * Get voice server config for an organization, enforcing per-server access policy.
   */
  async getOrgVoiceConfigForUser(
    organizationId: string,
    userId: string
  ): Promise<VoiceServerConfig | null> {
    const config = await this.getOrgVoiceConfigInternal(organizationId);
    if (!config?.enabled) {
      return this.sanitizeConfig(config ?? null);
    }

    await this.verifyAccess(userId, config, organizationId);
    return this.sanitizeConfig(config);
  }

  /**
   * Get live status of an organization's voice server.
   */
  async getOrgVoiceStatus(organizationId: string): Promise<VoiceServerStatus> {
    const config = await this.getOrgVoiceConfigInternal(organizationId);
    if (!config?.enabled) {
      return { online: false, currentUsers: 0, maxUsers: 0 };
    }
    return this.queryServerStatus(config, `org:${organizationId}`);
  }

  /**
   * Get live status of an organization's voice server, enforcing per-server access policy.
   */
  async getOrgVoiceStatusForUser(
    organizationId: string,
    userId: string
  ): Promise<VoiceServerStatus> {
    const config = await this.getOrgVoiceConfigInternal(organizationId);
    if (!config?.enabled) {
      return { online: false, currentUsers: 0, maxUsers: 0 };
    }

    await this.verifyAccess(userId, config, organizationId);
    return this.queryServerStatus(config, `org:${organizationId}`);
  }

  /**
   * Get aggregated stats for an organization's voice server.
   */
  async getOrgVoiceStats(organizationId: string): Promise<VoiceServerStats | null> {
    const config = await this.getOrgVoiceConfigInternal(organizationId);
    if (!config?.enabled) {
      return null;
    }
    return this.buildStats(config, `org:${organizationId}`);
  }

  /**
   * Get aggregated stats for an organization's voice server, enforcing per-server access policy.
   */
  async getOrgVoiceStatsForUser(
    organizationId: string,
    userId: string
  ): Promise<VoiceServerStats | null> {
    const config = await this.getOrgVoiceConfigInternal(organizationId);
    if (!config?.enabled) {
      return null;
    }

    await this.verifyAccess(userId, config, organizationId);
    return this.buildStats(config, `org:${organizationId}`);
  }

  /**
   * Update voice server config for an organization.
   * Uses jsonb_set to avoid clobbering concurrent settings writes.
   */
  async updateOrgVoiceConfig(
    organizationId: string,
    userId: string,
    body: Record<string, unknown>
  ): Promise<VoiceServerConfig | null> {
    const org = await this.orgRepo.findOne({
      where: { id: organizationId },
      select: ['id', 'settings'],
    });
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const config = this.buildConfig(body);
    const isNew = !org.settings?.voiceServer?.enabled;

    // Atomic jsonb_set — avoids read-modify-write race on shared settings column
    await AppDataSource.query(
      `UPDATE organizations SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{voiceServer}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify(config), organizationId]
    );

    if (isNew) {
      voiceAuditLogger.logConfigCreated(
        organizationId,
        'organization',
        organizationId,
        userId,
        config.serverType,
        config.host,
        config.port
      );
    } else {
      voiceAuditLogger.logConfigUpdated(organizationId, 'organization', organizationId, userId, {
        serverType: config.serverType,
        host: config.host,
        port: config.port,
      });
    }

    return this.getOrgVoiceConfig(organizationId);
  }

  /**
   * Delete voice server config from an organization.
   */
  async deleteOrgVoiceConfig(organizationId: string, userId: string): Promise<void> {
    const org = await this.orgRepo.findOne({ where: { id: organizationId }, select: ['id'] });
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    await AppDataSource.query(
      `UPDATE organizations SET settings = settings - 'voiceServer' WHERE id = $1`,
      [organizationId]
    );

    voiceAuditLogger.logConfigDeleted(organizationId, 'organization', organizationId, userId);
  }

  // ── Whitelist Suggestions ────────────────────────────────────

  /** Positive relationship types that qualify for voice-sharing suggestions */
  private static readonly POSITIVE_RELATIONSHIP_TYPES: RelationshipType[] = [
    RelationshipType.ALLIED,
    RelationshipType.PARTNERSHIP,
    RelationshipType.COOPERATIVE,
    RelationshipType.AFFILIATED,
    RelationshipType.TRADING_PARTNER,
  ];

  /** Human-readable labels for alliance types */
  private static readonly ALLIANCE_TYPE_LABELS: Record<AllianceType, string> = {
    [AllianceType.TRADE]: 'Trade Alliance',
    [AllianceType.MILITARY]: 'Military Alliance',
    [AllianceType.MUTUAL_DEFENSE]: 'Mutual Defense',
    [AllianceType.NON_AGGRESSION]: 'Non-Aggression Pact',
    [AllianceType.FULL_ALLIANCE]: 'Full Alliance',
  };

  /** Human-readable labels for positive relationship types */
  private static readonly RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
    [RelationshipType.ALLIED]: 'Allied',
    [RelationshipType.PARTNERSHIP]: 'Partnership',
    [RelationshipType.COOPERATIVE]: 'Cooperative',
    [RelationshipType.AFFILIATED]: 'Affiliated',
    [RelationshipType.TRADING_PARTNER]: 'Trading Partner',
  };

  /**
   * Get whitelist suggestions for an organization based on:
   * 1. Federation memberships — other orgs in the same federations
   * 2. Active alliance diplomacy — trade, military, mutual defense, etc.
   * 3. Positive organization relationships — allied, partnership, cooperative, etc.
   *
   * Each suggestion is de-duplicated by targetId and tagged with its source.
   */
  async getWhitelistSuggestions(organizationId: string): Promise<VoiceServerWhitelistSuggestion[]> {
    const org = await this.orgRepo.findOne({
      where: { id: organizationId },
      select: ['id', 'settings'],
    });
    if (!org) {
      throw new NotFoundError('Organization not found');
    }

    const currentWhitelist = org.settings?.voiceServer?.sharing?.whitelist ?? [];
    const whitelistedIds = new Set(currentWhitelist.map(e => e.targetId));

    // Collect suggestions keyed by targetId to de-duplicate
    const suggestions = new Map<string, VoiceServerWhitelistSuggestion>();

    // 1. Federation memberships — suggest federations the org belongs to
    //    plus other member orgs in those federations
    await this.addFederationSuggestions(organizationId, whitelistedIds, suggestions);

    // 2. Active alliance diplomacy — suggest orgs with active alliances
    await this.addDiplomacySuggestions(organizationId, whitelistedIds, suggestions);

    // 3. Positive organization relationships — suggest orgs with positive relationship types
    await this.addRelationshipSuggestions(organizationId, whitelistedIds, suggestions);

    return Array.from(suggestions.values());
  }

  /**
   * Get whitelist suggestions for a federation, verifying the caller has access.
   */
  async getFederationWhitelistSuggestionsForUser(
    federationId: string,
    userId: string
  ): Promise<VoiceServerWhitelistSuggestion[]> {
    await this.requireUserFederationAccess(userId, federationId);
    return this.getFederationWhitelistSuggestions(federationId);
  }

  /**
   * Get whitelist suggestions for a federation based on:
   * 1. Active member organizations in this federation
   * 2. Other federations that share member organizations
   * 3. Active alliance diplomacy from member organizations
   * 4. Positive organization relationships from member organizations
   */
  async getFederationWhitelistSuggestions(
    federationId: string
  ): Promise<VoiceServerWhitelistSuggestion[]> {
    const fed = await this.fedRepo.findOne({
      where: { id: federationId },
      select: ['id', 'settings'],
    });
    if (!fed) {
      throw new NotFoundError('Federation not found');
    }

    const currentWhitelist = fed.settings?.voiceServer?.sharing?.whitelist ?? [];
    const whitelistedIds = new Set(currentWhitelist.map(e => e.targetId));
    const suggestions = new Map<string, VoiceServerWhitelistSuggestion>();

    const memberEntries = await this.fedMemberRepo.find({
      where: { federationId, status: 'active' as const },
      select: ['organizationId', 'organizationName'],
    });
    const memberOrgIds = [...new Set(memberEntries.map(m => m.organizationId))];
    this.addFederationMemberOrganizationSuggestions(memberEntries, whitelistedIds, suggestions);

    if (memberOrgIds.length === 0) {
      return Array.from(suggestions.values());
    }

    const memberOrgIdSet = new Set(memberOrgIds);

    await this.addSharedFederationSuggestions(
      federationId,
      memberOrgIds,
      whitelistedIds,
      suggestions
    );
    await this.addFederationAllianceSuggestions(memberOrgIdSet, whitelistedIds, suggestions);
    await this.addFederationRelationshipSuggestions(memberOrgIdSet, whitelistedIds, suggestions);

    return Array.from(suggestions.values());
  }

  private addFederationMemberOrganizationSuggestions(
    memberEntries: Array<{ organizationId: string; organizationName?: string }>,
    whitelistedIds: Set<string>,
    suggestions: Map<string, VoiceServerWhitelistSuggestion>
  ): void {
    for (const member of memberEntries) {
      if (suggestions.has(member.organizationId)) {
        continue;
      }

      suggestions.set(member.organizationId, {
        type: 'organization',
        targetId: member.organizationId,
        targetName: member.organizationName || member.organizationId,
        source: 'federation_membership',
        sourceLabel: 'Federation Member Organization',
        alreadyWhitelisted: whitelistedIds.has(member.organizationId),
      });
    }
  }

  private async addSharedFederationSuggestions(
    federationId: string,
    memberOrgIds: string[],
    whitelistedIds: Set<string>,
    suggestions: Map<string, VoiceServerWhitelistSuggestion>
  ): Promise<void> {
    const sharedMemberships = await this.fedMemberRepo.find({
      where: memberOrgIds.map(organizationId => ({
        organizationId,
        status: 'active' as const,
      })),
      select: ['federationId', 'organizationId'],
    });

    const sharedFedCounts = new Map<string, number>();
    for (const membership of sharedMemberships) {
      if (membership.federationId === federationId) {
        continue;
      }
      sharedFedCounts.set(
        membership.federationId,
        (sharedFedCounts.get(membership.federationId) ?? 0) + 1
      );
    }

    const sharedFedIds = Array.from(sharedFedCounts.keys());
    if (sharedFedIds.length === 0) {
      return;
    }

    const sharedFeds = await this.fedRepo.find({
      where: { id: In(sharedFedIds) },
      select: ['id', 'name'],
    });

    for (const sharedFed of sharedFeds) {
      if (suggestions.has(sharedFed.id)) {
        continue;
      }

      const sharedMemberCount = sharedFedCounts.get(sharedFed.id) ?? 0;
      suggestions.set(sharedFed.id, {
        type: 'federation',
        targetId: sharedFed.id,
        targetName: sharedFed.name,
        source: 'federation_membership',
        sourceLabel:
          sharedMemberCount === 1
            ? 'Shared Member Organization'
            : `Shared Member Organizations (${sharedMemberCount})`,
        alreadyWhitelisted: whitelistedIds.has(sharedFed.id),
      });
    }
  }

  private async addFederationAllianceSuggestions(
    memberOrgIdSet: Set<string>,
    whitelistedIds: Set<string>,
    suggestions: Map<string, VoiceServerWhitelistSuggestion>
  ): Promise<void> {
    const memberOrgIds = Array.from(memberOrgIdSet);
    const alliances = await this.diplomacyRepo.find({
      where: memberOrgIds.flatMap(orgId => [
        { orgId1: orgId, status: DiplomacyStatus.ACTIVE },
        { orgId2: orgId, status: DiplomacyStatus.ACTIVE },
      ]),
      select: ['orgId1', 'orgId2', 'allianceType'],
    });

    if (alliances.length === 0) {
      return;
    }

    const partnerIds = [
      ...new Set(
        alliances
          .map(alliance =>
            this.resolveExternalPartnerId(alliance.orgId1, alliance.orgId2, memberOrgIdSet)
          )
          .filter((value): value is string => !!value)
      ),
    ];

    const nameMap = await this.loadOrganizationNameMap(partnerIds);

    for (const alliance of alliances) {
      const partnerId = this.resolveExternalPartnerId(
        alliance.orgId1,
        alliance.orgId2,
        memberOrgIdSet
      );
      if (!partnerId || suggestions.has(partnerId)) {
        continue;
      }

      const label = VoiceServerService.ALLIANCE_TYPE_LABELS[alliance.allianceType] ?? 'Alliance';
      suggestions.set(partnerId, {
        type: 'organization',
        targetId: partnerId,
        targetName: nameMap.get(partnerId) ?? partnerId,
        source: 'alliance_diplomacy',
        sourceLabel: label,
        alreadyWhitelisted: whitelistedIds.has(partnerId),
      });
    }
  }

  private async addFederationRelationshipSuggestions(
    memberOrgIdSet: Set<string>,
    whitelistedIds: Set<string>,
    suggestions: Map<string, VoiceServerWhitelistSuggestion>
  ): Promise<void> {
    const memberOrgIds = Array.from(memberOrgIdSet);
    const relationships = await this.relationshipRepo.find({
      where: memberOrgIds.flatMap(orgId =>
        VoiceServerService.POSITIVE_RELATIONSHIP_TYPES.map(type => ({
          organizationId: orgId,
          type,
          status: RelationshipStatus.ACTIVE,
        }))
      ),
      select: ['targetOrganizationId', 'type'],
    });

    if (relationships.length === 0) {
      return;
    }

    const targetIds = [
      ...new Set(
        relationships
          .map(rel => rel.targetOrganizationId)
          .filter(id => !memberOrgIdSet.has(id) && !suggestions.has(id))
      ),
    ];

    const nameMap = await this.loadOrganizationNameMap(targetIds);

    for (const relationship of relationships) {
      const targetId = relationship.targetOrganizationId;
      if (memberOrgIdSet.has(targetId) || suggestions.has(targetId)) {
        continue;
      }

      const label =
        VoiceServerService.RELATIONSHIP_TYPE_LABELS[relationship.type] ?? 'Positive Relationship';
      suggestions.set(targetId, {
        type: 'organization',
        targetId,
        targetName: nameMap.get(targetId) ?? targetId,
        source: 'organization_relationship',
        sourceLabel: label,
        alreadyWhitelisted: whitelistedIds.has(targetId),
      });
    }
  }

  private resolveExternalPartnerId(
    orgId1: string,
    orgId2: string,
    memberOrgIdSet: Set<string>
  ): string | null {
    const firstIsMember = memberOrgIdSet.has(orgId1);
    const secondIsMember = memberOrgIdSet.has(orgId2);

    if (firstIsMember === secondIsMember) {
      return null;
    }

    return firstIsMember ? orgId2 : orgId1;
  }

  private async loadOrganizationNameMap(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) {
      return new Map();
    }

    const orgs = await this.orgRepo.find({
      where: { id: In(ids) },
      select: ['id', 'name'],
    });

    return new Map(orgs.map(org => [org.id, org.name]));
  }

  /**
   * Add suggestions from federation memberships.
   * Suggests: the federation itself + all other active member orgs.
   */
  private async addFederationSuggestions(
    organizationId: string,
    whitelistedIds: Set<string>,
    suggestions: Map<string, VoiceServerWhitelistSuggestion>
  ): Promise<void> {
    // Find federations this org belongs to
    const myMemberships = await this.fedMemberRepo.find({
      where: { organizationId, status: 'active' as const },
      select: ['federationId'],
    });

    if (myMemberships.length === 0) {
      return;
    }

    const federationIds = myMemberships.map(m => m.federationId);

    // Fetch federation details
    const federations = await this.fedRepo
      .createQueryBuilder('f')
      .where('f.id IN (:...ids)', { ids: federationIds })
      .select(['f.id', 'f.name'])
      .getMany();

    for (const fed of federations) {
      if (!suggestions.has(fed.id)) {
        suggestions.set(fed.id, {
          type: 'federation',
          targetId: fed.id,
          targetName: fed.name,
          source: 'federation_membership',
          sourceLabel: 'Federation Member',
          alreadyWhitelisted: whitelistedIds.has(fed.id),
        });
      }
    }

    // Fetch other active member orgs in those federations
    const otherMembers = await this.fedMemberRepo
      .createQueryBuilder('fm')
      .where('fm."federationId" IN (:...fedIds)', { fedIds: federationIds })
      .andWhere('fm."organizationId" != :orgId', { orgId: organizationId })
      .andWhere('fm.status = :status', { status: 'active' })
      .select(['fm."organizationId"', 'fm."organizationName"', 'fm."federationId"'])
      .getRawMany<{ organizationId: string; organizationName: string; federationId: string }>();

    // Map federationId → name for labels
    const fedNameMap = new Map(federations.map(f => [f.id, f.name]));

    for (const member of otherMembers) {
      if (!suggestions.has(member.organizationId)) {
        const fedName = fedNameMap.get(member.federationId) ?? 'Federation';
        suggestions.set(member.organizationId, {
          type: 'organization',
          targetId: member.organizationId,
          targetName: member.organizationName || member.organizationId,
          source: 'federation_membership',
          sourceLabel: `Co-member of ${fedName}`,
          alreadyWhitelisted: whitelistedIds.has(member.organizationId),
        });
      }
    }
  }

  /**
   * Add suggestions from active alliance diplomacy entries.
   */
  private async addDiplomacySuggestions(
    organizationId: string,
    whitelistedIds: Set<string>,
    suggestions: Map<string, VoiceServerWhitelistSuggestion>
  ): Promise<void> {
    const activeAlliances = await this.diplomacyRepo.find({
      where: [
        { orgId1: organizationId, status: DiplomacyStatus.ACTIVE },
        { orgId2: organizationId, status: DiplomacyStatus.ACTIVE },
      ],
      select: ['orgId1', 'orgId2', 'allianceType'],
    });

    if (activeAlliances.length === 0) {
      return;
    }

    // Resolve partner org IDs
    const partnerOrgIds = activeAlliances.map(a =>
      a.orgId1 === organizationId ? a.orgId2 : a.orgId1
    );

    // Fetch org names
    const orgs = await this.orgRepo
      .createQueryBuilder('o')
      .where('o.id IN (:...ids)', { ids: partnerOrgIds })
      .select(['o.id', 'o.name'])
      .getMany();
    const orgNameMap = new Map(orgs.map(o => [o.id, o.name]));

    for (const alliance of activeAlliances) {
      const partnerId = alliance.orgId1 === organizationId ? alliance.orgId2 : alliance.orgId1;
      if (!suggestions.has(partnerId)) {
        const label = VoiceServerService.ALLIANCE_TYPE_LABELS[alliance.allianceType] ?? 'Alliance';
        suggestions.set(partnerId, {
          type: 'organization',
          targetId: partnerId,
          targetName: orgNameMap.get(partnerId) ?? partnerId,
          source: 'alliance_diplomacy',
          sourceLabel: label,
          alreadyWhitelisted: whitelistedIds.has(partnerId),
        });
      }
    }
  }

  /**
   * Add suggestions from positive organization relationships.
   */
  private async addRelationshipSuggestions(
    organizationId: string,
    whitelistedIds: Set<string>,
    suggestions: Map<string, VoiceServerWhitelistSuggestion>
  ): Promise<void> {
    const positiveRelationships = await this.relationshipRepo.find({
      where: [
        {
          organizationId,
          type: RelationshipType.ALLIED,
          status: RelationshipStatus.ACTIVE,
        },
        {
          organizationId,
          type: RelationshipType.PARTNERSHIP,
          status: RelationshipStatus.ACTIVE,
        },
        {
          organizationId,
          type: RelationshipType.COOPERATIVE,
          status: RelationshipStatus.ACTIVE,
        },
        {
          organizationId,
          type: RelationshipType.AFFILIATED,
          status: RelationshipStatus.ACTIVE,
        },
        {
          organizationId,
          type: RelationshipType.TRADING_PARTNER,
          status: RelationshipStatus.ACTIVE,
        },
      ],
      select: ['targetOrganizationId', 'type'],
    });

    if (positiveRelationships.length === 0) {
      return;
    }

    // Fetch target org names
    const targetIds = positiveRelationships.map(r => r.targetOrganizationId);
    const orgs = await this.orgRepo
      .createQueryBuilder('o')
      .where('o.id IN (:...ids)', { ids: targetIds })
      .select(['o.id', 'o.name'])
      .getMany();
    const orgNameMap = new Map(orgs.map(o => [o.id, o.name]));

    for (const rel of positiveRelationships) {
      const targetId = rel.targetOrganizationId;
      if (!suggestions.has(targetId)) {
        const label =
          VoiceServerService.RELATIONSHIP_TYPE_LABELS[rel.type] ?? 'Positive Relationship';
        suggestions.set(targetId, {
          type: 'organization',
          targetId,
          targetName: orgNameMap.get(targetId) ?? targetId,
          source: 'organization_relationship',
          sourceLabel: label,
          alreadyWhitelisted: whitelistedIds.has(targetId),
        });
      }
    }
  }

  // ── RSI SID Lookups ───────────────────────────────────────────

  /**
   * Resolve organization by RSI SID.
   * Enforces tenant scoping — org must belong to requesting user's tenant.
   * Used by voice settings RSI SID lookup UI.
   *
   * @param rsiSid Organization's RSI identifier (1-10 uppercase alphanumeric)
   * @param tenantOrgId Requesting user's organization ID (for tenant scoping)
   * @returns Organization ID and name
   * @throws ValidationError if RSI SID format is invalid
   * @throws NotFoundError if no org with that RSI SID exists
   * @throws ForbiddenError if org belongs to different tenant
   */
  async getOrganizationByRsiSid(
    rsiSid: string,
    tenantOrgId: string
  ): Promise<{ id: string; name: string }> {
    // Validate RSI SID format (enforced at controller layer too, but defense-in-depth)
    if (!/^[A-Z0-9]{1,10}$/.test(rsiSid)) {
      throw new ValidationError('Invalid RSI SID format');
    }

    // Find organization by RSI SID
    const org = await this.orgRepo.findOne({
      where: { rsiSid },
      select: ['id', 'name', 'rootOrgId'],
    });

    if (!org) {
      throw new NotFoundError(`Organization with RSI SID "${rsiSid}" not found`);
    }

    // Get requesting user's org to verify tenant scoping
    const tenantOrg = await this.orgRepo.findOne({
      where: { id: tenantOrgId },
      select: ['rootOrgId'],
    });

    if (!tenantOrg) {
      throw new NotFoundError('Requesting organization not found');
    }

    // Tenant scoping: requesting user's org and found org must share same root
    if (org.rootOrgId !== tenantOrg.rootOrgId) {
      throw new ForbiddenError('Cross-tenant access denied');
    }

    logger.debug(`RSI SID lookup succeeded: ${rsiSid} → org ${org.id}`);

    return { id: org.id, name: org.name };
  }

  /**
   * Get federations with positive relationships for user's organization.
   * Returns only federations where:
   * 1. User's organization is an active member
   * 2. Relationship type is positive (ALLIED, PARTNERSHIP, COOPERATIVE, etc.)
   * 3. Relationship status is ACTIVE
   *
   * Used by voice settings federation auto-population.
   *
   * @param userId User ID (for membership verification)
   * @param organizationId User's organization ID (for member lookup + relationship filtering)
   * @returns List of federations with positive relationships
   * @throws ForbiddenError if user is not in organization
   */
  async getFederationsWithPositiveRelationshipsForUser(
    userId: string,
    organizationId: string
  ): Promise<Array<{ id: string; name: string; isMember: boolean }>> {
    // Verify user is in the organization
    const membership = await this.membershipRepo.findOne({
      where: { userId, organizationId },
      select: ['id'],
    });

    if (!membership) {
      throw new ForbiddenError('User is not a member of this organization');
    }

    // Get all federations user's org is a member of (active membership only)
    const fedMembers = await this.fedMemberRepo.find({
      where: { organizationId, status: 'active' as const },
      relations: ['federation'],
      select: ['federationId', 'federation'],
    });

    if (fedMembers.length === 0) {
      logger.debug(`No federation memberships for org ${organizationId}`);
      return [];
    }

    // Filter and map federations to include membership status
    const result = fedMembers
      .filter(fm => fm.federation) // Ensure federation is loaded
      .map(fm => ({
        id: fm.federation!.id,
        name: fm.federation!.name,
        isMember: true,
      }));

    logger.debug(`Federation lookup for org ${organizationId}: found ${result.length} federations`);

    return result;
  }

  // ── Accessible Voice Servers (per-user) ──────────────────────

  /**
   * List every voice server the given user can connect to.
   *
   * Sources:
   *   1. `organization` — voice servers belonging to orgs the user is an active member of.
   *   2. `federation`   — voice servers belonging to federations the user's orgs belong to.
   *   3. `shared`       — voice servers belonging to OTHER orgs or federations whose
   *                       `voiceServer.sharing.whitelist` includes one of the user's orgs
   *                       or federations.
   *
   * Returns sanitised configs (no passwords or ICE secrets).
   */
  async listAccessibleVoiceServers(userId: string): Promise<AccessibleVoiceServer[]> {
    const userOrgIds = await this.loadUserOrgIds(userId);
    if (userOrgIds.length === 0) {
      return [];
    }
    const userFedIds = await this.loadUserFedIds(userOrgIds);

    const [ownOrgServers, ownFederationServers, sharedOrgServers, sharedFederationServers] =
      await Promise.all([
        this.loadOwnOrgVoiceServers(userOrgIds),
        this.loadOwnFederationVoiceServers(userFedIds),
        this.loadSharedOrgVoiceServers(userOrgIds, userFedIds),
        this.loadSharedFederationVoiceServers(userOrgIds, userFedIds),
      ]);

    const results: AccessibleVoiceServer[] = [
      ...ownOrgServers,
      ...ownFederationServers,
      ...sharedOrgServers,
      ...sharedFederationServers,
    ];

    const authorized = await this.filterAccessibleByPolicy(userId, results);
    await this.attachLiveStatus(authorized);
    return authorized;
  }

  /** Active organization memberships for a user. */
  private async loadUserOrgIds(userId: string): Promise<string[]> {
    const memberships = await this.membershipRepo
      .createQueryBuilder('om')
      .where('om."userId" = :userId', { userId })
      .andWhere('om."isActive" = true')
      .select('om."organizationId"', 'organizationId')
      .getRawMany<{ organizationId: string }>();
    return [...new Set(memberships.map(m => m.organizationId))];
  }

  /** Federations the given orgs belong to (active memberships). */
  private async loadUserFedIds(userOrgIds: string[]): Promise<string[]> {
    if (userOrgIds.length === 0) {
      return [];
    }
    const fedMemberships = await this.fedMemberRepo
      .createQueryBuilder('fm')
      .where('fm."organizationId" IN (:...orgIds)', { orgIds: userOrgIds })
      .andWhere('fm.status = :status', { status: 'active' as const })
      .select('fm."federationId"', 'federationId')
      .getRawMany<{ federationId: string }>();
    return [...new Set(fedMemberships.map(m => m.federationId))];
  }

  /** Voice servers configured on the user's own organizations. */
  private async loadOwnOrgVoiceServers(userOrgIds: string[]): Promise<AccessibleVoiceServer[]> {
    const orgs = await this.orgRepo
      .createQueryBuilder('o')
      .where('o.id IN (:...ids)', { ids: userOrgIds })
      .select(['o.id', 'o.name', 'o.settings'])
      .getMany();
    return this.collectVoiceServers(orgs, 'organization', 'organization');
  }

  /** Voice servers configured on the user's own federations. */
  private async loadOwnFederationVoiceServers(
    userFedIds: string[]
  ): Promise<AccessibleVoiceServer[]> {
    if (userFedIds.length === 0) {
      return [];
    }
    const feds = await this.fedRepo
      .createQueryBuilder('f')
      .where('f.id IN (:...ids)', { ids: userFedIds })
      .select(['f.id', 'f.name', 'f.settings'])
      .getMany();
    return this.collectVoiceServers(feds, 'federation', 'federation');
  }

  /** Third-party org voice servers whose sharing whitelist matches the user's orgs/feds. */
  private async loadSharedOrgVoiceServers(
    userOrgIds: string[],
    userFedIds: string[]
  ): Promise<AccessibleVoiceServer[]> {
    const shareTargetIds = [...userOrgIds, ...userFedIds];
    const sharedOrgs = await this.orgRepo
      .createQueryBuilder('o')
      .where("(o.settings -> 'voiceServer' ->> 'enabled')::boolean = true")
      .andWhere("(o.settings -> 'voiceServer' -> 'sharing' ->> 'enabled')::boolean = true")
      .andWhere('o.id NOT IN (:...ownOrgIds)', { ownOrgIds: userOrgIds })
      .andWhere(
        `EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            COALESCE(o.settings -> 'voiceServer' -> 'sharing' -> 'whitelist', '[]'::jsonb)
          ) entry
          WHERE entry ->> 'targetId' = ANY(:targetIds)
        )`,
        { targetIds: shareTargetIds }
      )
      .select(['o.id', 'o.name', 'o.settings'])
      .getMany();
    return this.collectVoiceServers(sharedOrgs, 'organization', 'shared', cfg =>
      this.whitelistMatches(cfg, userOrgIds, userFedIds)
    );
  }

  /** Third-party federation voice servers whose sharing whitelist matches the user's orgs/feds. */
  private async loadSharedFederationVoiceServers(
    userOrgIds: string[],
    userFedIds: string[]
  ): Promise<AccessibleVoiceServer[]> {
    const shareTargetIds = [...userOrgIds, ...userFedIds];
    const qb = this.fedRepo
      .createQueryBuilder('f')
      .where("(f.settings -> 'voiceServer' ->> 'enabled')::boolean = true")
      .andWhere("(f.settings -> 'voiceServer' -> 'sharing' ->> 'enabled')::boolean = true")
      .andWhere(
        `EXISTS (
          SELECT 1 FROM jsonb_array_elements(
            COALESCE(f.settings -> 'voiceServer' -> 'sharing' -> 'whitelist', '[]'::jsonb)
          ) entry
          WHERE entry ->> 'targetId' = ANY(:targetIds)
        )`,
        { targetIds: shareTargetIds }
      );
    if (userFedIds.length > 0) {
      qb.andWhere('f.id NOT IN (:...ownFedIds)', { ownFedIds: userFedIds });
    }
    qb.select(['f.id', 'f.name', 'f.settings']);
    const sharedFeds = await qb.getMany();
    return this.collectVoiceServers(sharedFeds, 'federation', 'shared', cfg =>
      this.whitelistMatches(cfg, userOrgIds, userFedIds)
    );
  }

  /** Map owner entities (org/federation) with a voiceServer config into AccessibleVoiceServer entries. */
  private collectVoiceServers(
    owners: Array<{ id: string; name: string; settings?: { voiceServer?: VoiceServerConfig } }>,
    ownerType: 'organization' | 'federation',
    scope: AccessibleVoiceServer['scope'],
    extraFilter?: (cfg: VoiceServerConfig) => boolean
  ): AccessibleVoiceServer[] {
    const out: AccessibleVoiceServer[] = [];
    for (const owner of owners) {
      const cfg = owner.settings?.voiceServer;
      if (!cfg?.enabled) {
        continue;
      }
      if (extraFilter && !extraFilter(cfg)) {
        continue;
      }
      const sanitised = this.sanitizeConfig(cfg);
      if (!sanitised) {
        continue;
      }
      out.push({
        scope,
        ownerType,
        ownerId: owner.id,
        ownerName: owner.name,
        config: sanitised,
      });
    }
    return out;
  }

  /** Whether a voice server config's sharing whitelist matches any of the caller's orgs/feds. */
  private whitelistMatches(
    cfg: VoiceServerConfig | null | undefined,
    userOrgIds: string[],
    userFedIds: string[]
  ): boolean {
    return (
      cfg?.sharing?.whitelist?.some(
        e =>
          (e.type === 'organization' && userOrgIds.includes(e.targetId)) ||
          (e.type === 'federation' && userFedIds.includes(e.targetId))
      ) ?? false
    );
  }

  /** Enrich accessible voice servers with live status in parallel; tolerate per-entry failures. */
  private async attachLiveStatus(results: AccessibleVoiceServer[]): Promise<void> {
    await Promise.all(
      results.map(async (entry: AccessibleVoiceServer) => {
        try {
          const cachePrefix =
            entry.ownerType === 'organization' ? `org:${entry.ownerId}` : `fed:${entry.ownerId}`;
          entry.status = await this.queryServerStatus(entry.config, cachePrefix);
        } catch (err: unknown) {
          logger.warn('Failed to load voice status for accessible server', {
            ownerType: entry.ownerType,
            ownerId: entry.ownerId,
            error: err instanceof Error ? err.message : String(err),
          });
          entry.status = null;
        }
      })
    );
  }

  /**
   * Apply per-server access policy before exposing entries to the caller.
   * Server entries that fail access checks are omitted from the response.
   */
  private async filterAccessibleByPolicy(
    userId: string,
    entries: AccessibleVoiceServer[]
  ): Promise<AccessibleVoiceServer[]> {
    const checkedEntries = await mapWithConcurrency(
      entries,
      VoiceServerService.ACCESS_POLICY_CONCURRENCY,
      async (entry: AccessibleVoiceServer) => {
        try {
          await this.verifyAccess(
            userId,
            entry.config,
            entry.ownerType === 'organization' ? entry.ownerId : undefined
          );
          return entry;
        } catch (error: unknown) {
          logger.debug('Filtered inaccessible voice server entry', {
            userId,
            ownerType: entry.ownerType,
            ownerId: entry.ownerId,
            scope: entry.scope,
            reason: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }
    );

    return checkedEntries.filter((entry): entry is AccessibleVoiceServer => entry !== null);
  }

  // ── Federation Voice Server ──────────────────────────────────

  /**
   * Get voice server config for a federation (sanitized — no passwords).
   * Internal use only (e.g. platform status). Does NOT verify membership.
   */
  async getFederationVoiceConfig(federationId: string): Promise<VoiceServerConfig | null> {
    const fed = await this.fedRepo.findOne({
      where: { id: federationId },
      select: ['id', 'settings'],
    });
    if (!fed) {
      throw new NotFoundError('Federation not found');
    }
    return this.sanitizeConfig(fed.settings?.voiceServer ?? null);
  }

  /**
   * Get voice server config for a federation — verifies the user is a member.
   */
  async getFederationVoiceConfigForUser(
    federationId: string,
    userId: string
  ): Promise<VoiceServerConfig | null> {
    await this.requireUserFederationAccess(userId, federationId);
    return this.getFederationVoiceConfig(federationId);
  }

  /**
   * Get live status of a federation's voice server — verifies user membership.
   */
  async getFederationVoiceStatusForUser(
    federationId: string,
    userId: string
  ): Promise<VoiceServerStatus> {
    await this.requireUserFederationAccess(userId, federationId);
    return this.getFederationVoiceStatus(federationId);
  }

  /**
   * Get aggregated stats for a federation's voice server — verifies user membership.
   */
  async getFederationVoiceStatsForUser(
    federationId: string,
    userId: string
  ): Promise<VoiceServerStats | null> {
    await this.requireUserFederationAccess(userId, federationId);
    return this.getFederationVoiceStats(federationId);
  }

  /**
   * Get live status of a federation's voice server.
   */
  async getFederationVoiceStatus(federationId: string): Promise<VoiceServerStatus> {
    const config = await this.getFederationVoiceConfigInternal(federationId);
    if (!config?.enabled) {
      return { online: false, currentUsers: 0, maxUsers: 0 };
    }
    return this.queryServerStatus(config, `fed:${federationId}`);
  }

  /**
   * Get aggregated stats for a federation's voice server.
   */
  async getFederationVoiceStats(federationId: string): Promise<VoiceServerStats | null> {
    const config = await this.getFederationVoiceConfigInternal(federationId);
    if (!config?.enabled) {
      return null;
    }
    return this.buildStats(config, `fed:${federationId}`);
  }

  /**
   * Update voice server config for a federation.
   * Uses jsonb_set to avoid clobbering concurrent settings writes.
   */
  async updateFedVoiceConfig(
    federationId: string,
    orgId: string,
    userId: string,
    body: Record<string, unknown>
  ): Promise<VoiceServerConfig | null> {
    // Verify federation exists
    const fed = await this.fedRepo.findOne({
      where: { id: federationId },
      select: ['id', 'settings'],
    });
    if (!fed) {
      throw new NotFoundError('Federation not found');
    }

    // Verify caller's org is an active member of this federation
    await this.requireFederationMembership(federationId, orgId);

    const config = this.buildConfig(body);
    const isNew = !fed.settings?.voiceServer?.enabled;

    await AppDataSource.query(
      `UPDATE federations SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), '{voiceServer}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify(config), federationId]
    );

    if (isNew) {
      voiceAuditLogger.logConfigCreated(
        federationId,
        'federation',
        orgId,
        userId,
        config.serverType,
        config.host,
        config.port
      );
    } else {
      voiceAuditLogger.logConfigUpdated(federationId, 'federation', orgId, userId, {
        serverType: config.serverType,
        host: config.host,
        port: config.port,
      });
    }

    return this.getFederationVoiceConfig(federationId);
  }

  /**
   * Resolve the caller's active federation-member organization for federation
   * voice write operations when no explicit tenant context is present.
   */
  async resolveFederationActorOrganizationId(
    userId: string,
    federationId: string
  ): Promise<string> {
    const federationOrgIds = await this.getActiveFederationOrganizationIds(federationId);
    if (federationOrgIds.length === 0) {
      throw new ForbiddenError('Federation has no active members');
    }

    const membership = await this.membershipRepo
      .createQueryBuilder('om')
      .where('om."userId" = :userId', { userId })
      .andWhere('om."organizationId" IN (:...orgIds)', { orgIds: federationOrgIds })
      .andWhere('om."isActive" = true')
      .select('om."organizationId"', 'organizationId')
      .orderBy('om."organizationId"', 'ASC')
      .getRawOne<{ organizationId: string }>();

    if (!membership?.organizationId) {
      throw new ForbiddenError('You are not a member of any organization in this federation');
    }

    return membership.organizationId;
  }

  /**
   * Delete voice server config from a federation.
   */
  async deleteFedVoiceConfig(federationId: string, orgId: string, userId: string): Promise<void> {
    const fed = await this.fedRepo.findOne({ where: { id: federationId }, select: ['id'] });
    if (!fed) {
      throw new NotFoundError('Federation not found');
    }

    // Verify caller's org is an active member of this federation
    await this.requireFederationMembership(federationId, orgId);

    await AppDataSource.query(
      `UPDATE federations SET settings = settings - 'voiceServer' WHERE id = $1`,
      [federationId]
    );

    voiceAuditLogger.logConfigDeleted(federationId, 'federation', orgId, userId);
  }

  // ── Platform Mumble Access Check ─────────────────────────────

  /**
   * Check if a user has access to the platform-hosted Mumble server.
   * Access is granted to members of orgs in the platform federation.
   */
  async checkPlatformMumbleAccess(userId: string): Promise<boolean> {
    const federationId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
    if (!federationId) {
      return false;
    }

    const orgIds = await this.getActiveFederationOrganizationIds(federationId);
    if (orgIds.length === 0) {
      return false;
    }

    return this.hasActiveMembershipInOrganizations(userId, orgIds);
  }

  /**
   * Verify user has access to a voice server, throw ForbiddenError if not.
   */
  async verifyAccess(
    userId: string,
    config: VoiceServerConfig,
    organizationId?: string
  ): Promise<void> {
    if (config.isPlatformHosted) {
      const hasAccess = await this.checkPlatformMumbleAccess(userId);
      if (!hasAccess) {
        throw new ForbiddenError(
          'You must be a member of the platform federation to access this voice server'
        );
      }
      return;
    }

    if (!organizationId) {
      return; // No org-level RBAC check needed
    }

    // Check required org permission when configured.
    if (config.requiredPermission) {
      const parsed = this.parsePermissionKey(config.requiredPermission);
      if (!parsed) {
        logger.warn('Voice server config has invalid requiredPermission key', {
          organizationId,
          requiredPermission: config.requiredPermission,
        });
        throw new ForbiddenError('Voice access policy is misconfigured');
      }

      const hasPermission = await this.permissionManager.hasPermission(
        organizationId,
        userId,
        parsed.resource,
        parsed.action
      );

      if (!hasPermission) {
        throw new ForbiddenError('You do not have the required permission for voice access');
      }
    }

    // Check minimum role priority
    if (config.minRolePriority && config.minRolePriority > 0) {
      const membership = await this.membershipRepo.findOne({
        where: { userId, organizationId, isActive: true },
        relations: ['role'],
      });

      if (!membership?.role) {
        throw new ForbiddenError('You must be a member of this organization');
      }

      if (membership.role.priority < config.minRolePriority) {
        throw new ForbiddenError('Your role does not have sufficient privileges for voice access');
      }
    }
  }

  private parsePermissionKey(permissionKey: string): { resource: string; action: string } | null {
    const parts = permissionKey.split(':');
    if (parts.length !== 2) {
      return null;
    }

    const resource = parts[0]?.trim();
    const action = parts[1]?.trim();
    if (!resource || !action) {
      return null;
    }

    return { resource, action };
  }

  // ── Voice Minutes for CAS Integration ────────────────────────

  /**
   * Get total Mumble voice minutes for an org's members in the last 7 days.
   * Used by CASComputationService to supplement Discord voice data.
   *
   * Returns 0 if the org's voice server doesn't have CAS contribution enabled
   * or if the server is unreachable.
   */
  async getMumbleVoiceMinutes(organizationId: string): Promise<number> {
    const config = await this.getOrgVoiceConfigInternal(organizationId);
    if (!config?.enabled || !config.contributeToCAS) {
      return 0;
    }

    // Use longer cache TTL for CAS to avoid blocking the background job with UDP I/O
    const casCacheKey = `voice:cas:${organizationId}`;
    const cachedMinutes = await cache.get<number>(casCacheKey);
    if (cachedMinutes !== null) {
      return cachedMinutes;
    }

    // Try to get session data from the Mumble server
    try {
      const status = await this.queryServerStatus(config, `org:${organizationId}`);
      if (!status.online || !status.channels) {
        await cache.set(casCacheKey, 0, VOICE_CAS_CACHE_TTL);
        return 0;
      }

      // Sum current session minutes for all connected users
      let totalMinutes = 0;
      for (const channel of status.channels) {
        if (channel.users) {
          for (const user of channel.users) {
            totalMinutes += user.sessionMinutes ?? 0;
          }
        }
      }
      await cache.set(casCacheKey, totalMinutes, VOICE_CAS_CACHE_TTL);
      if (totalMinutes > 0) {
        trackMetric('voice.minutes.total', totalMinutes);
      }
      return totalMinutes;
    } catch {
      await cache.set(casCacheKey, 0, VOICE_CAS_CACHE_TTL);
      return 0; // Graceful degradation — don't break CAS if Mumble is unreachable
    }
  }

  // ── Platform Connect Info ────────────────────────────────────

  /**
   * Get the platform Mumble server connection info for embeds and UI.
   * Returns connectUrl, serverType, and displayName from the federation config.
   */
  async getPlatformConnectInfo(): Promise<{
    connectUrl?: string;
    serverType?: string;
    displayName?: string;
  }> {
    const federationId = process.env.PLATFORM_MUMBLE_FEDERATION_ID;
    if (!federationId) {
      return {};
    }
    const config = await this.getFederationVoiceConfigInternal(federationId);
    if (!config?.enabled) {
      return {};
    }
    return {
      connectUrl: config.connectUrl || `mumble://${config.host}:${config.port}/`,
      serverType: config.serverType,
      displayName: config.displayName,
    };
  }

  // ── Redis Channel Data Cache ─────────────────────────────────

  /**
   * Cache channel/user data pushed from the CVP bridge.
   * Called by the internal POST /voice-server/platform/channel-data endpoint.
   *
   * @param data Channel/user payload from the CVP bridge.
   * @param ownerScope Identifies the voice server this data belongs to (e.g.
   *   `org:<orgId>`, `fed:<federationId>`, or `platform` for the legacy
   *   single-server path). Defaults to `'platform'` so existing CVP bridge
   *   deployments continue to work without coordination.
   */
  async cachePlatformChannelData(data: unknown, ownerScope: string = 'platform'): Promise<void> {
    await cache.set(`voice:channels:${ownerScope}`, data, 60); // 60s TTL
  }

  /**
   * Read cached channel data from Redis (pushed by CVP bridge).
   * Returns null if no cached data available.
   */
  private async getCachedChannelData(ownerScope: string = 'platform'): Promise<{
    channels?: Array<{
      id: number;
      name: string;
      parentId: number | null;
      userCount: number;
    }>;
    users?: Array<{
      displayName: string;
      channelId: number;
      isMuted: boolean;
      isDeafened: boolean;
      onlineSince: string;
      sessionMinutes?: number;
    }>;
  } | null> {
    return cache.get(`voice:channels:${ownerScope}`);
  }

  // ── Internal Helpers ─────────────────────────────────────────

  private async getOrgVoiceConfigInternal(
    organizationId: string
  ): Promise<VoiceServerConfig | null> {
    const org = await this.orgRepo.findOne({
      where: { id: organizationId },
      select: ['id', 'settings'],
    });
    return org?.settings?.voiceServer ?? null;
  }

  private async getFederationVoiceConfigInternal(
    federationId: string
  ): Promise<VoiceServerConfig | null> {
    const fed = await this.fedRepo.findOne({
      where: { id: federationId },
      select: ['id', 'settings'],
    });
    return fed?.settings?.voiceServer ?? null;
  }

  /**
   * Query a voice server for live status.
   * Dispatches to protocol-specific implementations.
   */
  private async queryServerStatus(
    config: VoiceServerConfig,
    cachePrefix: string
  ): Promise<VoiceServerStatus> {
    const cacheKey = `voice:status:${cachePrefix}`;

    // Check cache first
    const cached = await cache.get<VoiceServerStatus>(cacheKey);
    if (cached) {
      return cached;
    }

    let status: VoiceServerStatus;

    try {
      switch (config.serverType) {
        case 'mumble':
          status = await this.queryMumbleServer(config, cachePrefix);
          break;
        case 'teamspeak':
          status = await this.queryTeamSpeakServer(config);
          break;
        default:
          // Custom/Ventrilo/StarComms — no query protocol, return basic offline status
          status = { online: false, currentUsers: 0, maxUsers: 0 };
          break;
      }
    } catch (error: unknown) {
      logger.warn('Voice server query failed', {
        host: config.host,
        port: config.port,
        serverType: config.serverType,
        error: error instanceof Error ? error.message : String(error),
      });
      status = { online: false, currentUsers: 0, maxUsers: 0 };
    }

    // Cache the result
    await cache.set(cacheKey, status, VOICE_STATUS_CACHE_TTL);

    // Emit App Insights telemetry for voice server monitoring
    trackMetric('voice.users.online', status.currentUsers);

    return status;
  }

  /**
   * Query a Mumble server via UDP ping + CVP bridge for channel data.
   *
   * UDP ping returns: online/offline, currentUsers, maxUsers, bandwidth.
   * CVP bridge (if configured via iceHost) returns: channels + user list.
   */
  private async queryMumbleServer(
    config: VoiceServerConfig,
    ownerScope: string
  ): Promise<VoiceServerStatus> {
    // Step 1: UDP ping for basic status
    const status = await this.mumbleUdpPing(config);

    // Step 2: If online, fetch channel data (Redis cache first, CVP bridge fallback)
    if (status.online) {
      const channelData = await this.fetchChannelData(config, ownerScope);
      if (channelData?.channels) {
        status.channels = channelData.channels.map(ch => ({
          ...ch,
          users: (channelData.users ?? [])
            .filter(u => u.channelId === ch.id)
            .map(u => ({
              displayName: u.displayName,
              channelId: u.channelId,
              isMuted: u.isMuted,
              isDeafened: u.isDeafened,
              onlineSince: u.onlineSince,
              sessionMinutes: u.sessionMinutes,
            })),
        }));

        // The CVP bridge enumerates actual connected sessions, while Mumble's
        // UDP ping can include stale/zombie connections that never disconnected
        // cleanly. Prefer the CVP user list as the source of truth — but only
        // when the bridge actually provided session data. The HTTPS `/channels`
        // fallback returns channel topology without a `users` field, in which
        // case we must keep the UDP-reported count rather than zeroing it.
        if (Array.isArray(channelData.users)) {
          status.currentUsers = channelData.users.length;
        }
      }
    }

    return status;
  }

  /**
   * Fetch channel data from Redis cache (pushed by CVP bridge) or fall back to HTTPS.
   */
  private async fetchChannelData(
    config: VoiceServerConfig,
    ownerScope: string
  ): Promise<{
    channels?: Array<{
      id: number;
      name: string;
      parentId: number | null;
      userCount: number;
    }>;
    users?: Array<{
      displayName: string;
      channelId: number;
      isMuted: boolean;
      isDeafened: boolean;
      onlineSince: string;
      sessionMinutes?: number;
    }>;
  } | null> {
    // Try Redis cache first (populated by CVP bridge push)
    const cached = await this.getCachedChannelData(ownerScope);
    if (cached?.channels) {
      return cached;
    }

    // Fall back to direct CVP bridge HTTPS fetch
    if (!config.iceHost) {
      return null;
    }

    // SSRF protection — resolve DNS to prevent rebinding
    if (await isPrivateHostResolved(config.iceHost)) {
      logger.warn('Blocked CVP fetch to private/internal host', { host: config.iceHost });
      return null;
    }

    try {
      const cvpPort = config.icePort || 8443;
      const cvpUrl = `https://${config.iceHost}:${cvpPort}/channels`;
      const response = await fetch(cvpUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return (await response.json()) as {
          channels?: Array<{
            id: number;
            name: string;
            parentId: number | null;
            userCount: number;
          }>;
          users?: Array<{
            displayName: string;
            channelId: number;
            isMuted: boolean;
            isDeafened: boolean;
            onlineSince: string;
            sessionMinutes?: number;
          }>;
        };
      }
    } catch (error: unknown) {
      logger.debug('Mumble CVP bridge unavailable, channel tree will be empty', {
        host: config.iceHost,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Mumble UDP ping protocol — returns basic server status.
   */
  private mumbleUdpPing(config: VoiceServerConfig): Promise<VoiceServerStatus> {
    // Mumble UDP ping protocol: send 4 zero bytes, get back version+users+max+bandwidth
    return new Promise<VoiceServerStatus>((resolve, reject) => {
      // Dynamic import to avoid loading dgram when not needed
      import('node:dgram')
        .then(({ createSocket }) => {
          const socket = createSocket('udp4');
          const timeout = setTimeout(() => {
            socket.close();
            resolve({ online: false, currentUsers: 0, maxUsers: 0 });
          }, 3000);

          socket.on('message', (msg: Buffer) => {
            clearTimeout(timeout);
            socket.close();

            if (msg.length >= 24) {
              // Mumble UDP ping response format:
              // Bytes 0-3:   Version (major.minor.patch + unused)
              // Bytes 4-11:  Echoed timestamp (8 bytes, our request ID)
              // Bytes 12-15: Current Users
              // Bytes 16-19: Max Users
              // Bytes 20-23: Bandwidth (bits/s)
              const currentUsers = msg.readUInt32BE(12);
              const maxUsers = msg.readUInt32BE(16);
              const bandwidthKbps = Math.round(msg.readUInt32BE(20) / 1000);

              resolve({
                online: true,
                currentUsers,
                maxUsers,
                bandwidthKbps: bandwidthKbps > 0 ? bandwidthKbps : undefined,
              });
            } else if (msg.length >= 1) {
              // Got a response but too short for full parse — server is online
              resolve({ online: true, currentUsers: 0, maxUsers: 0 });
            } else {
              resolve({ online: true, currentUsers: 0, maxUsers: 0 });
            }
          });

          socket.on('error', () => {
            clearTimeout(timeout);
            socket.close();
            resolve({ online: false, currentUsers: 0, maxUsers: 0 });
          });

          // Mumble ping: 4 zero bytes
          const pingBuffer = Buffer.alloc(12);
          // First 4 bytes: request identifier (0 for ping)
          // Bytes 4-11: request ID (timestamp for round-trip calc)
          const now = BigInt(Date.now());
          pingBuffer.writeBigUInt64BE(now, 4);

          socket.send(pingBuffer, 0, pingBuffer.length, config.port, config.host);
        })
        .catch(reject);
    });
  }

  /**
   * Query a TeamSpeak server via ServerQuery protocol (TCP text-based).
   */
  private async queryTeamSpeakServer(config: VoiceServerConfig): Promise<VoiceServerStatus> {
    const queryPort = config.queryPort ?? TEAMSPEAK_QUERY_DEFAULT_PORT;
    const queryUsername = config.queryUsername?.trim();
    const encryptedQueryPassword = (config as unknown as Record<string, unknown>)[
      'encryptedQueryPassword'
    ];
    const queryPassword =
      typeof encryptedQueryPassword === 'string' && encryptedQueryPassword.length > 0
        ? this.tryDecryptSecret(encryptedQueryPassword, 'teamspeak-query-password')
        : undefined;
    const shouldAuthenticate = Boolean(queryUsername && queryPassword);

    return new Promise<VoiceServerStatus>((resolve, reject) => {
      import('node:net')
        .then(({ createConnection }) => {
          const socket = createConnection({ host: config.host, port: queryPort });
          const timeout = setTimeout(() => {
            socket.destroy();
            resolve({ online: false, currentUsers: 0, maxUsers: 0 });
          }, 3000);

          let buffer = '';
          let completed = false;
          let connected = false;
          let parsedStatus: VoiceServerStatus | null = null;
          let state:
            | 'waitingWelcomeError'
            | 'waitingLoginError'
            | 'waitingServerInfo'
            | 'waitingServerInfoError' = 'waitingWelcomeError';

          const complete = (status: VoiceServerStatus) => {
            if (completed) {
              return;
            }
            completed = true;
            clearTimeout(timeout);
            socket.end();
            resolve(status);
          };

          const sendCommand = (command: string) => {
            socket.write(`${command}\n`);
          };

          const requestServerInfo = () => {
            state = 'waitingServerInfo';
            sendCommand('serverinfo');
          };

          socket.on('connect', () => {
            connected = true;
          });

          socket.on('data', (chunk: Buffer) => {
            buffer += chunk.toString('utf8');

            let newlineIndex = buffer.indexOf('\n');
            while (newlineIndex !== -1) {
              const rawLine = buffer.slice(0, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              newlineIndex = buffer.indexOf('\n');

              const line = rawLine.trim();
              if (!line || line.startsWith('TS3')) {
                continue;
              }

              if (state === 'waitingServerInfo' && line.includes('virtualserver_clientsonline=')) {
                const data = this.parseTeamSpeakKeyValueLine(line);
                parsedStatus = {
                  online: true,
                  currentUsers: this.parseInteger(data.virtualserver_clientsonline),
                  maxUsers: this.parseInteger(data.virtualserver_maxclients),
                };
                state = 'waitingServerInfoError';
                continue;
              }

              if (!line.startsWith('error ')) {
                continue;
              }

              const errorId = this.parseTeamSpeakErrorId(line);

              if (state === 'waitingWelcomeError') {
                if (errorId !== 0) {
                  complete({ online: false, currentUsers: 0, maxUsers: 0 });
                  return;
                }

                if (shouldAuthenticate) {
                  const username = queryUsername;
                  const password = queryPassword;
                  state = 'waitingLoginError';
                  if (username && password) {
                    sendCommand(
                      `login client_login_name=${this.escapeTeamSpeakValue(username)} client_login_password=${this.escapeTeamSpeakValue(password)}`
                    );
                  } else {
                    requestServerInfo();
                  }
                } else {
                  requestServerInfo();
                }
                continue;
              }

              if (state === 'waitingLoginError') {
                if (errorId !== 0) {
                  logger.warn('TeamSpeak ServerQuery login failed', {
                    host: config.host,
                    queryPort,
                    errorId,
                  });
                  complete({ online: true, currentUsers: 0, maxUsers: 0 });
                  return;
                }

                requestServerInfo();
                continue;
              }

              if (state === 'waitingServerInfoError') {
                if (errorId === 0 && parsedStatus) {
                  complete(parsedStatus);
                } else {
                  complete({ online: true, currentUsers: 0, maxUsers: 0 });
                }
                return;
              }
            }
          });

          socket.on('error', (error: Error) => {
            clearTimeout(timeout);
            socket.destroy();
            if (connected) {
              logger.warn('TeamSpeak ServerQuery command failed', {
                host: config.host,
                queryPort,
                error: error.message,
              });
              resolve({ online: true, currentUsers: 0, maxUsers: 0 });
              return;
            }
            resolve({ online: false, currentUsers: 0, maxUsers: 0 });
          });

          socket.on('end', () => {
            if (completed) {
              return;
            }

            if (parsedStatus) {
              complete(parsedStatus);
              return;
            }

            if (connected) {
              complete({ online: true, currentUsers: 0, maxUsers: 0 });
              return;
            }

            complete({ online: false, currentUsers: 0, maxUsers: 0 });
          });
        })
        .catch(reject);
    });
  }

  private tryDecryptSecret(encrypted: string, label: string): string | undefined {
    try {
      return decrypt(encrypted);
    } catch (error: unknown) {
      logger.warn('Failed to decrypt voice server secret', {
        secretType: label,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  private parseTeamSpeakErrorId(line: string): number {
    const data = this.parseTeamSpeakKeyValueLine(line);
    return this.parseInteger(data.id);
  }

  private parseTeamSpeakKeyValueLine(line: string): Record<string, string> {
    const result: Record<string, string> = {};
    const tokens = line.match(/(?:\\.|[^\s])+/g) ?? [];

    for (const token of tokens) {
      const separatorIndex = token.indexOf('=');
      if (separatorIndex === -1) {
        continue;
      }

      const key = token.slice(0, separatorIndex);
      const value = token.slice(separatorIndex + 1);
      result[key] = this.unescapeTeamSpeakValue(value);
    }

    return result;
  }

  private unescapeTeamSpeakValue(value: string): string {
    return value
      .replaceAll(String.raw`\s`, ' ')
      .replaceAll(String.raw`\p`, '|')
      .replaceAll(String.raw`\/`, '/')
      .replaceAll(String.raw`\\`, '\\');
  }

  private escapeTeamSpeakValue(value: string): string {
    return value
      .replaceAll('\\', String.raw`\\`)
      .replaceAll(' ', String.raw`\s`)
      .replaceAll('|', String.raw`\p`)
      .replaceAll('/', String.raw`\/`);
  }

  private parseInteger(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  /**
   * Build aggregated stats from live status + cached historical data.
   */
  private async buildStats(
    config: VoiceServerConfig,
    cachePrefix: string
  ): Promise<VoiceServerStats> {
    const cacheKey = `voice:stats:${cachePrefix}`;

    const cached = await cache.get<VoiceServerStats>(cacheKey);
    if (cached) {
      return cached;
    }

    const status = await this.queryServerStatus(config, cachePrefix);

    // Record peak user samples in a simple JSON array
    const peakKey = `voice:peak:${cachePrefix}`;
    const now = Date.now();

    // Load existing peak samples
    let samples = (await cache.get<Array<{ ts: number; count: number }>>(peakKey)) ?? [];

    // Add current sample if online
    if (status.online && status.currentUsers > 0) {
      samples.push({ ts: now, count: status.currentUsers });
      // Trim entries older than 30 days
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
      samples = samples.filter(s => s.ts >= thirtyDaysAgo);
      // Persist (30-day TTL)
      await cache.set(peakKey, samples, 30 * 24 * 60 * 60);
    }

    // Calculate peak stats from samples
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    const peakUsers24h = this.getPeakFromSamples(samples, oneDayAgo);
    const peakUsers7d = this.getPeakFromSamples(samples, sevenDaysAgo);
    const peakUsers30d = this.getPeakFromSamples(samples, 0);

    const stats: VoiceServerStats = {
      serverType: config.serverType,
      displayName: config.displayName ?? `${config.host}:${config.port}`,
      status,
      peakUsers24h,
      peakUsers7d,
      peakUsers30d,
    };

    await cache.set(cacheKey, stats, VOICE_STATS_CACHE_TTL);
    return stats;
  }

  /**
   * Get peak user count from samples since a given timestamp.
   */
  private getPeakFromSamples(
    samples: Array<{ ts: number; count: number }>,
    sinceTs: number
  ): number {
    let peak = 0;
    for (const s of samples) {
      if (s.ts >= sinceTs && s.count > peak) {
        peak = s.count;
      }
    }
    return peak;
  }

  /**
   * Build a VoiceServerConfig from validated request body.
   * Encrypts password if provided — throws if encryption fails in production.
   */
  private buildConfig(body: Record<string, unknown>): VoiceServerConfig {
    const config: VoiceServerConfig = {
      enabled: body.enabled as boolean,
      serverType: body.serverType as VoiceServerConfig['serverType'],
      host: body.host as string,
      port: body.port as number,
      displayName: (body.displayName as string) || undefined,
      connectUrl: (body.connectUrl as string) || undefined,
      queryPort: (body.queryPort as number) || undefined,
      queryUsername: (body.queryUsername as string) || undefined,
      isPlatformHosted: (body.isPlatformHosted as boolean) || false,
      minRolePriority: (body.minRolePriority as number) || 0,
      requiredPermission: (body.requiredPermission as string) || undefined,
      contributeToCAS: (body.contributeToCAS as boolean) || false,
      iceHost: (body.iceHost as string) || undefined,
      icePort: (body.icePort as number) || undefined,
    };

    if (config.serverType === 'starcomms') {
      config.starCommsVoiceMode =
        (body.starCommsVoiceMode as VoiceServerConfig['starCommsVoiceMode']) || 'central';
    }

    if (body.password && typeof body.password === 'string' && body.password.length > 0) {
      (config as unknown as Record<string, unknown>)['encryptedPassword'] = encrypt(body.password);
      config.hasPassword = true;
    }

    if (
      body.queryPassword &&
      typeof body.queryPassword === 'string' &&
      body.queryPassword.length > 0
    ) {
      (config as unknown as Record<string, unknown>)['encryptedQueryPassword'] = encrypt(
        body.queryPassword
      );
      config.hasQueryPassword = true;
    }

    if (body.iceSecret && typeof body.iceSecret === 'string' && body.iceSecret.length > 0) {
      (config as unknown as Record<string, unknown>)['encryptedIceSecret'] = encrypt(
        body.iceSecret
      );
      config.hasIceSecret = true;
    }

    // Federation / 3rd-party sharing
    if (body.sharing && typeof body.sharing === 'object') {
      const sharingInput = body.sharing as Record<string, unknown>;
      const whitelist = Array.isArray(sharingInput.whitelist)
        ? (sharingInput.whitelist as Array<Record<string, unknown>>).map(entry => ({
            type: entry.type as 'federation' | 'organization',
            targetId: entry.targetId as string,
            targetName: entry.targetName as string,
            addedAt: new Date().toISOString(),
          }))
        : [];
      config.sharing = {
        enabled: (sharingInput.enabled as boolean) || false,
        whitelist,
      };
    }

    return config;
  }

  /**
   * Remove passwords and sensitive fields from config before returning to frontend.
   */
  private sanitizeConfig(config: VoiceServerConfig | null): VoiceServerConfig | null {
    if (!config) {
      return null;
    }
    const { ...sanitized } = config;
    // Never send password or encrypted password to frontend
    delete (sanitized as Record<string, unknown>)['password'];
    delete (sanitized as Record<string, unknown>)['encryptedPassword'];
    delete (sanitized as Record<string, unknown>)['queryPassword'];
    delete (sanitized as Record<string, unknown>)['encryptedQueryPassword'];
    delete (sanitized as Record<string, unknown>)['iceSecret'];
    delete (sanitized as Record<string, unknown>)['encryptedIceSecret'];
    return sanitized;
  }

  /**
   * Verify that an organization is an active member of a federation.
   * Throws ForbiddenError if not a member.
   */
  private async requireFederationMembership(
    federationId: string,
    organizationId: string
  ): Promise<void> {
    const membership = await this.fedMemberRepo.findOne({
      where: {
        federationId,
        organizationId,
        status: 'active',
      },
    });
    if (!membership) {
      throw new ForbiddenError('Your organization is not a member of this federation');
    }
  }

  /**
   * Verify that a user belongs to at least one org that is an active member
   * of the given federation.  Used to gate federation voice config reads.
   */
  private async requireUserFederationAccess(userId: string, federationId: string): Promise<void> {
    const orgIds = await this.getActiveFederationOrganizationIds(federationId);
    if (orgIds.length === 0) {
      throw new ForbiddenError('Federation has no active members');
    }

    const hasMembership = await this.hasActiveMembershipInOrganizations(userId, orgIds);
    if (!hasMembership) {
      throw new ForbiddenError('You are not a member of any organization in this federation');
    }
  }

  private async getActiveFederationOrganizationIds(federationId: string): Promise<string[]> {
    const fedMembers = await this.fedMemberRepo.find({
      where: { federationId, status: 'active' as const },
      select: ['organizationId'],
    });

    return [...new Set(fedMembers.map(member => member.organizationId))];
  }

  private async hasActiveMembershipInOrganizations(
    userId: string,
    organizationIds: string[]
  ): Promise<boolean> {
    if (organizationIds.length === 0) {
      return false;
    }

    const membership = await this.membershipRepo
      .createQueryBuilder('om')
      .where('om."userId" = :userId', { userId })
      .andWhere('om."organizationId" IN (:...orgIds)', { orgIds: organizationIds })
      .andWhere('om."isActive" = true')
      .getOne();

    return !!membership;
  }
}
