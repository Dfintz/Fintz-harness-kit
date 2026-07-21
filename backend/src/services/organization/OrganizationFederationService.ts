import type {
  FederationAssociationType,
  FederationFleetItem,
  FederationFleetsResponse,
  FederationGovernance,
  FederationMemberStatus,
  FederationRole,
  FederationSettings,
  FederationStats,
  FederationStatus,
  FederationTreaty,
  FederationUnitItem,
  FederationUnitsResponse,
  FederationVote,
  ProposalStatus,
  ProposalType,
  PublicFederationListItem,
  SharedResource,
  TreatySignature,
  UpdateFederationSettingsRequest,
  VoteChoice,
} from '@sc-fleet-manager/shared-types';
import { In, QueryRunner, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../data-source';
import { AllianceDiplomacy, DiplomacyStatus } from '../../models/AllianceDiplomacy';
import { Federation } from '../../models/Federation';
import { FederationAmbassador } from '../../models/FederationAmbassador';
import { FederationMember as FederationMemberEntity } from '../../models/FederationMember';
import { FederationProposal as FederationProposalEntity } from '../../models/FederationProposal';
import { Fleet } from '../../models/Fleet';
import { FleetShip } from '../../models/FleetShip';
import { Organization } from '../../models/Organization';
import { OrganizationMembership } from '../../models/OrganizationMembership';
import {
  OrganizationRelationship,
  RelationshipStatus,
  RelationshipType,
} from '../../models/OrganizationRelationship';
import { PublicOrgProfile } from '../../models/PublicOrgProfile';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { slugify } from '../../utils/slugify';
import { sendOrganizationNotification } from '../../websocket/controllers/notificationWebSocketController';
import { NotificationService } from '../communication/notifications/NotificationService';

// DTOs/result shapes extracted to a sibling types module (E5 decomposition); imported
// for internal use and re-exported below so consumers' import paths are unchanged.
import type {
  FederationConfig,
  FederationMemberData,
  FederationProposalData,
} from './OrganizationFederationService.types';

// Re-export shared types for backward compatibility
export type {
  FederationGovernance,
  FederationRole,
  FederationStats,
  FederationTreaty,
  FederationVote,
  ProposalStatus,
  ProposalType,
  PublicFederationListItem,
  SharedResource,
  VoteChoice,
} from '@sc-fleet-manager/shared-types';

// Federation DTOs/result shapes live in `./OrganizationFederationService.types`;
// re-exported here so `./OrganizationFederationService` and the `services/organization`
// barrel keep exposing them unchanged.
export type {
  FederationConfig,
  FederationMemberData,
  FederationProposalData,
} from './OrganizationFederationService.types';

/**
 * OrganizationFederationService - Manages organization federations
 *
 * Provides:
 * - Federation creation and management
 * - Member invitation and onboarding
 * - Governance and voting systems
 * - Shared resource management
 * - Treaty management
 * - Federation analytics
 *
 * Persistence: PostgreSQL via TypeORM (Federation, FederationMember, FederationProposal entities).
 * Previously used in-memory Maps — migrated to DB in Phase 4.2.1.
 */
export class OrganizationFederationService {
  private static instance: OrganizationFederationService;
  private readonly organizationRepository: Repository<Organization>;
  private readonly relationshipRepository: Repository<OrganizationRelationship>;
  private readonly diplomacyRepository: Repository<AllianceDiplomacy>;
  private readonly profileRepository: Repository<PublicOrgProfile>;
  private readonly federationRepository: Repository<Federation>;
  private readonly memberRepository: Repository<FederationMemberEntity>;
  private readonly proposalRepository: Repository<FederationProposalEntity>;

  constructor() {
    this.organizationRepository = AppDataSource.getRepository(Organization);
    this.relationshipRepository = AppDataSource.getRepository(OrganizationRelationship);
    this.diplomacyRepository = AppDataSource.getRepository(AllianceDiplomacy);
    this.profileRepository = AppDataSource.getRepository(PublicOrgProfile);
    this.federationRepository = AppDataSource.getRepository(Federation);
    this.memberRepository = AppDataSource.getRepository(FederationMemberEntity);
    this.proposalRepository = AppDataSource.getRepository(FederationProposalEntity);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): OrganizationFederationService {
    if (!OrganizationFederationService.instance) {
      OrganizationFederationService.instance = new OrganizationFederationService();
    }
    return OrganizationFederationService.instance;
  }

  // ==================== HELPER: Entity → FederationConfig ====================

  /**
   * Convert a Federation entity (with loaded members) into a FederationConfig
   * that matches the old in-memory interface.
   */
  private toFederationConfig(entity: Federation): FederationConfig {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description,
      founderId: entity.founderId,
      founderOrgId: entity.founderOrgId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      governance: entity.governance,
      members: (entity.members ?? []).map(m => this.toMemberData(m)),
      sharedResources: entity.sharedResources ?? [],
      treaties: entity.treaties ?? [],
      status: entity.status,
      isPublic: entity.isPublic,
      tags: entity.tags ?? [],
      logoUrl: entity.logoUrl,
      bannerUrl: entity.bannerUrl,
      discordUrl: entity.discordUrl,
      websiteUrl: entity.websiteUrl,
      reviewDate: entity.reviewDate ?? null,
      expiryDate: entity.expiryDate ?? null,
      autoRenew: entity.autoRenew ?? false,
      settings: entity.settings ?? {},
    };
  }

  /**
   * Convert a FederationMember entity to a FederationMemberData interface
   */
  private toMemberData(entity: FederationMemberEntity): FederationMemberData {
    return {
      id: entity.id,
      organizationId: entity.organizationId,
      organizationName: entity.organizationName,
      role: entity.role,
      joinedAt: entity.joinedAt,
      status: entity.status,
      associationType: entity.associationType ?? 'full_member',
      votingPower: entity.votingPower,
      contributions: entity.contributions,
    };
  }

  /**
   * Send in-app notifications to the owner/admin leaders of an organization.
   */
  private async notifyOrgLeaders(
    organizationId: string,
    notification: {
      type: string;
      title: string;
      message: string;
      data?: Record<string, unknown>;
    }
  ): Promise<void> {
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const leaderMemberships = await membershipRepo.find({
      where: [
        { organizationId, role: { name: 'owner' }, isActive: true },
        { organizationId, role: { name: 'admin' }, isActive: true },
      ],
      relations: ['role'],
    });

    if (leaderMemberships.length === 0) {
      return;
    }

    const notificationService = new NotificationService(undefined, undefined);
    await Promise.all(
      leaderMemberships.map(membership =>
        notificationService.create({
          userId: membership.userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: 'high',
        })
      )
    );
  }

  /**
   * Convert a FederationProposal entity to a FederationProposalData interface
   */
  private toProposalData(entity: FederationProposalEntity): FederationProposalData {
    return {
      id: entity.id,
      federationId: entity.federationId,
      type: entity.type,
      title: entity.title,
      description: entity.description,
      proposedBy: entity.proposedBy,
      proposedByOrg: entity.proposedByOrg,
      createdAt: entity.createdAt,
      votingEndsAt: entity.votingEndsAt,
      votes: entity.votes ?? [],
      status: entity.status,
      requiredApproval: entity.requiredApproval,
      metadata: entity.metadata,
    };
  }

  /**
   * Load a federation with its members relation.
   */
  private async loadFederation(federationId: string): Promise<Federation | null> {
    // Load federation with members — most callers need member data for auth/role checks
    return this.federationRepository.findOne({
      where: { id: federationId },
      relations: ['members'],
    });
  }

  /**
   * Load federation metadata only (no members). Use for stats/count queries
   * where member data is aggregated via SQL instead of entity traversal.
   */
  private async loadFederationMetadataOnly(federationId: string): Promise<Federation | null> {
    return this.federationRepository.findOne({
      where: { id: federationId },
    });
  }

  /**
   * Find a single federation member by organizationId.
   * O(1) indexed query — avoids loading full members array.
   */
  private async findMember(
    federationId: string,
    organizationId: string
  ): Promise<FederationMemberEntity | null> {
    return this.memberRepository.findOne({
      where: { federationId, organizationId },
    });
  }

  // ==================== FEDERATION MANAGEMENT ====================

  /**
   * Create a new federation
   */
  async createFederation(
    founderId: string,
    founderOrgId: string,
    founderOrgName: string | undefined,
    data: {
      name: string;
      description: string;
      governance?: Partial<FederationGovernance>;
      isPublic?: boolean;
      tags?: string[];
    }
  ): Promise<FederationConfig> {
    // Resolve org name from DB if not provided by the caller
    let resolvedOrgName = founderOrgName;
    if (!resolvedOrgName) {
      const org = await this.organizationRepository.findOne({
        where: { id: founderOrgId },
        select: ['name'],
      });
      resolvedOrgName = org?.name ?? 'Unknown Organization';
    }

    // Check for duplicate federation name (case-insensitive)
    const trimmedName = data.name.trim();
    const existingFederation = await this.federationRepository
      .createQueryBuilder('federation')
      .where('LOWER(federation.name) = LOWER(:name)', { name: trimmedName })
      .andWhere('federation.status != :dissolved', { dissolved: 'dissolved' })
      .getOne();

    if (existingFederation) {
      throw new ConflictError(`An alliance named "${trimmedName}" already exists`);
    }

    const defaultGovernance: FederationGovernance = {
      votingSystem: 'majority',
      requiredApprovalThreshold: 51,
      councilSize: 5,
      leaderTermDays: 90,
      amendmentThreshold: 67,
      successionMode: 'fixed',
      ...data.governance,
    };

    // Use a transaction to ensure both federation and founder member are created atomically.
    // Without this, a failure on the member insert would orphan the federation.
    const queryRunner: QueryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let savedFederationId: string;

    try {
      // Look up founder user early — needed for both ambassador and chairman
      const founderUser = await queryRunner.manager.findOne(User, {
        where: { id: founderId },
        select: ['id', 'username', 'displayName'],
      });
      const founderName = founderUser?.displayName ?? founderUser?.username ?? 'Founder';

      // Set the founder as the initial chairman
      const now = new Date();
      const termEndDate =
        defaultGovernance.successionMode === 'fixed'
          ? null
          : new Date(
              now.getTime() + defaultGovernance.leaderTermDays * 24 * 60 * 60 * 1000
            ).toISOString();

      defaultGovernance.chairman = {
        organizationId: founderOrgId,
        organizationName: resolvedOrgName,
        userId: founderId,
        userName: founderName,
        termStart: now.toISOString(),
        termEnd: termEndDate,
      };
      defaultGovernance.rotationOrder = [founderOrgId];

      // Create and save the federation entity
      const federation = queryRunner.manager.create(Federation, {
        name: trimmedName,
        description: data.description,
        founderId,
        founderOrgId,
        governance: defaultGovernance,
        sharedResources: [],
        treaties: [],
        status: 'forming',
        isPublic: data.isPublic ?? false,
        tags: data.tags ?? [],
      });

      const savedFederation = await queryRunner.manager.save(Federation, federation);
      savedFederationId = savedFederation.id;

      // Create the founder as the first member
      const founderMember = queryRunner.manager.create(FederationMemberEntity, {
        federationId: savedFederation.id,
        organizationId: founderOrgId,
        organizationName: resolvedOrgName,
        role: 'founder',
        status: 'active',
        votingPower: 1,
        contributions: 0,
      });

      await queryRunner.manager.save(FederationMemberEntity, founderMember);

      // Auto-appoint the founding user as a council ambassador with all permissions
      // so they can immediately manage the federation (announcements, wiki, teams, etc.)
      const founderAmbassador = queryRunner.manager.create(FederationAmbassador, {
        federationId: savedFederation.id,
        organizationId: founderOrgId,
        organizationName: resolvedOrgName,
        userId: founderId,
        userName: founderName,
        role: 'council',
        permissions: ['view', 'vote', 'announce', 'intel', 'wiki', 'resources', 'hr', 'settings'],
        isActive: true,
        title: 'Founder',
      });

      await queryRunner.manager.save(FederationAmbassador, founderAmbassador);

      await queryRunner.commitTransaction();
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Reload with members relation (outside transaction — read-only)
    const loaded = await this.loadFederation(savedFederationId);
    if (!loaded) {
      throw new Error(`Federation ${savedFederationId} not found after creation`);
    }

    logger.info(`Created federation: ${data.name}`, {
      federationId: savedFederationId,
      founderOrgId,
    });

    return this.toFederationConfig(loaded);
  }

  /**
   * Get federation by ID.
   *
   * NOTE: This is a data-access method with no built-in authorization.
   * Callers (controllers) MUST enforce access control before calling.
   */
  async getFederation(federationId: string): Promise<FederationConfig | null> {
    const entity = await this.loadFederation(federationId);
    return entity ? this.toFederationConfig(entity) : null;
  }

  /**
   * Resolve a federation by slug (URL-friendly name).
   * Unlike getPublicFederation, this does NOT filter by isPublic.
   * Callers (controllers) MUST enforce authentication/access control.
   */
  async resolveBySlug(slug: string): Promise<{ id: string; name: string } | null> {
    const { isUUID } = await import('../../utils/slugify');

    let federation: Federation | null;

    if (isUUID(slug)) {
      federation = await this.federationRepository.findOne({
        where: { id: slug },
        select: ['id', 'name'],
      });
    } else {
      federation =
        (await this.federationRepository
          .createQueryBuilder('federation')
          .select(['federation.id', 'federation.name'])
          .where('federation.status IN (:...statuses)', { statuses: ['active', 'forming'] })
          .andWhere(
            String.raw`LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(federation.name), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'), '-+', '-', 'g'))) = LOWER(:slug)`,
            { slug }
          )
          .getOne()) ?? null;
    }

    return federation ? { id: federation.id, name: federation.name } : null;
  }

  /**
   * Disband (dissolve) a federation.
   * Only the founder's organization may invoke this.
   */
  async disbandFederation(federationId: string, actorOrgId: string): Promise<void> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const actor = await this.findMember(federationId, actorOrgId);
    if (actor?.role !== 'founder') {
      throw new ForbiddenError('Only the founder can disband the alliance');
    }

    if (federation.status === 'dissolved') {
      throw new ConflictError('Federation is already dissolved');
    }

    // Remove all members
    await this.memberRepository.delete({ federationId });

    // Mark as dissolved
    federation.status = 'dissolved';
    await this.federationRepository.save(federation);

    logger.info('Federation disbanded', { federationId, actorOrgId });
  }

  /**
   * Get all federations for an organization
   */
  async getOrganizationFederations(organizationId: string): Promise<FederationConfig[]> {
    // Find all federation IDs where the org is a member
    const memberships = await this.memberRepository.find({
      where: { organizationId },
      select: ['federationId'],
    });

    if (memberships.length === 0) {
      return [];
    }

    const federationIds = memberships.map(m => m.federationId);

    // Load full federations with members
    const federations = await this.federationRepository
      .createQueryBuilder('federation')
      .leftJoinAndSelect('federation.members', 'member')
      .where('federation.id IN (:...ids)', { ids: federationIds })
      .getMany();

    return federations.map(f => this.toFederationConfig(f));
  }

  /**
   * Search public federations
   */
  async searchFederations(filters?: {
    name?: string;
    tags?: string[];
    minMembers?: number;
    maxMembers?: number;
  }): Promise<FederationConfig[]> {
    const qb = this.federationRepository
      .createQueryBuilder('federation')
      .leftJoinAndSelect('federation.members', 'member')
      .where('federation.isPublic = :isPublic', { isPublic: true })
      .andWhere('federation.status != :dissolved', { dissolved: 'dissolved' });

    if (filters?.name) {
      qb.andWhere(
        '(LOWER(federation.name) LIKE :search OR LOWER(federation.description) LIKE :search)',
        { search: `%${filters.name.toLowerCase()}%` }
      );
    }

    if (filters?.tags && filters.tags.length > 0) {
      // Check if any of the provided tags overlap with the JSONB tags array
      qb.andWhere('federation.tags ?| ARRAY[:...tags]', { tags: filters.tags });
    }

    let results = await qb.getMany();

    // Filter by member counts in-memory (simpler than a subquery for JSONB arrays)
    if (filters?.minMembers !== undefined) {
      const minMembers = filters.minMembers;
      results = results.filter(f => (f.members ?? []).length >= minMembers);
    }

    if (filters?.maxMembers !== undefined) {
      const maxMembers = filters.maxMembers;
      results = results.filter(f => (f.members ?? []).length <= maxMembers);
    }

    return results.map(f => this.toFederationConfig(f));
  }

  /**
   * Update federation details
   */
  async updateFederation(
    federationId: string,
    actorOrgId: string,
    updates: {
      name?: string;
      description?: string;
      isPublic?: boolean;
      tags?: string[];
      governance?: FederationGovernance;
      logoUrl?: string | null;
      bannerUrl?: string | null;
      discordUrl?: string | null;
      websiteUrl?: string | null;
      reviewDate?: string | null;
      expiryDate?: string | null;
      autoRenew?: boolean;
    }
  ): Promise<FederationConfig | null> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      return null;
    }

    // Check if actor has permission (leader or founder)
    const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId);
    if (!actorMember || !['founder', 'leader', 'council'].includes(actorMember.role)) {
      throw new ForbiddenError('Insufficient permissions to update federation');
    }

    if (updates.name) {
      await this.validateUniqueName(updates.name.trim(), federationId);
      federation.name = updates.name.trim();
    }
    if (updates.description) {
      federation.description = updates.description;
    }
    if (updates.isPublic !== undefined) {
      federation.isPublic = updates.isPublic;
    }
    if (updates.tags) {
      federation.tags = updates.tags;
    }
    if (updates.governance !== undefined) {
      this.validateGovernanceUpdate(federation);
      federation.governance = updates.governance;
    }
    this.applyOptionalFields(federation, updates);

    await this.federationRepository.save(federation);

    logger.info(`Updated federation: ${federation.name}`, { federationId, actorOrgId });

    return this.toFederationConfig(federation);
  }

  /**
   * Validate that a federation name is unique (case-insensitive), excluding the given federation.
   */
  private async validateUniqueName(name: string, excludeId: string): Promise<void> {
    const existing = await this.federationRepository
      .createQueryBuilder('federation')
      .where('LOWER(federation.name) = LOWER(:name)', { name })
      .andWhere('federation.id != :id', { id: excludeId })
      .andWhere('federation.status != :dissolved', { dissolved: 'dissolved' })
      .getOne();

    if (existing) {
      throw new ConflictError(`An alliance named "${name}" already exists`);
    }
  }

  /**
   * Validate that governance can be updated directly (single active member only).
   */
  private validateGovernanceUpdate(federation: Federation): void {
    const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
    if (activeMembers.length > 1) {
      throw new ValidationError(
        'Governance changes require a proposal when the alliance has multiple members. Use the "Propose Amendment" flow instead.'
      );
    }
  }

  /**
   * Apply optional URL, date, and flag fields from an update payload onto a federation entity.
   */
  private applyOptionalFields(
    federation: Federation,
    updates: {
      logoUrl?: string | null;
      bannerUrl?: string | null;
      discordUrl?: string | null;
      websiteUrl?: string | null;
      reviewDate?: string | null;
      expiryDate?: string | null;
      autoRenew?: boolean;
    }
  ): void {
    if (updates.logoUrl !== undefined) {
      federation.logoUrl = updates.logoUrl;
    }
    if (updates.bannerUrl !== undefined) {
      federation.bannerUrl = updates.bannerUrl;
    }
    if (updates.discordUrl !== undefined) {
      federation.discordUrl = updates.discordUrl;
    }
    if (updates.websiteUrl !== undefined) {
      federation.websiteUrl = updates.websiteUrl;
    }
    if (updates.reviewDate !== undefined) {
      federation.reviewDate = updates.reviewDate ? new Date(updates.reviewDate) : null;
    }
    if (updates.expiryDate !== undefined) {
      federation.expiryDate = updates.expiryDate ? new Date(updates.expiryDate) : null;
    }
    if (updates.autoRenew !== undefined) {
      federation.autoRenew = updates.autoRenew;
    }
  }

  /**
   * Activate a federation (transition from forming to active)
   */
  async activateFederation(
    federationId: string,
    actorOrgId: string
  ): Promise<FederationConfig | null> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      return null;
    }

    // Check if actor is founder
    const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId);
    if (actorMember?.role !== 'founder') {
      throw new ForbiddenError('Only founder can activate federation');
    }

    // Require at least 2 members to activate
    if ((federation.members ?? []).filter(m => m.status === 'active').length < 2) {
      throw new ValidationError('Federation requires at least 2 active members to activate');
    }

    federation.status = 'active';
    await this.federationRepository.save(federation);

    logger.info(`Activated federation: ${federation.name}`, { federationId });

    return this.toFederationConfig(federation);
  }

  // ==================== MEMBER MANAGEMENT ====================

  /**
   * Invite organization to federation
   */
  async inviteMember(
    federationId: string,
    inviterOrgId: string,
    targetOrgId: string,
    targetOrgName: string,
    role: FederationRole = 'member',
    associationType: FederationAssociationType = 'full_member'
  ): Promise<FederationMemberData> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    // Check if inviter has permission (targeted query instead of loading all members)
    const inviter = await this.findMember(federationId, inviterOrgId);
    if (!inviter || !['founder', 'leader', 'council'].includes(inviter.role)) {
      throw new ForbiddenError('Insufficient permissions to invite members');
    }

    // Check if already a member (targeted query)
    const existing = await this.findMember(federationId, targetOrgId);
    if (existing) {
      throw new ConflictError('Organization is already a member of this federation');
    }

    const newMember = this.memberRepository.create({
      federationId,
      organizationId: targetOrgId,
      organizationName: targetOrgName,
      role: role === 'founder' ? 'member' : role, // Cannot invite as founder
      status: 'pending',
      associationType,
      votingPower: role === 'observer' ? 0 : 1,
      contributions: 0,
    });

    const saved = await this.memberRepository.save(newMember);

    logger.info(`Invited organization to federation`, {
      federationId,
      targetOrgId,
      inviterOrgId,
    });

    // Notify target org leaders via in-app notification + WebSocket
    this.notifyOrgLeaders(targetOrgId, {
      type: 'federation_invitation',
      title: 'Alliance Invitation',
      message: `Your organization has been invited to join the alliance "${federation.name}".`,
      data: { federationId, federationName: federation.name, inviterOrgId },
    }).catch((err: unknown) =>
      logger.warn('Failed to send federation invitation notifications', { error: err })
    );

    // WebSocket push to target org room
    sendOrganizationNotification(targetOrgId, {
      type: 'info',
      title: 'Alliance Invitation',
      message: `Your organization has been invited to join the alliance "${federation.name}".`,
      category: 'organization',
      data: { federationId, federationName: federation.name },
    });

    return this.toMemberData(saved);
  }

  /**
   * Accept federation invitation
   */
  async acceptInvitation(
    federationId: string,
    organizationId: string
  ): Promise<FederationMemberData | null> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const memberEntity = await this.memberRepository.findOne({
      where: { federationId, organizationId },
    });

    if (!memberEntity) {
      throw new NotFoundError('Pending invitation');
    }

    if (memberEntity.status !== 'pending') {
      throw new ConflictError('Invitation has already been processed');
    }

    memberEntity.status = 'active';
    memberEntity.joinedAt = new Date();
    await this.memberRepository.save(memberEntity);

    // Create alliance relationships with other members
    await this.createMemberRelationships(federation, organizationId);

    // Add to rotation order if not already present
    const rotationOrder = federation.governance?.rotationOrder ?? [];
    if (!rotationOrder.includes(organizationId)) {
      rotationOrder.push(organizationId);
      federation.governance = {
        ...federation.governance,
        rotationOrder,
      };
      await this.federationRepository.save(federation);
    }

    logger.info(`Organization joined federation`, { federationId, organizationId });

    // Notify federation founder/leaders that the org accepted
    const leaderMembers = (federation.members ?? []).filter(
      m => ['founder', 'leader'].includes(m.role) && m.organizationId !== organizationId
    );
    for (const leader of leaderMembers) {
      this.notifyOrgLeaders(leader.organizationId, {
        type: 'federation_accepted',
        title: 'Alliance Invitation Accepted',
        message: `${memberEntity.organizationName} has joined the alliance "${federation.name}".`,
        data: { federationId, federationName: federation.name, joinedOrgId: organizationId },
      }).catch((err: unknown) =>
        logger.warn('Failed to send federation accepted notification', { error: err })
      );

      sendOrganizationNotification(leader.organizationId, {
        type: 'success',
        title: 'Alliance Invitation Accepted',
        message: `${memberEntity.organizationName} has joined the alliance "${federation.name}".`,
        category: 'organization',
        data: { federationId, federationName: federation.name },
      });
    }

    // Federation Discord role sync — auto-create org role in central guild
    try {
      const { FederationRoleSyncService } = await import('../federation/FederationRoleSyncService');
      await FederationRoleSyncService.getInstance().onOrgJoined(
        federationId,
        organizationId,
        memberEntity.organizationName
      );
    } catch (err: unknown) {
      logger.warn('Federation Discord role sync (org joined) failed — non-fatal', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return this.toMemberData(memberEntity);
  }

  /**
   * Remove member from federation
   */
  async removeMember(
    federationId: string,
    actorOrgId: string,
    targetOrgId: string,
    reason?: string
  ): Promise<void> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    // Check actor and target via targeted queries (avoid loading all members)
    const actor = await this.findMember(federationId, actorOrgId);
    const target =
      actorOrgId === targetOrgId ? actor : await this.findMember(federationId, targetOrgId);

    if (!target) {
      throw new ForbiddenError('Target organization is not a member');
    }

    // Cannot remove founder (not even self-removal)
    if (target.role === 'founder') {
      throw new ForbiddenError('Cannot remove the federation founder');
    }

    // Self-removal is allowed for non-founders
    const isSelfRemoval = actorOrgId === targetOrgId;

    if (!isSelfRemoval) {
      if (!actor || !['founder', 'leader'].includes(actor.role)) {
        throw new ForbiddenError('Insufficient permissions to remove members');
      }
    }

    await this.memberRepository.delete({
      federationId,
      organizationId: targetOrgId,
    });

    // Remove from rotation order
    const rotationOrder = federation.governance?.rotationOrder ?? [];
    const updatedRotation = rotationOrder.filter(id => id !== targetOrgId);
    if (updatedRotation.length !== rotationOrder.length) {
      federation.governance = {
        ...federation.governance,
        rotationOrder: updatedRotation,
      };
      await this.federationRepository.save(federation);
    }

    logger.info(`Removed organization from federation`, {
      federationId,
      targetOrgId,
      reason,
    });

    // Federation Discord role sync — strip roles or kick members of the departing org
    try {
      const { FederationRoleSyncService } = await import('../federation/FederationRoleSyncService');
      await FederationRoleSyncService.getInstance().onOrgLeft(federationId, targetOrgId);
    } catch (err: unknown) {
      logger.warn('Federation Discord role sync (org left) failed — non-fatal', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    federationId: string,
    actorOrgId: string,
    targetOrgId: string,
    newRole: FederationRole
  ): Promise<FederationMemberData | null> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const actor = await this.findMember(federationId, actorOrgId);

    if (!actor || !['founder', 'leader'].includes(actor.role)) {
      throw new ForbiddenError('Insufficient permissions to update roles');
    }

    const targetEntity = await this.memberRepository.findOne({
      where: { federationId, organizationId: targetOrgId },
    });

    if (!targetEntity) {
      throw new ForbiddenError('Target organization is not a member');
    }

    // Cannot change founder role
    if (targetEntity.role === 'founder' || newRole === 'founder') {
      throw new ForbiddenError('Cannot modify founder role');
    }

    targetEntity.role = newRole;
    targetEntity.votingPower = newRole === 'observer' ? 0 : 1;

    await this.memberRepository.save(targetEntity);

    logger.info(`Updated member role in federation`, {
      federationId,
      targetOrgId,
      newRole,
    });

    return this.toMemberData(targetEntity);
  }

  // ==================== CHAIRMAN / SUCCESSION ====================

  /**
   * Update the succession mode for the federation.
   * Only founders/leaders can change this.
   */
  async updateSuccessionMode(
    federationId: string,
    actorOrgId: string,
    mode: 'fixed' | 'rotation' | 'election',
    leaderTermDays?: number
  ): Promise<FederationGovernance> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const actor = await this.findMember(federationId, actorOrgId);
    if (!actor || !['founder', 'leader'].includes(actor.role)) {
      throw new ForbiddenError('Only founders and leaders can change the succession mode');
    }

    const governance = { ...federation.governance };
    governance.successionMode = mode;

    if (leaderTermDays !== undefined && leaderTermDays > 0) {
      governance.leaderTermDays = leaderTermDays;
    }

    // Recompute current chairman's term end based on new mode
    if (governance.chairman) {
      if (mode === 'fixed') {
        governance.chairman = { ...governance.chairman, termEnd: null };
      } else {
        const termStart = new Date(governance.chairman.termStart);
        const termEnd = new Date(
          termStart.getTime() + governance.leaderTermDays * 24 * 60 * 60 * 1000
        );
        governance.chairman = {
          ...governance.chairman,
          termEnd: termEnd.toISOString(),
        };
      }
    }

    federation.governance = governance;
    await this.federationRepository.save(federation);

    logger.info('Updated federation succession mode', {
      federationId,
      mode,
      leaderTermDays: governance.leaderTermDays,
    });

    return governance;
  }

  /**
   * Trigger chairman succession (rotation or election).
   * Called by a scheduled job or manually by current chairman / founder.
   */
  async succeedChairman(federationId: string, actorOrgId: string): Promise<FederationGovernance> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const governance = federation.governance;
    const mode = governance.successionMode ?? 'fixed';
    if (mode === 'fixed') {
      throw new ValidationError('Succession is disabled for this federation (mode: fixed)');
    }

    // Only current chairman or founder org can trigger succession
    const currentChairOrgId = governance.chairman?.organizationId;
    if (actorOrgId !== currentChairOrgId && actorOrgId !== federation.founderOrgId) {
      throw new ForbiddenError('Only the current chairman or founder can trigger succession');
    }

    const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
    if (activeMembers.length <= 1) {
      throw new ValidationError('Cannot rotate: only one active member');
    }

    if (mode === 'rotation') {
      return this.rotateChairman(federation);
    }

    // mode === 'election' — create a proposal for member orgs to vote
    return this.startChairmanElection(federation, actorOrgId);
  }

  /**
   * Rotate the chairman to the next org in the rotation order.
   */
  private async rotateChairman(federation: Federation): Promise<FederationGovernance> {
    const governance = { ...federation.governance };
    const rotationOrder = governance.rotationOrder ?? [];
    const activeOrgIds = new Set(
      (federation.members ?? []).filter(m => m.status === 'active').map(m => m.organizationId)
    );

    // Filter rotation order to only include active members
    const eligibleOrder = rotationOrder.filter(id => activeOrgIds.has(id));
    if (eligibleOrder.length <= 1) {
      throw new ValidationError('Not enough eligible organizations for rotation');
    }

    // Find current chairman's position and pick the next
    const currentIdx = eligibleOrder.indexOf(governance.chairman?.organizationId ?? '');
    const nextIdx = (currentIdx + 1) % eligibleOrder.length;
    const nextOrgId = eligibleOrder[nextIdx];

    const nextMember = (federation.members ?? []).find(m => m.organizationId === nextOrgId);
    if (!nextMember) {
      throw new NotFoundError('Next organization in rotation');
    }

    const now = new Date();
    const termEnd = new Date(now.getTime() + governance.leaderTermDays * 24 * 60 * 60 * 1000);

    // Get the new chairman's ambassador user
    const ambassadorRepo = AppDataSource.getRepository(FederationAmbassador);
    const ambassador = await ambassadorRepo.findOne({
      where: {
        federationId: federation.id,
        organizationId: nextOrgId,
        isActive: true,
      },
    });

    governance.chairman = {
      organizationId: nextOrgId,
      organizationName: nextMember.organizationName,
      userId: ambassador?.userId ?? '',
      userName: ambassador?.userName ?? nextMember.organizationName,
      termStart: now.toISOString(),
      termEnd: termEnd.toISOString(),
    };

    federation.governance = governance;
    await this.federationRepository.save(federation);

    logger.info('Federation chairman rotated', {
      federationId: federation.id,
      newChairmanOrg: nextOrgId,
      termEnd: termEnd.toISOString(),
    });

    return governance;
  }

  /**
   * Start a chairman election proposal.
   * Each active member org can be nominated; votes are cast via the proposal system.
   */
  private async startChairmanElection(
    federation: Federation,
    actorOrgId: string
  ): Promise<FederationGovernance> {
    const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
    const candidateNames = activeMembers.map(m => m.organizationName).join(', ');

    const actorMember = activeMembers.find(m => m.organizationId === actorOrgId);

    // Create a governance proposal for chairman election
    await this.createProposal(
      federation.id,
      actorOrgId,
      actorMember?.organizationName ?? 'Unknown',
      {
        type: 'amend_governance',
        title: 'Chairman Election',
        description: `Vote for the next federation chairman. Eligible candidates: ${candidateNames}. Vote "approve" to confirm the rotation to the next org in line, or "reject" to keep the current chairman.`,
        votingDurationDays: federation.governance.leaderTermDays > 7 ? 7 : 3,
      }
    );

    logger.info('Chairman election proposal created', {
      federationId: federation.id,
      candidates: activeMembers.length,
    });

    return federation.governance;
  }

  // ==================== GOVERNANCE & VOTING ====================

  /**
   * Create a proposal for federation voting
   */
  async createProposal(
    federationId: string,
    proposerOrgId: string,
    proposerName: string,
    data: {
      type: ProposalType;
      title: string;
      description: string;
      votingDurationDays?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<FederationProposalData> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const proposer = await this.findMember(federationId, proposerOrgId);
    if (proposer?.status !== 'active') {
      throw new ForbiddenError('Only active members can create proposals');
    }

    // Observers cannot create proposals
    if (proposer.role === 'observer') {
      throw new ForbiddenError('Observers cannot create proposals');
    }

    const votingDurationDays = data.votingDurationDays ?? 7;
    const votingEndsAt = new Date();
    votingEndsAt.setDate(votingEndsAt.getDate() + votingDurationDays);

    // Determine required approval based on proposal type
    const governance = federation.governance;
    let requiredApproval = governance.requiredApprovalThreshold;
    if (data.type === 'amend_governance' || data.type === 'dissolve') {
      requiredApproval = Math.max(requiredApproval, governance.amendmentThreshold);
    }

    const proposalEntity = this.proposalRepository.create({
      federationId,
      type: data.type,
      title: data.title,
      description: data.description,
      proposedBy: proposerName,
      proposedByOrg: proposerOrgId,
      votingEndsAt,
      votes: [],
      status: 'open',
      requiredApproval,
      metadata: data.metadata,
    });

    const saved = await this.proposalRepository.save(proposalEntity);

    logger.info(`Created federation proposal`, {
      federationId,
      proposalId: saved.id,
      type: data.type,
    });

    return this.toProposalData(saved);
  }

  /**
   * Cast a vote on a proposal
   */
  async castVote(
    proposalId: string,
    organizationId: string,
    organizationName: string,
    voterId: string,
    vote: VoteChoice,
    comment?: string
  ): Promise<FederationProposalData> {
    const proposalEntity = await this.proposalRepository.findOne({
      where: { id: proposalId },
    });
    if (!proposalEntity) {
      throw new NotFoundError('Proposal');
    }

    if (proposalEntity.status !== 'open') {
      throw new ConflictError('Voting is closed for this proposal');
    }

    if (new Date() > proposalEntity.votingEndsAt) {
      proposalEntity.status = 'expired';
      await this.proposalRepository.save(proposalEntity);
      throw new ConflictError('Voting period has ended');
    }

    const federation = await this.loadFederation(proposalEntity.federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const member = (federation.members ?? []).find(m => m.organizationId === organizationId);
    if (member?.status !== 'active' || member.votingPower === 0) {
      throw new ForbiddenError('Organization cannot vote on this proposal');
    }

    // Check for existing vote
    const votes = proposalEntity.votes ?? [];
    const existingVote = votes.find(v => v.organizationId === organizationId);
    if (existingVote) {
      throw new ConflictError('Organization has already voted');
    }

    const federationVote: FederationVote = {
      organizationId,
      organizationName,
      vote,
      votedBy: voterId,
      votedAt: new Date().toISOString(),
      weight: member.votingPower,
      comment,
    };

    votes.push(federationVote);
    proposalEntity.votes = votes;

    // Check if proposal should be resolved
    await this.checkAndResolveProposal(proposalEntity, federation);

    await this.proposalRepository.save(proposalEntity);

    logger.info(`Cast vote on proposal`, {
      proposalId,
      organizationId,
      vote,
    });

    return this.toProposalData(proposalEntity);
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string): Promise<FederationProposalData | null> {
    const entity = await this.proposalRepository.findOne({
      where: { id: proposalId },
    });
    return entity ? this.toProposalData(entity) : null;
  }

  /**
   * Get all proposals for a federation
   */
  async getFederationProposals(
    federationId: string,
    status?: ProposalStatus
  ): Promise<FederationProposalData[]> {
    const where: Record<string, unknown> = { federationId };
    if (status) {
      where.status = status;
    }

    const entities = await this.proposalRepository.find({ where: where as never });
    return entities.map(e => this.toProposalData(e));
  }

  // ==================== SHARED RESOURCES ====================

  /**
   * Add a shared resource to the federation
   */
  async addSharedResource(
    federationId: string,
    providerOrgId: string,
    resource: Omit<SharedResource, 'id'>
  ): Promise<SharedResource> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const providerMember = await this.memberRepository.findOne({
      where: { federationId, organizationId: providerOrgId },
    });
    if (providerMember?.status !== 'active') {
      throw new ForbiddenError('Organization is not an active member');
    }

    const sharedResource: SharedResource = {
      id: uuidv4(),
      ...resource,
      providedBy: providerOrgId,
    };

    const resources = federation.sharedResources ?? [];
    resources.push(sharedResource);
    federation.sharedResources = resources;
    await this.federationRepository.save(federation);

    // Increment contributions for the provider
    providerMember.contributions++;
    await this.memberRepository.save(providerMember);

    logger.info(`Added shared resource to federation`, {
      federationId,
      resourceId: sharedResource.id,
      type: resource.type,
    });

    return sharedResource;
  }

  /**
   * Remove a shared resource
   */
  async removeSharedResource(
    federationId: string,
    resourceId: string,
    actorOrgId: string
  ): Promise<void> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const resources = federation.sharedResources ?? [];
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) {
      throw new NotFoundError('Resource');
    }

    // Only the provider or federation leaders can remove
    const actor = await this.findMember(federationId, actorOrgId);
    if (
      resource.providedBy !== actorOrgId &&
      (!actor || !['founder', 'leader'].includes(actor.role))
    ) {
      throw new ForbiddenError('Insufficient permissions to remove resource');
    }

    federation.sharedResources = resources.filter(r => r.id !== resourceId);
    await this.federationRepository.save(federation);

    logger.info(`Removed shared resource from federation`, { federationId, resourceId });
  }

  // ==================== TREATIES ====================

  /**
   * Create a treaty proposal within the federation.
   * The treaty starts as 'proposed' — other member orgs can sign or reject it.
   * The creator's org is automatically signed.
   */
  async createTreaty(
    federationId: string,
    creatorOrgId: string,
    treaty: Pick<FederationTreaty, 'name' | 'type' | 'terms'> & {
      effectiveDate?: string;
      expirationDate?: string;
    }
  ): Promise<FederationTreaty> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const creator = await this.findMember(federationId, creatorOrgId);
    if (!creator || !['founder', 'leader', 'council'].includes(creator.role)) {
      throw new ForbiddenError('Insufficient permissions to create treaties');
    }

    // Build initial signatures: creator auto-signs, all other active members are pending
    const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
    const signatures: TreatySignature[] = activeMembers.map(m => ({
      organizationId: m.organizationId,
      organizationName: m.organizationName ?? m.organizationId,
      status: m.organizationId === creatorOrgId ? 'signed' : 'pending',
      ...(m.organizationId === creatorOrgId ? { respondedAt: new Date().toISOString() } : {}),
    }));

    const creatorMember = activeMembers.find(m => m.organizationId === creatorOrgId);

    const newTreaty: FederationTreaty = {
      id: uuidv4(),
      name: treaty.name,
      type: treaty.type,
      terms: treaty.terms,
      signatories: [creatorOrgId], // Creator is the first signatory
      effectiveDate: treaty.effectiveDate ?? new Date().toISOString(),
      ...(treaty.expirationDate ? { expirationDate: treaty.expirationDate } : {}),
      status: 'proposed',
      proposedBy: creatorOrgId,
      proposedByName: creatorMember?.organizationName ?? creatorOrgId,
      signatures,
    };

    const treaties = federation.treaties ?? [];
    treaties.push(newTreaty);
    federation.treaties = treaties;
    await this.federationRepository.save(federation);

    logger.info(`Created treaty proposal in federation`, {
      federationId,
      treatyId: newTreaty.id,
      type: treaty.type,
      proposedBy: creatorOrgId,
    });

    return newTreaty;
  }

  /**
   * Sign or reject a treaty proposal.
   * When all pending signatures are resolved, the treaty becomes 'active'
   * if at least 2 orgs signed (including the proposer).
   */
  async respondToTreaty(
    federationId: string,
    treatyId: string,
    actorOrgId: string,
    action: 'sign' | 'reject'
  ): Promise<FederationTreaty> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const treaties = federation.treaties ?? [];
    const treaty = treaties.find(t => t.id === treatyId);
    if (!treaty) {
      throw new NotFoundError('Treaty');
    }

    if (treaty.status !== 'proposed') {
      throw new ValidationError('Only proposed treaties can be signed or rejected');
    }

    const signatures = treaty.signatures ?? [];
    const orgSignature = signatures.find(s => s.organizationId === actorOrgId);
    if (!orgSignature) {
      throw new ForbiddenError('Your organization is not a party to this treaty');
    }

    if (orgSignature.status !== 'pending') {
      throw new ValidationError(`Your organization has already ${orgSignature.status} this treaty`);
    }

    // Update the signature
    orgSignature.status = action === 'sign' ? 'signed' : 'rejected';
    orgSignature.respondedAt = new Date().toISOString();

    // Update the signatories list
    if (action === 'sign') {
      treaty.signatories = signatures.filter(s => s.status === 'signed').map(s => s.organizationId);
    }

    // Check if all orgs have responded — if so, finalize the treaty
    const pending = signatures.filter(s => s.status === 'pending');
    if (pending.length === 0) {
      const signedCount = signatures.filter(s => s.status === 'signed').length;
      // Treaty becomes active if at least 2 orgs signed
      treaty.status = signedCount >= 2 ? 'active' : 'terminated';
    }

    treaty.signatures = signatures;
    federation.treaties = treaties;
    await this.federationRepository.save(federation);

    logger.info(`Org responded to treaty in federation`, {
      federationId,
      treatyId,
      actorOrgId,
      action,
      newStatus: treaty.status,
    });

    return treaty;
  }

  /**
   * Terminate a treaty
   */
  async terminateTreaty(federationId: string, treatyId: string, actorOrgId: string): Promise<void> {
    const federation = await this.loadFederationMetadataOnly(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const treaties = federation.treaties ?? [];
    const treaty = treaties.find(t => t.id === treatyId);
    if (!treaty) {
      throw new NotFoundError('Treaty');
    }

    // Only signatories or leaders can terminate
    const actor = await this.findMember(federationId, actorOrgId);
    if (
      !treaty.signatories.includes(actorOrgId) &&
      (!actor || !['founder', 'leader'].includes(actor.role))
    ) {
      throw new ForbiddenError('Insufficient permissions to terminate treaty');
    }

    treaty.status = 'terminated';
    federation.treaties = treaties;
    await this.federationRepository.save(federation);

    logger.info(`Terminated treaty in federation`, { federationId, treatyId });
  }

  // ==================== ANALYTICS ====================

  /**
   * Get federation statistics
   */
  async getFederationStats(federationId: string): Promise<FederationStats> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const members = federation.members ?? [];
    const activeMembers = members.filter(m => m.status === 'active');
    const totalVotingPower = activeMembers.reduce((sum, m) => sum + m.votingPower, 0);
    const activeTreaties = (federation.treaties ?? []).filter(t => t.status === 'active').length;

    const openProposals = await this.proposalRepository.count({
      where: { federationId, status: 'open' },
    });

    // Calculate average trust score from relationships
    let totalTrust = 0;
    let trustCount = 0;

    for (const member of activeMembers) {
      const relationships = await this.relationshipRepository.find({
        where: { organizationId: member.organizationId },
      });

      for (const rel of relationships) {
        if (activeMembers.some(m => m.organizationId === rel.targetOrganizationId)) {
          totalTrust += rel.trustScore;
          trustCount++;
        }
      }
    }

    const averageTrustScore = trustCount > 0 ? totalTrust / trustCount : 50;

    // Calculate combined member count using totalMembers field or OrganizationMembership count
    let combinedMemberCount = 0;
    for (const member of activeMembers) {
      const org = await this.organizationRepository.findOne({
        where: { id: member.organizationId },
      });
      if (org) {
        // Use totalMembers field (authoritative)
        combinedMemberCount += org.totalMembers ?? 0;
      }
    }

    return {
      totalMembers: members.length,
      activeMembers: activeMembers.length,
      totalVotingPower,
      sharedResourcesCount: (federation.sharedResources ?? []).length,
      activeTreaties,
      openProposals,
      averageTrustScore,
      combinedMemberCount,
    };
  }

  /**
   * Get member contribution rankings
   */
  async getMemberContributions(federationId: string): Promise<
    Array<{
      organizationId: string;
      organizationName: string;
      role: string;
      contributions: number;
      sharedResources: number;
      votingParticipation: number;
    }>
  > {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const members = federation.members ?? [];
    const proposals = await this.getFederationProposals(federationId);
    const closedProposals = proposals.filter(p => p.status !== 'open');
    const resources = federation.sharedResources ?? [];

    return members
      .filter(m => m.status === 'active')
      .map(member => {
        const sharedResourceCount = resources.filter(
          r => r.providedBy === member.organizationId
        ).length;

        // Calculate voting participation
        let votesCount = 0;
        for (const proposal of closedProposals) {
          if (proposal.votes.some(v => v.organizationId === member.organizationId)) {
            votesCount++;
          }
        }
        const votingParticipation =
          closedProposals.length > 0 ? (votesCount / closedProposals.length) * 100 : 100;

        return {
          organizationId: member.organizationId,
          organizationName: member.organizationName,
          role: member.role,
          contributions: member.contributions,
          sharedResources: sharedResourceCount,
          votingParticipation,
        };
      })
      .sort((a, b) => b.contributions - a.contributions);
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * Create alliance relationships between new member and existing members
   */
  private async createMemberRelationships(
    federation: Federation,
    newMemberOrgId: string
  ): Promise<void> {
    const members = federation.members ?? [];
    for (const member of members) {
      if (member.organizationId !== newMemberOrgId && member.status === 'active') {
        try {
          // Check if relationship already exists
          const existing = await this.relationshipRepository.findOne({
            where: {
              organizationId: newMemberOrgId,
              targetOrganizationId: member.organizationId,
            },
          });

          if (!existing) {
            const relationship = this.relationshipRepository.create({
              organizationId: newMemberOrgId,
              targetOrganizationId: member.organizationId,
              type: RelationshipType.AFFILIATED,
              status: RelationshipStatus.ACTIVE,
              trustScore: 60, // Start with moderate trust for federation members
              relationshipStrength: 50,
              description: `Federation members in ${federation.name}`,
              isMutual: true,
            });
            await this.relationshipRepository.save(relationship);
          }
        } catch (error: unknown) {
          // Relationship might already exist due to race condition or constraint violation
          // Log the actual error for debugging but continue processing other members
          logger.debug('Failed to create relationship, may already exist', {
            from: newMemberOrgId,
            to: member.organizationId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
  }

  /**
   * Check if proposal should be resolved and resolve it
   */
  private async checkAndResolveProposal(
    proposal: FederationProposalEntity,
    federation: Federation
  ): Promise<void> {
    const members = federation.members ?? [];
    const eligibleVoters = members.filter(
      (m: FederationMemberEntity) => m.status === 'active' && m.votingPower > 0
    );

    const totalVotingPower = eligibleVoters.reduce((sum, m) => sum + m.votingPower, 0);
    const votes = proposal.votes ?? [];
    const votedPower = votes.reduce((sum, v) => sum + v.weight, 0);
    const approvePower = votes
      .filter(v => v.vote === 'approve')
      .reduce((sum, v) => sum + v.weight, 0);

    // Check if everyone has voted
    if (votedPower >= totalVotingPower) {
      const approvalPercentage = (approvePower / totalVotingPower) * 100;
      proposal.status = approvalPercentage >= proposal.requiredApproval ? 'passed' : 'rejected';

      // Execute proposal if passed
      if (proposal.status === 'passed') {
        await this.executeProposal(proposal, federation);
      }
    }
  }

  /**
   * Execute a passed proposal
   */
  private async executeProposal(
    proposal: FederationProposalEntity,
    federation: Federation
  ): Promise<void> {
    switch (proposal.type) {
      case 'add_member':
        // Member addition would be handled by metadata
        logger.info(`Proposal passed: Add member`, { proposalId: proposal.id });
        break;
      case 'remove_member':
        if (proposal.metadata?.targetOrgId) {
          await this.memberRepository.delete({
            federationId: federation.id,
            organizationId: proposal.metadata.targetOrgId as string,
          });
        }
        break;
      case 'dissolve':
        federation.status = 'dissolved';
        await this.federationRepository.save(federation);
        break;
      case 'amend_governance':
        if (proposal.metadata?.governance) {
          federation.governance = {
            ...federation.governance,
            ...(proposal.metadata.governance as Partial<FederationGovernance>),
          };
          await this.federationRepository.save(federation);
        }
        break;
      default:
        logger.info(`Proposal passed: ${proposal.type}`, { proposalId: proposal.id });
    }
  }

  // ==================== PUBLIC DIRECTORY ====================

  /**
   * Get public federations with pagination and filtering
   * Phase 2: Enhanced with sorting options
   * No authentication required
   */
  async getPublicFederations(
    filters?: {
      name?: string;
      tags?: string[];
      minMembers?: number;
      maxMembers?: number;
    },
    pagination?: {
      page?: number;
      limit?: number;
      sortBy?: 'memberCount' | 'createdAt' | 'name';
      sortOrder?: 'ASC' | 'DESC';
    }
  ): Promise<{
    data: PublicFederationListItem[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;

    // Build query for public federations (active or forming)
    let qb = this.federationRepository
      .createQueryBuilder('federation')
      .leftJoinAndSelect('federation.members', 'member')
      .where('federation.isPublic = :isPublic', { isPublic: true })
      .andWhere('federation.status IN (:...statuses)', { statuses: ['active', 'forming'] });

    // Apply name filter
    if (filters?.name) {
      qb = qb.andWhere(
        '(LOWER(federation.name) LIKE :search OR LOWER(federation.description) LIKE :search)',
        { search: `%${filters.name.toLowerCase()}%` }
      );
    }

    // Apply tag filter
    if (filters?.tags && filters.tags.length > 0) {
      qb = qb.andWhere('federation.tags ?| ARRAY[:...tags]', { tags: filters.tags });
    }

    // Get all matching federations (we need to filter by member count in-memory)
    const allFederations = await qb.getMany();

    // Filter by member count
    let results = allFederations;
    if (filters?.minMembers !== undefined) {
      const min = filters.minMembers;
      results = results.filter(
        f => (f.members ?? []).filter(m => m.status === 'active').length >= min
      );
    }
    if (filters?.maxMembers !== undefined) {
      const max = filters.maxMembers;
      results = results.filter(
        f => (f.members ?? []).filter(m => m.status === 'active').length <= max
      );
    }

    // Apply sorting
    const sortBy = pagination?.sortBy ?? 'memberCount';
    const sortOrder = pagination?.sortOrder ?? 'DESC';
    const sortMultiplier = sortOrder === 'DESC' ? -1 : 1;

    results.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'memberCount':
          comparison =
            (a.members ?? []).filter(m => m.status === 'active').length -
            (b.members ?? []).filter(m => m.status === 'active').length;
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
      }
      return comparison * sortMultiplier;
    });

    // Pagination
    const total = results.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const paginatedResults = results.slice(startIndex, startIndex + limit);

    // Collect all member org IDs to check which ones have public profiles
    const allMemberOrgIds = new Set<string>();
    for (const f of paginatedResults) {
      for (const m of (f.members ?? []).filter(m => m.status === 'active')) {
        allMemberOrgIds.add(m.organizationId);
      }
    }

    // Query which orgs have public profiles
    let publicOrgIds = new Set<string>();
    if (allMemberOrgIds.size > 0) {
      try {
        const publicProfiles = await this.profileRepository
          .createQueryBuilder('profile')
          .select('profile.organizationId')
          .where('profile.organizationId IN (:...ids)', { ids: Array.from(allMemberOrgIds) })
          .andWhere('profile.isPublic = :isPublic', { isPublic: true })
          .getMany();
        publicOrgIds = new Set(publicProfiles.map(p => p.organizationId));
      } catch {
        // If DB check fails, default to showing all as public
        publicOrgIds = allMemberOrgIds;
      }
    }

    // Transform to public list items
    const data: PublicFederationListItem[] = paginatedResults.map(f => ({
      id: f.id,
      slug: slugify(f.name),
      name: f.name,
      description: f.description,
      memberCount: (f.members ?? []).filter(m => m.status === 'active').length,
      memberOrganizations: (f.members ?? [])
        .filter(m => m.status === 'active')
        .slice(0, 5) // Show first 5 members
        .map(m => {
          const memberIsPublic = publicOrgIds.has(m.organizationId);
          return {
            organizationId: memberIsPublic ? m.organizationId : 'redacted',
            organizationName: memberIsPublic ? m.organizationName : 'Private Organization',
            role: m.role,
            isPublic: memberIsPublic,
          };
        }),
      tags: f.tags || [],
      createdAt: f.createdAt.toISOString(),
      sharedResourceTypes: [...new Set((f.sharedResources ?? []).map(r => r.type))],
      treatyCount: (f.treaties ?? []).filter(t => t.status === 'active').length,
      logoUrl: f.logoUrl,
      bannerUrl: f.bannerUrl,
      discordUrl: f.discordUrl,
      websiteUrl: f.websiteUrl,
    }));

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Get a single public federation by ID
   * No authentication required, but only returns if public
   */
  async getPublicFederation(identifier: string): Promise<PublicFederationListItem | null> {
    const { isUUID } = await import('../../utils/slugify');

    let federation;

    if (isUUID(identifier)) {
      federation = await this.federationRepository.findOne({
        where: [
          { id: identifier, isPublic: true, status: 'active' },
          { id: identifier, isPublic: true, status: 'forming' },
        ],
        relations: ['members'],
      });
    } else {
      // Slug-based lookup — use DB-level LOWER comparison to avoid loading all records
      // The regex pipeline mirrors the frontend slugify():
      //   1. Strip non-alphanumeric chars (keep spaces & hyphens)
      //   2. Replace whitespace runs with a single hyphen
      //   3. Collapse consecutive hyphens into one
      //   4. Trim leading/trailing hyphens
      federation =
        (await this.federationRepository
          .createQueryBuilder('federation')
          .leftJoinAndSelect('federation.members', 'members')
          .where('federation.isPublic = :isPublic', { isPublic: true })
          .andWhere('federation.status IN (:...statuses)', { statuses: ['active', 'forming'] })
          .andWhere(
            String.raw`LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(federation.name), '[^a-zA-Z0-9\s-]', '', 'g'), '[\s-]+', '-', 'g'), '-+', '-', 'g'))) = LOWER(:slug)`,
            { slug: identifier }
          )
          .getOne()) ?? null;
    }

    if (!federation) {
      return null;
    }

    // Check which member orgs have public profiles
    const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
    const memberOrgIds = activeMembers.map(m => m.organizationId);
    let publicOrgIds = new Set<string>(memberOrgIds); // default all public
    if (memberOrgIds.length > 0) {
      try {
        const publicProfiles = await this.profileRepository
          .createQueryBuilder('profile')
          .select('profile.organizationId')
          .where('profile.organizationId IN (:...ids)', { ids: memberOrgIds })
          .andWhere('profile.isPublic = :isPublic', { isPublic: true })
          .getMany();
        publicOrgIds = new Set(publicProfiles.map(p => p.organizationId));
      } catch {
        // If DB check fails, default to showing all as public
      }
    }

    return {
      id: federation.id,
      slug: slugify(federation.name),
      name: federation.name,
      description: federation.description,
      memberCount: activeMembers.length,
      memberOrganizations: activeMembers.map(m => {
        const memberIsPublic = publicOrgIds.has(m.organizationId);
        return {
          organizationId: memberIsPublic ? m.organizationId : 'redacted',
          organizationName: memberIsPublic ? m.organizationName : 'Private Organization',
          role: m.role,
          isPublic: memberIsPublic,
        };
      }),
      tags: federation.tags || [],
      createdAt: federation.createdAt.toISOString(),
      sharedResourceTypes: [...new Set((federation.sharedResources ?? []).map(r => r.type))],
      treatyCount: (federation.treaties ?? []).filter(t => t.status === 'active').length,
      logoUrl: federation.logoUrl,
      bannerUrl: federation.bannerUrl,
      discordUrl: federation.discordUrl,
      websiteUrl: federation.websiteUrl,
    };
  }

  /**
   * Get public federation statistics
   * No authentication required
   */
  async getPublicFederationStats(): Promise<{
    totalFederations: number;
    totalMemberOrganizations: number;
    averageMembersPerFederation: number;
    byTag: Record<string, number>;
  }> {
    // Load federations without eagerly loading all members (use COUNT for stats)
    const publicFederations = await this.federationRepository.find({
      where: [
        { isPublic: true, status: 'active' },
        { isPublic: true, status: 'forming' },
      ],
    });

    const totalFederations = publicFederations.length;

    if (totalFederations === 0) {
      return {
        totalFederations: 0,
        totalMemberOrganizations: 0,
        averageMembersPerFederation: 0,
        byTag: {},
      };
    }

    // SQL aggregation for member counts instead of loading all member entities
    const federationIds = publicFederations.map(f => f.id);
    const memberStats = await this.memberRepository
      .createQueryBuilder('fm')
      .select('COUNT(DISTINCT fm."organizationId")::int', 'uniqueOrgs')
      .addSelect('COUNT(*)::int', 'totalMembers')
      .where('fm."federationId" IN (:...federationIds)', { federationIds })
      .andWhere('fm.status = :status', { status: 'active' })
      .getRawOne<{ uniqueOrgs: number; totalMembers: number }>();

    // Tag counts from federation metadata (no member data needed)
    const tagCounts: Record<string, number> = {};
    for (const federation of publicFederations) {
      for (const tag of federation.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }

    const totalMembers = memberStats?.totalMembers ?? 0;

    return {
      totalFederations,
      totalMemberOrganizations: memberStats?.uniqueOrgs ?? 0,
      averageMembersPerFederation:
        totalFederations > 0 ? Math.round((totalMembers / totalFederations) * 10) / 10 : 0,
      byTag: tagCounts,
    };
  }

  /**
   * Get public federations that a specific organization belongs to.
   * Only returns federations that are public and active/forming.
   * No authentication required — used for public org profile pages.
   */
  async getPublicFederationsForOrg(organizationId: string): Promise<
    Array<{
      id: string;
      slug?: string;
      name: string;
      description: string;
      memberCount: number;
      role: string;
      tags: string[];
      logoUrl?: string | null;
    }>
  > {
    // Find all federation memberships for this org
    const memberships = await this.memberRepository.find({
      where: { organizationId, status: 'active' as FederationMemberStatus },
      select: ['federationId', 'role'],
    });

    if (memberships.length === 0) {
      return [];
    }

    const federationIds = memberships.map(m => m.federationId);

    // Load only public, non-dissolved federations
    const federations = await this.federationRepository
      .createQueryBuilder('federation')
      .leftJoinAndSelect('federation.members', 'member')
      .where('federation.id IN (:...ids)', { ids: federationIds })
      .andWhere('federation.isPublic = :isPublic', { isPublic: true })
      .andWhere('federation.status IN (:...statuses)', {
        statuses: ['active', 'forming'],
      })
      .getMany();

    // Build a lookup map for the org's role in each federation
    const roleMap = new Map(memberships.map(m => [m.federationId, m.role]));

    return federations.map(f => ({
      id: f.id,
      slug: slugify(f.name),
      name: f.name,
      description: f.description,
      memberCount: (f.members ?? []).filter(m => m.status === 'active').length,
      role: roleMap.get(f.id) ?? 'member',
      tags: f.tags ?? [],
      logoUrl: f.logoUrl,
    }));
  }

  /**
   * Check if a user has management access to an alliance
   * Used for contact request and other admin operations
   */
  async hasAllianceManageAccess(allianceId: string, userId: string): Promise<boolean> {
    const federation = await this.loadFederation(allianceId);
    if (!federation) {
      return false;
    }

    // Get user's organizations via OrganizationMembership
    const membershipRepo = AppDataSource.getRepository(OrganizationMembership);
    const memberships = await membershipRepo.find({
      where: { userId, isActive: true },
      select: ['organizationId'],
    });

    const userOrgIds = new Set(memberships.map(m => m.organizationId));

    // Check if user is a leader, founder, or council member of the alliance
    // through any of their organizations
    for (const member of federation.members ?? []) {
      if (userOrgIds.has(member.organizationId)) {
        if (['founder', 'leader', 'council'].includes(member.role) && member.status === 'active') {
          return true;
        }
      }
    }

    return false;
  }

  // ==================== FEDERATION SETTINGS ====================

  /**
   * Get federation settings.
   * Any active member can read settings.
   */
  async getFederationSettings(
    federationId: string,
    actorOrgId: string
  ): Promise<FederationSettings> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const actorMember = (federation.members ?? []).find(
      m => m.organizationId === actorOrgId && m.status === 'active'
    );
    if (!actorMember) {
      throw new ForbiddenError('Not an active member of this federation');
    }

    return federation.settings ?? {};
  }

  /**
   * Update federation settings (feature toggles).
   * Requires founder, leader, or council role.
   */
  async updateFederationSettings(
    federationId: string,
    actorOrgId: string,
    updates: UpdateFederationSettingsRequest
  ): Promise<FederationSettings> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const actorMember = (federation.members ?? []).find(m => m.organizationId === actorOrgId);
    if (!actorMember || !['founder', 'leader', 'council'].includes(actorMember.role)) {
      throw new ForbiddenError('Insufficient permissions to update federation settings');
    }

    // Spread into a new object so TypeORM detects the change on the JSONB column
    // (TypeORM 0.3 compares JSON columns by reference and skips UPDATE if the
    // existing object is mutated in place).
    const currentSettings: FederationSettings = { ...federation.settings };

    if (updates.enableTitlesBadges !== undefined) {
      currentSettings.enableTitlesBadges = updates.enableTitlesBadges;
    }
    if (updates.enableFederationFleets !== undefined) {
      currentSettings.enableFederationFleets = updates.enableFederationFleets;
    }
    if (updates.enableFederationDynamicTeams !== undefined) {
      currentSettings.enableFederationDynamicTeams = updates.enableFederationDynamicTeams;
    }
    if (updates.allowSelfApplication !== undefined) {
      currentSettings.allowSelfApplication = updates.allowSelfApplication;
    }
    if (updates.requireApproval !== undefined) {
      currentSettings.requireApproval = updates.requireApproval;
    }
    if (updates.applicationQuestions !== undefined) {
      currentSettings.applicationQuestions = updates.applicationQuestions;
    }
    if (updates.enableCentralDiscord !== undefined) {
      currentSettings.enableCentralDiscord = updates.enableCentralDiscord;
    }
    if (updates.autoCreateOrgRoles !== undefined) {
      currentSettings.autoCreateOrgRoles = updates.autoCreateOrgRoles;
    }
    if (updates.removeRolesOnOrgLeave !== undefined) {
      currentSettings.removeRolesOnOrgLeave = updates.removeRolesOnOrgLeave;
    }
    if (updates.removeRolesOnUserLeave !== undefined) {
      currentSettings.removeRolesOnUserLeave = updates.removeRolesOnUserLeave;
    }
    if (updates.conflictResolutionMode !== undefined) {
      currentSettings.conflictResolutionMode = updates.conflictResolutionMode;
    }
    if (updates.syncNotificationChannelId !== undefined) {
      currentSettings.syncNotificationChannelId = updates.syncNotificationChannelId;
    }
    if (updates.kickNonMembers !== undefined) {
      currentSettings.kickNonMembers = updates.kickNonMembers;
    }

    federation.settings = currentSettings;
    await this.federationRepository.save(federation);

    logger.info(`Updated federation settings: ${federation.name}`, {
      federationId,
      actorOrgId,
      settings: currentSettings,
    });

    return currentSettings;
  }

  // ==================== FEDERATION FLEETS (AGGREGATION) ====================

  /**
   * Load fleets shared via active diplomacy treaties from non-member partner orgs.
   * Returns only those fleets whose allowedOrganizations includes a federation member.
   */
  private async loadTreatySharedFleets(
    orgIds: string[],
    fleetRepository: Repository<Fleet>
  ): Promise<{
    fleets: Fleet[];
    treatyTypeByOrg: Map<string, string>;
    partnerOrgIds: Set<string>;
  }> {
    const diplomacyRepo = AppDataSource.getRepository(AllianceDiplomacy);
    const activeTreaties = await diplomacyRepo
      .createQueryBuilder('d')
      .where('d.status = :status', { status: DiplomacyStatus.ACTIVE })
      .andWhere('(d.orgId1 IN (:...orgIds) OR d.orgId2 IN (:...orgIds))', { orgIds })
      .getMany();

    const partnerOrgIds = new Set<string>();
    const treatyTypeByOrg = new Map<string, string>();
    for (const treaty of activeTreaties) {
      const partnerOrgId = orgIds.includes(treaty.orgId1) ? treaty.orgId2 : treaty.orgId1;
      if (!orgIds.includes(partnerOrgId)) {
        partnerOrgIds.add(partnerOrgId);
        treatyTypeByOrg.set(partnerOrgId, treaty.allianceType);
      }
    }

    if (partnerOrgIds.size === 0) {
      return { fleets: [], treatyTypeByOrg, partnerOrgIds };
    }

    const partnerFleets = await fleetRepository
      .createQueryBuilder('fleet')
      .where('fleet.organizationId IN (:...partnerOrgIds)', { partnerOrgIds: [...partnerOrgIds] })
      .getMany();

    const sharedFleets = partnerFleets.filter(f =>
      (f.allowedOrganizations ?? []).some(aoId => orgIds.includes(aoId))
    );

    return { fleets: sharedFleets, treatyTypeByOrg, partnerOrgIds };
  }

  /**
   * Batch-load ship counts (total + flight-ready) for a set of fleet IDs.
   */
  private async batchLoadFleetShipCounts(
    fleetIds: string[]
  ): Promise<Record<string, { total: number; flightReady: number }>> {
    if (fleetIds.length === 0) {
      return {};
    }

    const fleetShipRepo = AppDataSource.getRepository(FleetShip);
    const rows: Array<{ fleetId: string; total: string; flightReady: string }> = await fleetShipRepo
      .createQueryBuilder('fs')
      .select('fs.fleetId', 'fleetId')
      .addSelect('COUNT(fs.id)', 'total')
      .addSelect("COUNT(CASE WHEN ship.status = 'flight_ready' THEN 1 END)", 'flightReady')
      .leftJoin('fs.ship', 'ship')
      .where('fs.fleetId IN (:...fleetIds)', { fleetIds })
      .groupBy('fs.fleetId')
      .getRawMany();

    const result: Record<string, { total: number; flightReady: number }> = {};
    for (const row of rows) {
      result[row.fleetId] = {
        total: Number.parseInt(row.total, 10) || 0,
        flightReady: Number.parseInt(row.flightReady, 10) || 0,
      };
    }
    return result;
  }

  /**
   * Convert a Fleet entity to a FederationFleetItem with readiness data.
   *
   * Uses simplified weights (60% ship readiness + 40% crew fill) rather than
   * the full FleetHealthService calculation (35/25/20/20) because capability
   * diversity and operational history require per-ship relation loading that
   * would be too expensive for federation-level aggregation.
   */
  private buildFleetItem(
    f: Fleet,
    shipCounts: Record<string, { total: number; flightReady: number }>,
    orgNameMap: Map<string, string>,
    isShared: boolean,
    sharedVia?: string
  ): FederationFleetItem {
    const shipData = shipCounts[f.id] ?? { total: 0, flightReady: 0 };
    const shipCount = shipData.total || (f.shipIds?.length ?? 0);
    const readinessPercent =
      shipCount > 0 ? Math.round((shipData.flightReady / shipCount) * 100) : 0;
    const memberCount = f.members?.length ?? 0;
    const crewFillPercent =
      shipCount > 0 ? Math.min(100, Math.round((memberCount / Math.max(shipCount, 1)) * 100)) : 0;
    const healthScore = Math.round(readinessPercent * 0.6 + crewFillPercent * 0.4);

    let readinessStatus: 'green' | 'yellow' | 'red';
    if (healthScore >= 75) {
      readinessStatus = 'green';
    } else if (healthScore >= 50) {
      readinessStatus = 'yellow';
    } else {
      readinessStatus = 'red';
    }

    return {
      id: f.id,
      name: f.name,
      description: f.description ?? null,
      status: f.status,
      type: f.type,
      memberCount,
      shipCount,
      organizationId: f.organizationId,
      organizationName: orgNameMap.get(f.organizationId) ?? 'Unknown',
      visibility: f.visibility ?? 'private',
      readiness: {
        healthScore,
        status: readinessStatus,
        readinessPercent,
        crewFillPercent,
      },
      isShared,
      sharedVia,
    };
  }

  /**
   * Aggregate fleets across all active member organizations, including fleets
   * shared via active diplomacy treaties between member orgs.
   * Read-only — pulls existing org-scoped Fleet records.
   * Gated by the enableFederationFleets setting.
   */
  async getFederationFleets(
    federationId: string,
    actorOrgId: string
  ): Promise<FederationFleetsResponse> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const actorMember = (federation.members ?? []).find(
      m => m.organizationId === actorOrgId && m.status === 'active'
    );
    if (!actorMember) {
      throw new ForbiddenError('Not an active member of this federation');
    }

    const settings: FederationSettings = federation.settings ?? {};
    if (!settings.enableFederationFleets) {
      throw new ValidationError('Federation fleets feature is not enabled');
    }

    const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
    const orgNameMap = new Map(activeMembers.map(m => [m.organizationId, m.organizationName]));
    const orgIds = activeMembers.map(m => m.organizationId);

    const fleetRepository = AppDataSource.getRepository(Fleet);

    // 1. Get direct member org fleets
    const memberFleets = await fleetRepository
      .createQueryBuilder('fleet')
      .where('fleet.organizationId IN (:...orgIds)', { orgIds })
      .getMany();

    const memberFleetIds = new Set(memberFleets.map(f => f.id));

    // 2. Get fleets shared via active diplomacy treaties
    const {
      fleets: sharedTreatyFleets,
      treatyTypeByOrg,
      partnerOrgIds,
    } = await this.loadTreatySharedFleets(orgIds, fleetRepository);

    // 3. Batch-load ship counts
    const allFleets = [...memberFleets, ...sharedTreatyFleets];
    const fleetShipCounts = await this.batchLoadFleetShipCounts(allFleets.map(f => f.id));

    // 4. Resolve org names for treaty partner orgs
    if (partnerOrgIds.size > 0) {
      const orgRepo = AppDataSource.getRepository(Organization);
      const partnerOrgs = await orgRepo.find({
        where: { id: In([...partnerOrgIds]) },
        select: ['id', 'name'],
      });
      for (const org of partnerOrgs) {
        if (!orgNameMap.has(org.id)) {
          orgNameMap.set(org.id, org.name);
        }
      }
    }

    // 5. Build fleet items with readiness
    const fleetItems: FederationFleetItem[] = [
      ...memberFleets.map(f => this.buildFleetItem(f, fleetShipCounts, orgNameMap, false)),
      ...sharedTreatyFleets
        .filter(f => !memberFleetIds.has(f.id))
        .map(f =>
          this.buildFleetItem(
            f,
            fleetShipCounts,
            orgNameMap,
            true,
            treatyTypeByOrg.get(f.organizationId)
          )
        ),
    ];

    const fleetsByOrganization: Record<string, number> = {};
    for (const item of fleetItems) {
      fleetsByOrganization[item.organizationName] =
        (fleetsByOrganization[item.organizationName] ?? 0) + 1;
    }

    return {
      federationId,
      totalFleets: fleetItems.length,
      fleetsByOrganization,
      fleets: fleetItems,
    };
  }

  // ==================== FEDERATION UNITS (AGGREGATION) ====================

  /**
   * Aggregate teams (federation units) across all active member organizations.
   * Read-only — pulls existing org-scoped Team records.
   * Gated by the enableFederationDynamicTeams setting.
   */
  async getFederationUnits(
    federationId: string,
    actorOrgId: string
  ): Promise<FederationUnitsResponse> {
    const federation = await this.loadFederation(federationId);
    if (!federation) {
      throw new NotFoundError('Federation');
    }

    const actorMember = (federation.members ?? []).find(
      m => m.organizationId === actorOrgId && m.status === 'active'
    );
    if (!actorMember) {
      throw new ForbiddenError('Not an active member of this federation');
    }

    const settings: FederationSettings = federation.settings ?? {};
    if (!settings.enableFederationDynamicTeams) {
      throw new ValidationError('Federation units feature is not enabled');
    }

    const activeMembers = (federation.members ?? []).filter(m => m.status === 'active');
    const orgNameMap = new Map(activeMembers.map(m => [m.organizationId, m.organizationName]));
    const orgIds = activeMembers.map(m => m.organizationId);

    const teamRepository = AppDataSource.getRepository(Team);
    const teams = await teamRepository
      .createQueryBuilder('team')
      .leftJoinAndSelect('team.members', 'members')
      .where('team.organizationId IN (:...orgIds)', { orgIds })
      .getMany();

    const unitItems: FederationUnitItem[] = teams.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description ?? null,
      type: t.type,
      memberCount: t.members?.length ?? 0,
      maxMembers: t.maxMembers,
      isActive: t.isActive,
      organizationId: t.organizationId,
      organizationName: orgNameMap.get(t.organizationId) ?? 'Unknown',
    }));

    const unitsByOrganization: Record<string, number> = {};
    for (const item of unitItems) {
      unitsByOrganization[item.organizationName] =
        (unitsByOrganization[item.organizationName] ?? 0) + 1;
    }

    return {
      federationId,
      totalUnits: unitItems.length,
      unitsByOrganization,
      units: unitItems,
    };
  }

  // ==================== DEMO DATA SEEDING ====================

  /**
   * Seed demo federation data into the database.
   * Called on server startup so the public directory always has federation data.
   * Idempotent — skips if federations already exist.
   */
  async seedDemoFederations(): Promise<void> {
    const count = await this.federationRepository.count();
    if (count > 0) {
      logger.info('Federation data already exists, skipping seed');
      return;
    }

    const now = new Date();

    // Helper to create a federation with members via the repository
    const seedFederation = async (
      fedData: {
        name: string;
        description: string;
        founderId: string;
        founderOrgId: string;
        createdAt: Date;
        governance: FederationGovernance;
        sharedResources: SharedResource[];
        treaties: FederationTreaty[];
        status: FederationStatus;
        isPublic: boolean;
        tags: string[];
        discordUrl?: string;
        websiteUrl?: string;
        bannerUrl?: string;
      },
      members: Array<{
        organizationId: string;
        organizationName: string;
        role: FederationRole;
        joinedAt: Date;
        status: FederationMemberStatus;
        votingPower: number;
        contributions: number;
      }>
    ): Promise<void> => {
      const federation = this.federationRepository.create({
        name: fedData.name,
        description: fedData.description,
        founderId: fedData.founderId,
        founderOrgId: fedData.founderOrgId,
        createdAt: fedData.createdAt,
        governance: fedData.governance,
        sharedResources: fedData.sharedResources,
        treaties: fedData.treaties,
        status: fedData.status,
        isPublic: fedData.isPublic,
        tags: fedData.tags,
        discordUrl: fedData.discordUrl,
        websiteUrl: fedData.websiteUrl,
        bannerUrl: fedData.bannerUrl,
      });
      const savedFederation = await this.federationRepository.save(federation);

      for (const m of members) {
        const member = this.memberRepository.create({
          federationId: savedFederation.id,
          organizationId: m.organizationId,
          organizationName: m.organizationName,
          role: m.role,
          joinedAt: m.joinedAt,
          status: m.status,
          votingPower: m.votingPower,
          contributions: m.contributions,
        });
        await this.memberRepository.save(member);
      }
    };

    // ── Federation 1: Stanton Defense Coalition (public) ──
    await seedFederation(
      {
        name: 'Stanton Defense Coalition',
        description:
          'A public alliance of combat and security organizations dedicated to protecting trade routes, ' +
          'defending mining operations, and maintaining order across the Stanton system. Open to all ' +
          'organizations committed to collective defense and mutual aid.',
        founderId: 'demo-user-commander-001',
        founderOrgId: 'demo-org-stardust-fleet',
        createdAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        governance: {
          votingSystem: 'majority',
          requiredApprovalThreshold: 51,
          councilSize: 3,
          leaderTermDays: 90,
          amendmentThreshold: 67,
        },
        sharedResources: [
          {
            id: 'res-fleet-patrol',
            name: 'Joint Patrol Fleet',
            type: 'fleet',
            providedBy: 'demo-org-stardust-fleet',
            accessLevel: 'all',
            description:
              'Shared patrol ships available to all coalition members for route defense.',
          },
          {
            id: 'res-intel-network',
            name: 'Threat Intelligence Network',
            type: 'intel',
            providedBy: 'demo-org-ironwolf',
            accessLevel: 'all',
            description: 'Real-time pirate activity tracking and threat assessment data.',
          },
          {
            id: 'res-discord-comms',
            name: 'Coalition Comms Server',
            type: 'discord',
            providedBy: 'demo-org-stardust-fleet',
            accessLevel: 'all',
            description: 'Shared Discord server for inter-org coordination and alerts.',
          },
        ],
        treaties: [
          {
            id: 'treaty-mutual-def',
            name: 'Stanton Mutual Defense Pact',
            type: 'mutual_defense',
            signatories: ['demo-org-stardust-fleet', 'demo-org-ironwolf', 'demo-org-deep-core'],
            terms: [
              'All members will respond to distress calls within 15 minutes',
              'Shared combat intel on hostile organizations',
              'Joint monthly training exercises',
            ],
            effectiveDate: new Date(now.getTime() - 55 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            proposedBy: 'demo-org-stardust-fleet',
          },
          {
            id: 'treaty-resource-share',
            name: 'Resource Sharing Agreement',
            type: 'resource_sharing',
            signatories: ['demo-org-stardust-fleet', 'demo-org-deep-core'],
            terms: [
              'Deep Core provides priority ore pricing to coalition members',
              'Stardust provides escort services for mining operations',
            ],
            effectiveDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            proposedBy: 'demo-org-stardust-fleet',
          },
        ],
        status: 'active',
        isPublic: true,
        tags: ['defense', 'security', 'stanton', 'mutual-aid', 'multi-org'],
        discordUrl: 'https://discord.gg/stanton-defense',
        websiteUrl: 'https://stanton-defense.example.com',
        bannerUrl: 'https://picsum.photos/seed/sdc-alliance/800/200',
      },
      [
        {
          organizationId: 'demo-org-stardust-fleet',
          organizationName: 'Stardust Expeditionary Fleet',
          role: 'founder',
          joinedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 2,
          contributions: 15,
        },
        {
          organizationId: 'demo-org-ironwolf',
          organizationName: 'Ironwolf Mercenary Company',
          role: 'council',
          joinedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 1,
          contributions: 10,
        },
        {
          organizationId: 'demo-org-deep-core',
          organizationName: 'Deep Core Mining Consortium',
          role: 'member',
          joinedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 1,
          contributions: 5,
        },
      ]
    );

    // ── Federation 2: Quantum Trade Syndicate (public) ──
    await seedFederation(
      {
        name: 'Quantum Trade Syndicate',
        description:
          'An economic alliance focused on establishing and protecting profitable trade routes ' +
          'across Stanton and into Pyro. Members share route intelligence, coordinate convoy ' +
          'schedules, and negotiate bulk pricing with landing zones.',
        founderId: 'demo-user-trader-003',
        founderOrgId: 'demo-org-quantum-trade',
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
        governance: {
          votingSystem: 'weighted',
          requiredApprovalThreshold: 60,
          councilSize: 2,
          leaderTermDays: 180,
          amendmentThreshold: 75,
        },
        sharedResources: [
          {
            id: 'res-trade-routes',
            name: 'Verified Trade Route Database',
            type: 'routes',
            providedBy: 'demo-org-quantum-trade',
            accessLevel: 'all',
            description: 'Curated database of profitable trade routes with real-time pricing data.',
          },
          {
            id: 'res-trade-infra',
            name: 'Syndicate Hangars & Storage',
            type: 'infrastructure',
            providedBy: 'demo-org-quantum-trade',
            accessLevel: 'council',
            description: 'Shared hangar space and cargo storage at key landing zones.',
          },
        ],
        treaties: [
          {
            id: 'treaty-trade-exclusivity',
            name: 'Pyro Trade Route Exclusivity',
            type: 'trade',
            signatories: ['demo-org-quantum-trade', 'demo-org-deep-core'],
            terms: [
              'Exclusive first-right pricing on Pyro jump point cargo runs',
              'Joint investment in hauler fleet expansion',
              'Profit sharing on joint route operations (60/40 split)',
            ],
            effectiveDate: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            proposedBy: 'demo-org-quantum-trade',
          },
        ],
        status: 'active',
        isPublic: true,
        tags: ['trade', 'economics', 'pyro', 'hauling', 'logistics'],
        discordUrl: 'https://discord.gg/quantum-syndicate',
        websiteUrl: 'https://quantum-syndicate.example.com',
      },
      [
        {
          organizationId: 'demo-org-quantum-trade',
          organizationName: 'Quantum Trade Network',
          role: 'founder',
          joinedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 3,
          contributions: 20,
        },
        {
          organizationId: 'demo-org-deep-core',
          organizationName: 'Deep Core Mining Consortium',
          role: 'leader',
          joinedAt: new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 2,
          contributions: 12,
        },
      ]
    );

    // ── Federation 3: Shadow Council (private — should NOT appear in public directory) ──
    await seedFederation(
      {
        name: 'Shadow Council',
        description:
          'A secretive alliance operating in the grey areas of UEE law. Members share intel on ' +
          'high-value targets, coordinate smuggling operations, and maintain safe houses across Stanton.',
        founderId: 'demo-user-smuggler-009',
        founderOrgId: 'demo-org-ironwolf',
        createdAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        governance: {
          votingSystem: 'unanimous',
          requiredApprovalThreshold: 100,
          councilSize: 2,
          leaderTermDays: 365,
          amendmentThreshold: 100,
        },
        sharedResources: [
          {
            id: 'res-shadow-intel',
            name: 'Dark Net Intel Feed',
            type: 'intel',
            providedBy: 'demo-org-ironwolf',
            accessLevel: 'leaders',
            description:
              'Classified intelligence on high-value targets and law enforcement patterns.',
          },
          {
            id: 'res-smuggling-routes',
            name: 'Smuggling Route Database',
            type: 'routes',
            providedBy: 'demo-org-crimson-syndicate',
            accessLevel: 'all',
            description:
              'Curated database of safe smuggling corridors, patrol gaps, and drop locations.',
          },
        ],
        treaties: [
          {
            id: 'treaty-non-aggression',
            name: 'Non-Aggression Pact',
            type: 'non_aggression',
            signatories: [
              'demo-org-ironwolf',
              'demo-org-quantum-trade',
              'demo-org-crimson-syndicate',
            ],
            terms: [
              'No hostile actions against member organizations',
              'Shared safe house access at Grim HEX',
              'Mutual intel on law enforcement operations',
              'Crimson Syndicate provides logistics for covert cargo runs',
            ],
            effectiveDate: new Date(now.getTime() - 85 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'active',
            proposedBy: 'demo-org-ironwolf',
          },
        ],
        status: 'active',
        isPublic: false,
        tags: ['covert', 'intel', 'smuggling'],
      },
      [
        {
          organizationId: 'demo-org-ironwolf',
          organizationName: 'Ironwolf Mercenary Company',
          role: 'founder',
          joinedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 1,
          contributions: 25,
        },
        {
          organizationId: 'demo-org-quantum-trade',
          organizationName: 'Quantum Trade Network',
          role: 'member',
          joinedAt: new Date(now.getTime() - 70 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 1,
          contributions: 8,
        },
        {
          organizationId: 'demo-org-crimson-syndicate',
          organizationName: 'Crimson Syndicate',
          role: 'member',
          joinedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
          status: 'active',
          votingPower: 1,
          contributions: 12,
        },
      ]
    );

    logger.info(`Seeded 3 demo federations (2 public, 1 private)`);
  }
}
