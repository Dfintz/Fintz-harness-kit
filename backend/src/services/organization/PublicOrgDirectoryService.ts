import { In, Repository, SelectQueryBuilder } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import { ActivityLevel, OrgPrimaryFocus, PublicOrgProfile } from '../../models/PublicOrgProfile';
import { SCStatsCsvImport } from '../../models/SCStatsCsvImport';
import { invalidateDirectoryStatsCache } from '../../utils/cacheInvalidation';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { cache } from '../../utils/redis';

/**
 * Filter options for directory search
 * Phase 2: Enhanced with multi-select and advanced filtering
 */
export interface DirectoryFilterOptions {
  /** Single primary focus (legacy support) */
  primaryFocus?: OrgPrimaryFocus;
  /** Multi-select primary focus - matches any of the specified focuses */
  primaryFocuses?: OrgPrimaryFocus[];
  /** Single activity level (legacy support) */
  activityLevel?: ActivityLevel;
  /** Multi-select activity levels - matches any of the specified levels */
  activityLevels?: ActivityLevel[];
  isRecruiting?: boolean;
  isVerified?: boolean;
  minMemberCount?: number;
  maxMemberCount?: number;
  languages?: string[];
  timezone?: string;
  searchTerm?: string;
}

/**
 * Public organization profile data for directory listing
 */
export interface PublicOrgListItem {
  id: string;
  organizationId: string;
  organizationName: string;
  rsiSid?: string;
  slug: string;
  organizationDescription?: string;
  organizationLogoUrl?: string;
  tagline?: string;
  primaryFocus: OrgPrimaryFocus;
  secondaryFocus?: OrgPrimaryFocus[];
  memberCount: number;
  activityLevel: ActivityLevel;
  rsiUrl?: string;
  discordInvite?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  websiteUrl?: string;
  bannerUrl?: string;
  languages?: string[];
  timezone?: string;
  isVerified: boolean;
  isRecruiting: boolean;
  rsiArchetype?: string;
  rsiCommitment?: string;
  rsiRolePlay?: boolean;
  rsiExclusive?: boolean;
  skillDistribution?: Record<string, { low: number; medium: number; high: number; expert: number }>;
}

/**
 * Options for creating/updating a public profile
 */
export interface PublicProfileInput {
  isPublic?: boolean;
  tagline?: string;
  primaryFocus?: OrgPrimaryFocus;
  secondaryFocus?: OrgPrimaryFocus[];
  rsiUrl?: string;
  discordInvite?: string;
  twitterUrl?: string;
  youtubeUrl?: string;
  twitchUrl?: string;
  websiteUrl?: string;
  bannerUrl?: string;
  logoUrl?: string;
  languages?: string[];
  timezone?: string;
  isRecruiting?: boolean;
  useDiscordForApplications?: boolean;
  scstatsVisibility?: {
    showVerification?: boolean;
    showSkills?: boolean;
    showTimezone?: boolean;
    showAnalytics?: boolean;
  };
}

/**
 * PublicOrgDirectoryService - Service for public organization directory
 *
 * Provides:
 * - Public directory listing with filtering
 * - Public profile management
 * - Privacy controls
 * - No authentication required for read operations
 */
export class PublicOrgDirectoryService {
  private readonly profileRepository: Repository<PublicOrgProfile>;
  private readonly organizationRepository: Repository<Organization>;

  constructor() {
    this.profileRepository = AppDataSource.getRepository(PublicOrgProfile);
    this.organizationRepository = AppDataSource.getRepository(Organization);
  }

  /**
   * Get public organization directory listing with filtering
   * No authentication required
   *
   * @param filters Optional filter criteria
   * @param pagination Pagination options
   * @returns Paginated list of public organizations
   */
  async getPublicDirectory(
    filters?: DirectoryFilterOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResponse<PublicOrgListItem>> {
    const queryBuilder = this.profileRepository
      .createQueryBuilder('profile')
      .leftJoinAndSelect('profile.organization', 'org')
      .where('profile.isPublic = :isPublic', { isPublic: true });

    // Apply filters
    if (filters) {
      this.applyDirectoryFilters(queryBuilder, filters);
    }

    // Apply pagination
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    queryBuilder.skip((page - 1) * limit).take(limit);

    // Sorting (Phase 2 enhanced)
    const sortBy = pagination?.sortBy || 'memberCount';
    const sortOrder = pagination?.sortOrder || 'DESC';

    // Validate sortBy to prevent SQL injection
    const allowedSortFields = ['memberCount', 'createdAt', 'updatedAt', 'activityLevel'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'memberCount';

    // Verified organizations first, then sort by specified field
    queryBuilder.addOrderBy('profile.isVerified', 'DESC');
    queryBuilder.addOrderBy(`profile.${safeSortBy}`, sortOrder);

    // Execute query
    const [profiles, total] = await queryBuilder.getManyAndCount();

    // Batch-fetch live member counts from membership table
    const orgIds = profiles.map(p => p.organizationId);
    const liveMemberCounts = await this.getLiveMemberCounts(orgIds);

    // Batch-fetch skill distribution for orgs with showSkills enabled
    const skillEligibleOrgIds = profiles
      .filter(p => p.scstatsVisibility?.showSkills !== false)
      .map(p => p.organizationId);
    const skillDistributions = await this.batchGetSkillDistributions(skillEligibleOrgIds);

    // Transform to public list items, auto-generating slugs for profiles missing them
    const { slugify } = await import('../../utils/slugify');
    const data: PublicOrgListItem[] = [];

    for (const profile of profiles) {
      let profileSlug = profile.slug || '';

      // Backfill slug if missing
      if (!profileSlug && profile.organization?.name) {
        profileSlug = slugify(profile.organization.name);
        // Save it asynchronously (don't block the response)
        profile.slug = profileSlug;
        void this.profileRepository.save(profile).catch(() => {
          // Silently ignore — slug will be retried next request
        });
      }

      const liveCount = liveMemberCounts.get(profile.organizationId) ?? profile.memberCount;

      data.push({
        id: profile.id,
        organizationId: profile.organizationId,
        organizationName: profile.organization?.name || 'Unknown',
        rsiSid: profile.organization?.rsiSid,
        slug: profileSlug,
        organizationDescription: profile.organization?.description || undefined,
        organizationLogoUrl: profile.organization?.logoUrl || undefined,
        tagline: profile.tagline,
        primaryFocus: profile.primaryFocus,
        secondaryFocus: profile.secondaryFocus,
        memberCount: liveCount,
        activityLevel: profile.activityLevel,
        rsiUrl: profile.rsiUrl,
        discordInvite: profile.discordInvite,
        twitterUrl: profile.twitterUrl,
        youtubeUrl: profile.youtubeUrl,
        twitchUrl: profile.twitchUrl,
        websiteUrl: profile.websiteUrl,
        bannerUrl: profile.bannerUrl,
        languages: profile.languages,
        timezone: profile.timezone,
        isVerified: profile.isVerified,
        isRecruiting: profile.isRecruiting,
        rsiArchetype: profile.rsiArchetype,
        rsiCommitment: profile.rsiCommitment,
        rsiRolePlay: profile.rsiRolePlay,
        rsiExclusive: profile.rsiExclusive,
        skillDistribution: skillDistributions.get(profile.organizationId),
      });
    }

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get a single public organization profile by organization ID or slug
   * No authentication required, but only returns if public
   *
   * @param identifier Organization ID (UUID) or URL slug
   * @returns Public profile or null if not public/doesn't exist
   */
  async getPublicProfile(identifier: string): Promise<PublicOrgListItem | null> {
    const { isUUID } = await import('../../utils/slugify');

    let profile;
    const normalizedIdentifier = identifier.trim();

    if (isUUID(normalizedIdentifier)) {
      // Direct UUID lookup
      profile = await this.profileRepository.findOne({
        where: { organizationId: normalizedIdentifier, isPublic: true },
        relations: ['organization'],
      });
    } else {
      // Prefer RSI SID for durable public links, then fall back to legacy slug links.
      profile = await this.profileRepository.findOne({
        where: [
          { isPublic: true, organization: { rsiSid: normalizedIdentifier.toUpperCase() } },
          { isPublic: true, slug: normalizedIdentifier },
        ],
        relations: ['organization'],
      });
    }

    if (!profile) {
      return null;
    }

    // Get live member count from membership table
    const liveMemberCounts = await this.getLiveMemberCounts([profile.organizationId]);
    const liveCount = liveMemberCounts.get(profile.organizationId) ?? profile.memberCount;

    // Fetch skill distribution if showSkills is enabled
    const showSkills = profile.scstatsVisibility?.showSkills ?? true;
    const skillDistributions = showSkills
      ? await this.batchGetSkillDistributions([profile.organizationId])
      : new Map();

    return {
      id: profile.id,
      organizationId: profile.organizationId,
      organizationName: profile.organization?.name || 'Unknown',
      rsiSid: profile.organization?.rsiSid,
      slug: profile.slug || '',
      organizationDescription: profile.organization?.description || undefined,
      organizationLogoUrl: profile.organization?.logoUrl || undefined,
      tagline: profile.tagline,
      primaryFocus: profile.primaryFocus,
      secondaryFocus: profile.secondaryFocus,
      memberCount: liveCount,
      activityLevel: profile.activityLevel,
      rsiUrl: profile.rsiUrl,
      discordInvite: profile.discordInvite,
      twitterUrl: profile.twitterUrl,
      youtubeUrl: profile.youtubeUrl,
      twitchUrl: profile.twitchUrl,
      websiteUrl: profile.websiteUrl,
      bannerUrl: profile.bannerUrl,
      languages: profile.languages,
      timezone: profile.timezone,
      isVerified: profile.isVerified,
      isRecruiting: profile.isRecruiting,
      rsiArchetype: profile.rsiArchetype,
      rsiCommitment: profile.rsiCommitment,
      rsiRolePlay: profile.rsiRolePlay,
      rsiExclusive: profile.rsiExclusive,
      skillDistribution: skillDistributions.get(profile.organizationId),
    };
  }

  /**
   * Get or create a profile for an organization (for admin use)
   *
   * @param organizationId Organization ID
   * @returns Profile entity
   */
  async getOrCreateProfile(organizationId: string): Promise<PublicOrgProfile> {
    let profile = await this.profileRepository.findOne({
      where: { organizationId },
      relations: ['organization'],
    });

    if (!profile) {
      const organization = await this.organizationRepository.findOne({
        where: { id: organizationId },
      });

      if (!organization) {
        throw new Error('Organization not found');
      }

      const { slugify } = await import('../../utils/slugify');

      // Generate unique slug with retry on unique constraint violation
      const slug = await this.generateUniqueSlug(slugify(organization.name));

      profile = this.profileRepository.create({
        organizationId,
        slug,
        isPublic: false,
        primaryFocus: OrgPrimaryFocus.MIXED,
        activityLevel: ActivityLevel.MODERATE,
        memberCount: organization.totalMembers || 0,
        isVerified: false,
        isRecruiting: false,
      });

      profile = await this.profileRepository.save(profile);
      logger.info(`Created public profile for organization ${organizationId}`);
      invalidateDirectoryStatsCache();
    }

    return profile;
  }

  /**
   * Update public profile settings
   * Requires authentication (handled by controller)
   *
   * @param organizationId Organization ID
   * @param input Profile update data
   * @returns Updated profile
   */
  async updateProfile(
    organizationId: string,
    input: PublicProfileInput
  ): Promise<PublicOrgProfile> {
    const profile = await this.getOrCreateProfile(organizationId);

    // Update fields
    if (input.isPublic !== undefined) {
      profile.isPublic = input.isPublic;
    }
    if (input.tagline !== undefined) {
      profile.tagline = input.tagline;
    }
    if (input.primaryFocus !== undefined) {
      profile.primaryFocus = input.primaryFocus;
    }
    if (input.secondaryFocus !== undefined) {
      profile.secondaryFocus = input.secondaryFocus;
    }
    if (input.rsiUrl !== undefined) {
      profile.rsiUrl = input.rsiUrl;
    }
    if (input.discordInvite !== undefined) {
      profile.discordInvite = input.discordInvite;
    }
    if (input.languages !== undefined) {
      profile.languages = input.languages;
    }
    if (input.timezone !== undefined) {
      profile.timezone = input.timezone;
    }
    if (input.isRecruiting !== undefined) {
      profile.isRecruiting = input.isRecruiting;
    }
    if (input.useDiscordForApplications !== undefined) {
      profile.useDiscordForApplications = input.useDiscordForApplications;
    }
    if (input.scstatsVisibility !== undefined) {
      profile.scstatsVisibility = input.scstatsVisibility;
    }
    if (input.bannerUrl !== undefined) {
      profile.bannerUrl = input.bannerUrl;
    }
    // logoUrl is stored on the Organization entity, not the profile
    if (input.logoUrl !== undefined) {
      const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
      if (org) {
        org.logoUrl = input.logoUrl;
        await this.organizationRepository.save(org);
      }
    }

    const updated = await this.profileRepository.save(profile);
    logger.info(`Updated public profile for organization ${organizationId}`);
    invalidateDirectoryStatsCache();

    return updated;
  }

  /**
   * Batch-fetch live member counts from the organization_memberships table.
   * Returns a map of organizationId -> count.
   */
  private async getLiveMemberCounts(orgIds: string[]): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (orgIds.length === 0) {
      return result;
    }

    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const rows: Array<{ orgId: string; cnt: string }> = await membershipRepo
      .createQueryBuilder('m')
      .select('m.organizationId', 'orgId')
      .addSelect('COUNT(m.id)', 'cnt')
      .where('m.organizationId IN (:...orgIds)', { orgIds })
      .groupBy('m.organizationId')
      .getRawMany();

    for (const row of rows) {
      result.set(row.orgId, Number.parseInt(row.cnt, 10));
    }

    return result;
  }

  /**
   * Batch-fetch skill distributions from SCStats CSV import data.
   * Uses each member's stored hoursByCareer summary rather than UserShip.flightHours
   * (which is not populated by SCStats CSV imports).
   */
  private async batchGetSkillDistributions(
    orgIds: string[]
  ): Promise<
    Map<string, Record<string, { low: number; medium: number; high: number; expert: number }>>
  > {
    const result = new Map<
      string,
      Record<string, { low: number; medium: number; high: number; expert: number }>
    >();
    if (orgIds.length === 0) {
      return result;
    }

    try {
      const { userToOrgs, userIds } = await this.fetchMemberOrgMapping(orgIds);
      if (userIds.length === 0) {
        return result;
      }

      const csvImportRepo = AppDataSource.getRepository(SCStatsCsvImport);
      const imports = await csvImportRepo.find({
        where: { userId: In(userIds) },
        select: ['userId', 'summary'],
      });

      this.aggregateImportsIntoDistribution(imports, userToOrgs, result);
    } catch (err: unknown) {
      logger.warn('Failed to batch-fetch skill distributions', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return result;
  }

  /**
   * Fetch active memberships and build userId → orgId[] mapping.
   */
  private async fetchMemberOrgMapping(
    orgIds: string[]
  ): Promise<{ userToOrgs: Map<string, string[]>; userIds: string[] }> {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);

    const memberships: Array<{ orgId: string; userId: string }> = await membershipRepo
      .createQueryBuilder('m')
      .select('m.organizationId', 'orgId')
      .addSelect('m.userId', 'userId')
      .where('m.organizationId IN (:...orgIds)', { orgIds })
      .andWhere('m.isActive = true')
      .getRawMany();

    const userToOrgs = new Map<string, string[]>();
    for (const m of memberships) {
      const orgs = userToOrgs.get(m.userId) ?? [];
      orgs.push(m.orgId);
      userToOrgs.set(m.userId, orgs);
    }

    return { userToOrgs, userIds: [...new Set(memberships.map(m => m.userId))] };
  }

  /**
   * Process CSV imports and aggregate career hours into the result distribution.
   */
  private aggregateImportsIntoDistribution(
    imports: SCStatsCsvImport[],
    userToOrgs: Map<string, string[]>,
    result: Map<
      string,
      Record<string, { low: number; medium: number; high: number; expert: number }>
    >
  ): void {
    for (const csvImport of imports) {
      const summary = csvImport.summary;
      if (!summary) {
        continue;
      }

      const hoursByCareer = summary.hoursByCareer as
        Array<{ career: string; hours: number }> | undefined;
      if (!Array.isArray(hoursByCareer) || hoursByCareer.length === 0) {
        continue;
      }

      const orgs = userToOrgs.get(csvImport.userId);
      if (!orgs) {
        continue;
      }

      this.distributeCareerHoursToOrgs(hoursByCareer, orgs, result);
    }
  }

  /**
   * Distribute a single member's career hours into the per-org skill distribution map.
   */
  private distributeCareerHoursToOrgs(
    entries: Array<{ career: string; hours: number }>,
    orgIds: string[],
    result: Map<
      string,
      Record<string, { low: number; medium: number; high: number; expert: number }>
    >
  ): void {
    for (const entry of entries) {
      const hours = Number(entry.hours) || 0;
      if (hours <= 0) {
        continue;
      }

      const category = entry.career;
      const bucket = this.bucketFlightHours(hours);

      for (const orgId of orgIds) {
        let dist = result.get(orgId);
        if (!dist) {
          dist = {};
          result.set(orgId, dist);
        }
        if (!dist[category]) {
          dist[category] = { low: 0, medium: 0, high: 0, expert: 0 };
        }
        dist[category][bucket]++;
      }
    }
  }

  /**
   * Bucket flight hours into a tier label.
   */
  private bucketFlightHours(hours: number): 'low' | 'medium' | 'high' | 'expert' {
    if (hours < 50) {
      return 'low';
    }
    if (hours < 200) {
      return 'medium';
    }
    if (hours < 500) {
      return 'high';
    }
    return 'expert';
  }

  /**
   * Sync member count from organization
   *
   * @param organizationId Organization ID
   * @returns Updated profile
   */
  async syncMemberCount(organizationId: string): Promise<PublicOrgProfile | null> {
    const profile = await this.profileRepository.findOne({
      where: { organizationId },
    });

    if (!profile) {
      return null;
    }

    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (organization) {
      profile.memberCount = organization.totalMembers || 0;
      return this.profileRepository.save(profile);
    }

    return profile;
  }

  /**
   * Sync public profile data from RSI organization page.
   * Pulls logo, banner, description, focus, member count, and social links.
   * Only overwrites fields that are currently empty/null on the profile.
   *
   * @param organizationId Internal organization ID
   * @param rsiSid RSI organization SID (e.g., 'FRINGENAUTS')
   * @returns Updated profile with RSI data merged
   */
  async syncFromRsi(organizationId: string, rsiSid: string): Promise<PublicOrgProfile> {
    const { RsiCrawlerService } = await import('../external/RsiCrawlerService');
    const crawler = new RsiCrawlerService();

    const rsiData = await crawler.crawlOrganization(rsiSid);
    const profile = await this.getOrCreateProfile(organizationId);

    // Populate empty profile fields from RSI data (don't overwrite user customizations)
    this.applyRsiFieldsToProfile(profile, rsiData);

    // Always update RSI org metadata (these reflect live RSI settings)
    this.applyRsiMetadataToProfile(profile, rsiData);

    // Store RSI logo on the Organization entity and propagate rsiVerified
    await this.syncOrgEntityFromRsi(organizationId, profile, rsiData);

    const updated = await this.profileRepository.save(profile);
    logger.info(`Synced public profile from RSI for org ${organizationId} (SID: ${rsiSid})`);
    return updated;
  }

  /**
   * Populate empty profile fields from RSI crawl data.
   * Does NOT overwrite manually-set values — only fills blanks.
   */
  private applyRsiFieldsToProfile(
    profile: PublicOrgProfile,
    rsiData: {
      banner?: string;
      description?: string;
      focus?: { primary?: string; secondary?: string };
      links?: { website?: string; discord?: string };
      memberCount: number;
      language?: string;
    }
  ): void {
    if (rsiData.banner) {
      profile.bannerUrl = rsiData.banner;
    }
    if (!profile.tagline && rsiData.description) {
      profile.tagline =
        rsiData.description.length > 200
          ? `${rsiData.description.slice(0, 197)}...`
          : rsiData.description;
    }
    if (profile.primaryFocus === OrgPrimaryFocus.MIXED && rsiData.focus?.primary) {
      const mapped = this.mapRsiFocusToEnum(rsiData.focus.primary);
      if (mapped) {
        profile.primaryFocus = mapped;
      }
    }
    if (
      (!profile.secondaryFocus || profile.secondaryFocus.length === 0) &&
      rsiData.focus?.secondary
    ) {
      const mapped = this.mapRsiFocusToEnum(rsiData.focus.secondary);
      if (mapped) {
        profile.secondaryFocus = [mapped];
      }
    }
    if (!profile.rsiUrl && rsiData.links?.website) {
      profile.rsiUrl = rsiData.links.website;
    }
    if (!profile.discordInvite && rsiData.links?.discord) {
      profile.discordInvite = rsiData.links.discord;
    }
    if (rsiData.memberCount > 0) {
      profile.memberCount = rsiData.memberCount;
    }
    if (rsiData.language && (!profile.languages || profile.languages.length === 0)) {
      profile.languages = [rsiData.language];
    }
  }

  /**
   * Apply always-updated RSI organization metadata to profile.
   */
  private applyRsiMetadataToProfile(
    profile: PublicOrgProfile,
    rsiData: {
      archetype?: string;
      commitment?: string;
      roleplay?: string;
      recruiting?: string;
      exclusive?: string;
    }
  ): void {
    if (rsiData.archetype) {
      profile.rsiArchetype = rsiData.archetype;
    }
    if (rsiData.commitment) {
      profile.rsiCommitment = rsiData.commitment;
    }
    if (rsiData.roleplay !== undefined) {
      const rp = rsiData.roleplay.toLowerCase().trim();
      profile.rsiRolePlay = rp === 'yes' || rp === 'true';
    }
    if (rsiData.recruiting !== undefined) {
      const recruiting = rsiData.recruiting.toLowerCase().trim();
      if (recruiting.includes('yes') || recruiting.includes('open')) {
        profile.isRecruiting = true;
      }
    }
    if (rsiData.exclusive !== undefined) {
      const excl = rsiData.exclusive.toLowerCase().trim();
      profile.rsiExclusive = excl === 'yes' || excl === 'exclusive' || excl === 'true';
    }
  }

  /**
   * Sync RSI logo to Organization entity and propagate rsiVerified flag.
   */
  private async syncOrgEntityFromRsi(
    organizationId: string,
    profile: PublicOrgProfile,
    rsiData: { logo?: string }
  ): Promise<void> {
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org) {
      return;
    }
    if (rsiData.logo) {
      org.logoUrl = rsiData.logo;
      await this.organizationRepository.save(org);
    }
    if (org.rsiVerified && !profile.isVerified) {
      profile.isVerified = true;
    }
  }

  /**
   * Apply directory filter criteria to a query builder.
   */
  private applyDirectoryFilters(
    qb: SelectQueryBuilder<PublicOrgProfile>,
    filters: DirectoryFilterOptions
  ): void {
    if (filters.primaryFocuses && filters.primaryFocuses.length > 0) {
      qb.andWhere('profile.primaryFocus IN (:...primaryFocuses)', {
        primaryFocuses: filters.primaryFocuses,
      });
    } else if (filters.primaryFocus) {
      qb.andWhere('profile.primaryFocus = :primaryFocus', { primaryFocus: filters.primaryFocus });
    }

    if (filters.activityLevels && filters.activityLevels.length > 0) {
      qb.andWhere('profile.activityLevel IN (:...activityLevels)', {
        activityLevels: filters.activityLevels,
      });
    } else if (filters.activityLevel) {
      qb.andWhere('profile.activityLevel = :activityLevel', {
        activityLevel: filters.activityLevel,
      });
    }

    if (filters.isRecruiting !== undefined) {
      qb.andWhere('profile.isRecruiting = :isRecruiting', { isRecruiting: filters.isRecruiting });
    }
    if (filters.isVerified !== undefined) {
      qb.andWhere('profile.isVerified = :isVerified', { isVerified: filters.isVerified });
    }
    if (filters.minMemberCount !== undefined) {
      qb.andWhere('profile.memberCount >= :minMemberCount', {
        minMemberCount: filters.minMemberCount,
      });
    }
    if (filters.maxMemberCount !== undefined) {
      qb.andWhere('profile.memberCount <= :maxMemberCount', {
        maxMemberCount: filters.maxMemberCount,
      });
    }
    if (filters.languages && filters.languages.length > 0) {
      qb.andWhere('profile.languages ?| :languages', { languages: filters.languages });
    }
    if (filters.timezone) {
      qb.andWhere('profile.timezone = :timezone', { timezone: filters.timezone });
    }
    if (filters.searchTerm) {
      const escaped = filters.searchTerm
        .replaceAll('%', String.raw`\%`)
        .replaceAll('_', String.raw`\_`);
      qb.andWhere(
        '(org.name ILIKE :search OR org.description ILIKE :search OR profile.tagline ILIKE :search)',
        { search: `%${escaped}%` }
      );
    }
  }

  /** Map RSI focus string to OrgPrimaryFocus enum value */
  private mapRsiFocusToEnum(rsiFocus: string): OrgPrimaryFocus | null {
    const mapping: Record<string, OrgPrimaryFocus> = {
      'bounty hunting': OrgPrimaryFocus.BOUNTY_HUNTING,
      exploration: OrgPrimaryFocus.EXPLORATION,
      freelancing: OrgPrimaryFocus.MIXED,
      infiltration: OrgPrimaryFocus.SECURITY,
      medical: OrgPrimaryFocus.MEDICAL,
      piracy: OrgPrimaryFocus.PIRACY,
      resources: OrgPrimaryFocus.MINING,
      scouting: OrgPrimaryFocus.EXPLORATION,
      security: OrgPrimaryFocus.SECURITY,
      smuggling: OrgPrimaryFocus.TRADING,
      social: OrgPrimaryFocus.SOCIAL,
      trading: OrgPrimaryFocus.TRADING,
      transport: OrgPrimaryFocus.TRANSPORT,
    };
    const key = rsiFocus.toLowerCase().trim();
    return mapping[key] ?? null;
  }

  /**
   * Set verification status (admin only)
   *
   * @param organizationId Organization ID
   * @param isVerified Verification status
   * @returns Updated profile
   */
  async setVerificationStatus(
    organizationId: string,
    isVerified: boolean
  ): Promise<PublicOrgProfile> {
    const profile = await this.getOrCreateProfile(organizationId);
    profile.isVerified = isVerified;
    const saved = await this.profileRepository.save(profile);
    invalidateDirectoryStatsCache();
    return saved;
  }

  /**
   * Delete public profile
   *
   * @param organizationId Organization ID
   * @returns Success status
   */
  async deleteProfile(organizationId: string): Promise<boolean> {
    const result = await this.profileRepository.delete({ organizationId });
    const deleted = (result.affected || 0) > 0;
    if (deleted) {
      invalidateDirectoryStatsCache();
    }
    return deleted;
  }

  /**
   * Sync slug when organization name changes.
   * Generates a new unique slug from the updated name.
   *
   * @param organizationId Organization ID
   * @param newName The new organization name
   * @returns Updated profile or null if no profile exists
   */
  async syncSlug(organizationId: string, newName: string): Promise<PublicOrgProfile | null> {
    const profile = await this.profileRepository.findOne({
      where: { organizationId },
    });

    if (!profile) {
      return null;
    }

    const { slugify } = await import('../../utils/slugify');
    const slug = await this.generateUniqueSlug(slugify(newName), profile.id);

    profile.slug = slug;
    const updated = await this.profileRepository.save(profile);
    logger.info(`Synced slug for organization ${organizationId} to "${slug}"`);
    return updated;
  }

  /**
   * Generate a unique slug, appending a numeric suffix on collision.
   * Retries on unique constraint violation (race condition safety).
   *
   * @param baseSlug The base slug derived from the name
   * @param excludeProfileId Optional profile ID to exclude from collision check (for updates)
   * @returns A slug guaranteed unique at the time of check
   */
  private async generateUniqueSlug(baseSlug: string, excludeProfileId?: string): Promise<string> {
    const MAX_SUFFIX = 100;
    let slug = baseSlug;
    let suffix = 2;

    while (suffix <= MAX_SUFFIX + 1) {
      const existing = await this.profileRepository.findOne({ where: { slug } });
      if (!existing || existing.id === excludeProfileId) {
        return slug;
      }
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    throw new Error(
      `Unable to generate unique slug for "${baseSlug}" after ${MAX_SUFFIX} attempts`
    );
  }

  /**
   * Get all available focus options
   * Used for populating filter dropdowns
   */
  getFocusOptions(): OrgPrimaryFocus[] {
    return Object.values(OrgPrimaryFocus);
  }

  /**
   * Get all available activity level options
   * Used for populating filter dropdowns
   */
  getActivityLevelOptions(): ActivityLevel[] {
    return Object.values(ActivityLevel);
  }

  /**
   * Get directory statistics (for public display)
   */
  async getDirectoryStats(): Promise<{
    totalOrganizations: number;
    recruitingOrganizations: number;
    verifiedOrganizations: number;
    byFocus: Record<string, number>;
  }> {
    // Redis cache: 5 min TTL (Phase 5.8) — public endpoint, high traffic
    const cacheKey = 'public:directory:stats';
    const cached = await cache.get<{
      totalOrganizations: number;
      recruitingOrganizations: number;
      verifiedOrganizations: number;
      byFocus: Record<string, number>;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Single query with conditional aggregation (replaces 3 COUNT + 1 GROUP BY)
    const stats = await this.profileRepository
      .createQueryBuilder('profile')
      .select('COUNT(*)::int', 'total')
      .addSelect('SUM(CASE WHEN profile.isRecruiting = true THEN 1 ELSE 0 END)::int', 'recruiting')
      .addSelect('SUM(CASE WHEN profile.isVerified = true THEN 1 ELSE 0 END)::int', 'verified')
      .where('profile.isPublic = :isPublic', { isPublic: true })
      .getRawOne<{ total: number; recruiting: number; verified: number }>();

    const focusCounts = await this.profileRepository
      .createQueryBuilder('profile')
      .select('profile.primaryFocus', 'focus')
      .addSelect('COUNT(*)::int', 'count')
      .where('profile.isPublic = :isPublic', { isPublic: true })
      .groupBy('profile.primaryFocus')
      .getRawMany<{ focus: string; count: number }>();

    const byFocus: Record<string, number> = {};
    for (const row of focusCounts) {
      if (row.focus) {
        byFocus[row.focus] = row.count;
      }
    }

    const result = {
      totalOrganizations: stats?.total ?? 0,
      recruitingOrganizations: stats?.recruiting ?? 0,
      verifiedOrganizations: stats?.verified ?? 0,
      byFocus,
    };

    await cache.set(cacheKey, result, 300);

    return result;
  }
}
