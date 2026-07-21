import * as crypto from 'node:crypto';

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  ExternalCatalogRecord,
  ExternalCatalogRecordType,
  ExternalCatalogSource,
} from '../../models/ExternalCatalogRecord';
import {
  Mission,
  MissionDifficulty,
  MissionParticipantData,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '../../models/Mission';
import { ConflictError, ServiceUnavailableError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';

/**
 * Filters for querying missions
 */
export interface MissionFilters {
  status?: MissionStatus;
  missionType?: MissionType;
  difficulty?: MissionDifficulty;
  priority?: MissionPriority;
  createdBy?: string;
  assignedTo?: string;
  fleetId?: string;
  tags?: string[];
  search?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
}

export interface ScmdbMissionCardFilters {
  search?: string;
  category?: string;
  limit?: number;
}

export interface ScmdbMissionCard {
  externalId: string;
  title: string;
  category: string;
  description?: string;
  location?: string;
  difficultyHint?: string;
  rewardHint?: string;
  tags: string[];
  payload: Record<string, unknown>;
}

export interface ImportScmdbMissionInput {
  externalId: string;
  priority?: MissionPriority;
  startDate?: Date;
  endDate?: Date;
  notes?: string;
}

export interface ImportScmdbMissionsResult {
  imported: Mission[];
  skipped: Array<{ externalId: string; reason: string }>;
}

export type MissionWorkflowPhase = 'dispatch' | 'quartermaster' | 'execution' | 'after_action';

export interface MissionWorkflowPhaseState {
  phase: MissionWorkflowPhase;
  title: string;
  description: string;
  completed: boolean;
  blockers: string[];
  suggestedStatus?: MissionStatus;
  nextActions: string[];
}

export interface MissionWorkflowState {
  missionId: string;
  missionStatus: MissionStatus;
  completedPhases: number;
  totalPhases: number;
  completionPercent: number;
  phases: MissionWorkflowPhaseState[];
}

const WORKFLOW_PHASE_TAGS: Record<MissionWorkflowPhase, string> = {
  dispatch: 'workflow:dispatch:completed',
  quartermaster: 'workflow:quartermaster:completed',
  execution: 'workflow:execution:completed',
  after_action: 'workflow:after-action:completed',
};

const WORKFLOW_STATUS_TRANSITIONS: Partial<
  Record<
    MissionWorkflowPhase,
    { from: MissionStatus; to: MissionStatus; setsCompletedAt?: boolean }
  >
> = {
  dispatch: { from: MissionStatus.DRAFT, to: MissionStatus.PLANNED },
  quartermaster: { from: MissionStatus.PLANNED, to: MissionStatus.BRIEFED },
  execution: { from: MissionStatus.BRIEFED, to: MissionStatus.IN_PROGRESS },
  after_action: {
    from: MissionStatus.IN_PROGRESS,
    to: MissionStatus.COMPLETED,
    setsCompletedAt: true,
  },
};

const WORKFLOW_PHASE_ORDER: MissionWorkflowPhase[] = [
  'dispatch',
  'quartermaster',
  'execution',
  'after_action',
];

const QUARTERMASTER_COMPLETED_STATUSES = new Set<MissionStatus>([
  MissionStatus.BRIEFED,
  MissionStatus.IN_PROGRESS,
  MissionStatus.COMPLETED,
  MissionStatus.FAILED,
  MissionStatus.CANCELLED,
]);

const EXECUTION_COMPLETED_STATUSES = new Set<MissionStatus>([
  MissionStatus.IN_PROGRESS,
  MissionStatus.COMPLETED,
  MissionStatus.FAILED,
  MissionStatus.CANCELLED,
]);

/**
 * Mission Service
 *
 * Handles CRUD operations, status transitions, participant management,
 * and filtered/paginated queries for missions. All operations enforce
 * tenant isolation via organizationId scoping.
 */
export class MissionService {
  private _missionRepository?: Repository<Mission>;
  private _externalCatalogRepository?: Repository<ExternalCatalogRecord>;

  /**
   * Repository is acquired lazily to allow instantiation when the DB is unavailable.
   * Any method that touches the database will fail fast with a clear error if the
   * AppDataSource has not been initialized.
   */
  private get missionRepository(): Repository<Mission> {
    if (!AppDataSource.isInitialized) {
      throw new ServiceUnavailableError(
        'Database not initialized - call initializeDatabase() before using MissionService database operations'
      );
    }
    this._missionRepository ??= AppDataSource.getRepository(Mission);
    return this._missionRepository;
  }

  private get externalCatalogRepository(): Repository<ExternalCatalogRecord> {
    if (!AppDataSource.isInitialized) {
      throw new ServiceUnavailableError(
        'Database not initialized - call initializeDatabase() before using MissionService database operations'
      );
    }
    this._externalCatalogRepository ??= AppDataSource.getRepository(ExternalCatalogRecord);
    return this._externalCatalogRepository;
  }

  public async searchScmdbMissionCards(
    filters: ScmdbMissionCardFilters = {}
  ): Promise<ScmdbMissionCard[]> {
    const limit = Math.min(Math.max(filters.limit ?? 30, 1), 100);

    const query = this.externalCatalogRepository
      .createQueryBuilder('record')
      .where('record.source = :source', { source: ExternalCatalogSource.SCMDB })
      .andWhere('record.recordType = :recordType', {
        recordType: ExternalCatalogRecordType.CONTRACT,
      })
      .andWhere('record.isActive = :isActive', { isActive: true });

    if (filters.category) {
      query.andWhere('record.category = :category', { category: filters.category });
    }

    if (filters.search) {
      const search = `%${filters.search}%`;
      query.andWhere('(record.displayName ILIKE :search OR record.category ILIKE :search)', {
        search,
      });
    }

    const records = await query.orderBy('record.updatedAt', 'DESC').take(limit).getMany();

    return records.map(record => this.mapScmdbRecordToMissionCard(record));
  }

  /**
   * Get available filter options for SCMDB mission search.
   * Returns distinct categories and counts from cached catalog.
   *
   * @returns Object with available categories and counts
   */
  public async getScmdbAvailableFilters(): Promise<{
    categories: Array<{ name: string; count: number }>;
  }> {
    try {
      const result = await this.externalCatalogRepository
        .createQueryBuilder('record')
        .select('record.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .where('record.source = :source', { source: ExternalCatalogSource.SCMDB })
        .andWhere('record.recordType = :recordType', {
          recordType: ExternalCatalogRecordType.CONTRACT,
        })
        .andWhere('record.isActive = :isActive', { isActive: true })
        .andWhere('record.category IS NOT NULL')
        .groupBy('record.category')
        .orderBy('record.category', 'ASC')
        .getRawMany();

      const categories = result.map(row => ({
        name: row.category || 'unknown',
        count: parseInt(row.count, 10) || 0,
      }));

      return { categories };
    } catch (error) {
      // Graceful fallback: return empty categories on query error
      // This prevents UI breakage when filter endpoint fails
      logger.error(
        'MissionService.getScmdbAvailableFilters: Failed to fetch filter categories',
        error instanceof Error ? error : new Error(String(error))
      );
      return { categories: [] };
    }
  }

  /**
   * Import a single SCMDB mission by URL or mission ID.
   *
   * @param organizationId Organization to import into
   * @param createdBy User creating the mission
   * @param url SCMDB mission URL, locale-prefixed URL, or bare ID
   * @param input Additional import options (priority, dates, notes)
   * @returns Imported mission or null if not found
   */
  public async importScmdbMissionByUrl(
    organizationId: string,
    createdBy: string,
    url: string,
    input: Omit<ImportScmdbMissionInput, 'externalId'> = {}
  ): Promise<Mission | null> {
    // Import scmdbUtils here to keep utility functions separate
    const { parseScmdbMissionUrl } = await import('../../utils/scmdbUtils');

    const missionId = parseScmdbMissionUrl(url);
    if (!missionId) {
      throw new ValidationError(
        'Invalid SCMDB URL or mission ID. Expected format: https://scmdb.net/contracts/{ID} or bare ID'
      );
    }

    // Check if this mission is already imported
    // The DB-level unique index on (organizationId, sourceReference) (migration 20260715100000)
    // provides a hard backstop against concurrent duplicate imports. This soft check avoids
    // an unnecessary write attempt in the common (non-racing) case.
    const existing = await this.missionRepository
      .createQueryBuilder('mission')
      .where('mission.organizationId = :organizationId', { organizationId })
      .andWhere('mission.tags LIKE :importTag', { importTag: `scmdb:${missionId}` })
      .getOne();

    if (existing) {
      throw new ConflictError(`Mission ${missionId} is already imported in this organization`);
    }

    // Fetch the external catalog record
    const record = await this.externalCatalogRepository
      .createQueryBuilder('record')
      .where('record.source = :source', { source: ExternalCatalogSource.SCMDB })
      .andWhere('record.recordType = :recordType', {
        recordType: ExternalCatalogRecordType.CONTRACT,
      })
      .andWhere('record.isActive = :isActive', { isActive: true })
      .andWhere('record.externalId = :externalId', { externalId: missionId })
      .getOne();

    if (!record) {
      throw new ValidationError(`Mission ${missionId} not found in SCMDB cache`);
    }

    // Create and save mission
    const mission = this.missionRepository.create(
      this.mapScmdbRecordToMissionCreatePayload(record, organizationId, createdBy, {
        externalId: missionId,
        ...input,
      })
    );

    try {
      const saved = await this.missionRepository.save(mission);
      return saved;
    } catch (error) {
      // PostgreSQL unique-violation code 23505: (organizationId, sourceReference) conflict.
      // A concurrent import from the same org beat us to it — treat as ConflictError.
      if (
        error instanceof Error &&
        'code' in error &&
        (error as NodeJS.ErrnoException).code === '23505'
      ) {
        throw new ConflictError(`Mission ${missionId} is already imported in this organization`);
      }
      throw error;
    }
  }

  public async importScmdbMissions(
    organizationId: string,
    createdBy: string,
    inputs: ImportScmdbMissionInput[]
  ): Promise<ImportScmdbMissionsResult> {
    const sanitizedInputs = inputs
      .map(item => ({
        externalId: item.externalId.trim(),
        priority: item.priority,
        startDate: item.startDate,
        endDate: item.endDate,
        notes: item.notes,
      }))
      .filter(item => item.externalId.length > 0);

    if (sanitizedInputs.length === 0) {
      throw new ValidationError('At least one SCMDB mission externalId is required');
    }

    const uniqueExternalIds = [...new Set(sanitizedInputs.map(item => item.externalId))];
    const records = await this.externalCatalogRepository
      .createQueryBuilder('record')
      .where('record.source = :source', { source: ExternalCatalogSource.SCMDB })
      .andWhere('record.recordType = :recordType', {
        recordType: ExternalCatalogRecordType.CONTRACT,
      })
      .andWhere('record.isActive = :isActive', { isActive: true })
      .andWhere('record.externalId IN (:...externalIds)', { externalIds: uniqueExternalIds })
      .getMany();

    const recordByExternalId = new Map(records.map(record => [record.externalId, record]));
    const existingMissions = await this.missionRepository
      .createQueryBuilder('mission')
      .where('mission.organizationId = :organizationId', { organizationId })
      .andWhere('mission.tags LIKE :importTagPrefix', { importTagPrefix: 'scmdb:%' })
      .getMany();
    const importedExternalIdSet = new Set(
      existingMissions
        .flatMap(mission => mission.tags ?? [])
        .filter(tag => tag.startsWith('scmdb:'))
        .map(tag => tag.slice('scmdb:'.length))
    );

    const imported: Mission[] = [];
    const skipped: Array<{ externalId: string; reason: string }> = [];

    for (const input of sanitizedInputs) {
      const record = recordByExternalId.get(input.externalId);
      if (!record) {
        skipped.push({ externalId: input.externalId, reason: 'not-found-in-scmdb-cache' });
        continue;
      }

      if (importedExternalIdSet.has(input.externalId)) {
        skipped.push({ externalId: input.externalId, reason: 'already-imported' });
        continue;
      }

      const mission = this.missionRepository.create(
        this.mapScmdbRecordToMissionCreatePayload(record, organizationId, createdBy, input)
      );
      const saved = await this.missionRepository.save(mission);
      imported.push(saved);
      importedExternalIdSet.add(input.externalId);
    }

    return { imported, skipped };
  }

  private mapScmdbRecordToMissionCard(record: ExternalCatalogRecord): ScmdbMissionCard {
    const payload = record.payload;
    const title =
      this.readPayloadString(payload, ['title', 'name', 'displayName']) ??
      record.displayName ??
      `SCMDB Contract ${record.externalId}`;

    return {
      externalId: record.externalId,
      title,
      category:
        this.readPayloadString(payload, ['category', 'missionType']) ?? record.category ?? 'custom',
      description: this.readPayloadString(payload, ['description', 'summary']),
      location: this.readPayloadString(payload, ['location', 'planet', 'system']),
      difficultyHint: this.readPayloadString(payload, ['difficulty', 'riskLevel']),
      rewardHint: this.readPayloadString(payload, ['reward', 'payout']),
      tags: this.collectMissionTags(record),
      payload,
    };
  }

  private mapScmdbRecordToMissionCreatePayload(
    record: ExternalCatalogRecord,
    organizationId: string,
    createdBy: string,
    input: ImportScmdbMissionInput
  ): Partial<Mission> {
    const card = this.mapScmdbRecordToMissionCard(record);
    const sourceUrl = `https://scmdb.net/en/contracts/${record.externalId}`;
    const traceLine = `SCMDB Source: ${sourceUrl}`;
    const noteLines = [traceLine, input.notes?.trim()].filter((value): value is string =>
      Boolean(value && value.length > 0)
    );
    return {
      organizationId,
      createdBy,
      title: card.title,
      description: card.description,
      missionType: this.mapCategoryToMissionType(card.category),
      difficulty: this.mapDifficulty(card.difficultyHint),
      priority: input.priority ?? MissionPriority.NORMAL,
      location: card.location,
      reward: card.rewardHint,
      startDate: input.startDate,
      endDate: input.endDate,
      notes: noteLines.join('\n'),
      status: MissionStatus.DRAFT,
      tags: [...card.tags, `scmdb:${record.externalId}`, `source:${sourceUrl}`],
      // sourceReference enables DB-level unique constraint on (organizationId, sourceReference)
      // to close the TOCTOU race in concurrent same-mission imports. See migration 20260715100000.
      sourceReference: `scmdb:${record.externalId}`,
    };
  }

  private mapCategoryToMissionType(categoryRaw: string): MissionType {
    const category = categoryRaw.toLowerCase();
    if (category.includes('combat') || category.includes('bounty')) {
      return MissionType.COMBAT;
    }
    if (category.includes('mining')) {
      return MissionType.MINING;
    }
    if (category.includes('trade') || category.includes('cargo')) {
      return MissionType.TRADING;
    }
    if (category.includes('explor')) {
      return MissionType.EXPLORATION;
    }
    if (category.includes('escort')) {
      return MissionType.ESCORT;
    }
    if (category.includes('rescue') || category.includes('medical')) {
      return MissionType.RESCUE;
    }
    if (category.includes('recon')) {
      return MissionType.RECONNAISSANCE;
    }
    if (category.includes('salvage')) {
      return MissionType.SALVAGE;
    }
    if (category.includes('logistics')) {
      return MissionType.LOGISTICS;
    }
    return MissionType.CUSTOM;
  }

  private mapDifficulty(difficultyRaw?: string): MissionDifficulty {
    if (!difficultyRaw) {
      return MissionDifficulty.MEDIUM;
    }
    const normalized = difficultyRaw.toLowerCase();
    if (normalized.includes('trivial') || normalized.includes('very easy')) {
      return MissionDifficulty.TRIVIAL;
    }
    if (normalized.includes('easy') || normalized.includes('low')) {
      return MissionDifficulty.EASY;
    }
    if (normalized.includes('hard') || normalized.includes('high')) {
      return MissionDifficulty.HARD;
    }
    if (normalized.includes('extreme')) {
      return MissionDifficulty.EXTREME;
    }
    return MissionDifficulty.MEDIUM;
  }

  private readPayloadString(payload: Record<string, unknown>, keys: string[]): string | undefined {
    for (const key of keys) {
      const value = payload[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
    return undefined;
  }

  private collectMissionTags(record: ExternalCatalogRecord): string[] {
    const tags = new Set<string>();
    if (record.category) {
      tags.add(record.category.toLowerCase().replace(/\s+/g, '-'));
    }

    const payloadTags = record.payload.tags;
    if (Array.isArray(payloadTags)) {
      for (const tag of payloadTags) {
        if (typeof tag === 'string' && tag.trim().length > 0) {
          tags.add(tag.trim().toLowerCase().replace(/\s+/g, '-'));
        }
      }
    }

    tags.add('scmdb-import');
    return [...tags];
  }

  // ---- CRUD ----

  /**
   * Create a new mission
   * @param organizationId - Required for tenant isolation
   * @param missionData - Partial mission data (title, description, type, etc.)
   */
  public async createMission(
    organizationId: string,
    missionData: Partial<Mission>
  ): Promise<Mission> {
    const mission = this.missionRepository.create({
      ...missionData,
      organizationId,
      status: MissionStatus.DRAFT,
    });
    return this.missionRepository.save(mission);
  }

  /**
   * Get a single mission by ID
   * @param organizationId - Required for tenant isolation
   */
  public async getMissionById(id: string, organizationId: string): Promise<Mission | null> {
    return this.missionRepository.findOne({
      where: { id, organizationId },
      relations: ['fleet'],
    });
  }

  /**
   * Get all missions with filtering and pagination
   * @param organizationId - Required for tenant isolation
   */
  public async getAllMissions(
    organizationId: string,
    paginationOptions: PaginationOptions,
    filters?: MissionFilters
  ): Promise<PaginatedResponse<Mission>> {
    const page = paginationOptions.page || 1;
    const limit = paginationOptions.limit || 10;
    const skip = (page - 1) * limit;
    const sortBy = paginationOptions.sortBy || 'createdAt';
    const sortOrder = paginationOptions.sortOrder || 'DESC';

    const query = this.missionRepository.createQueryBuilder('mission');

    // Tenant isolation: always scope by organization
    query.andWhere('mission.organizationId = :organizationId', { organizationId });

    // Exclude soft-deleted records
    query.andWhere('mission.deletedAt IS NULL');

    // Optional fleet relation
    query.leftJoinAndSelect('mission.fleet', 'fleet');

    // Apply filters
    if (filters?.status) {
      query.andWhere('mission.status = :status', { status: filters.status });
    }

    if (filters?.missionType) {
      query.andWhere('mission.missionType = :missionType', {
        missionType: filters.missionType,
      });
    }

    if (filters?.difficulty) {
      query.andWhere('mission.difficulty = :difficulty', {
        difficulty: filters.difficulty,
      });
    }

    if (filters?.priority) {
      query.andWhere('mission.priority = :priority', {
        priority: filters.priority,
      });
    }

    if (filters?.createdBy) {
      query.andWhere('mission.createdBy = :createdBy', {
        createdBy: filters.createdBy,
      });
    }

    if (filters?.assignedTo) {
      query.andWhere('mission.assignedTo = :assignedTo', {
        assignedTo: filters.assignedTo,
      });
    }

    if (filters?.fleetId) {
      query.andWhere('mission.fleetId = :fleetId', {
        fleetId: filters.fleetId,
      });
    }

    if (filters?.tags && filters.tags.length > 0) {
      // Tags stored as simple-array (comma-separated); use LIKE for each tag
      filters.tags.forEach((tag, idx) => {
        query.andWhere(`mission.tags LIKE :tag${idx}`, {
          [`tag${idx}`]: `%${tag}%`,
        });
      });
    }

    if (filters?.search) {
      query.andWhere(
        '(mission.title ILIKE :search OR mission.description ILIKE :search OR mission.location ILIKE :search)',
        { search: `%${filters.search}%` }
      );
    }

    if (filters?.startDateFrom) {
      query.andWhere('mission.startDate >= :startDateFrom', {
        startDateFrom: filters.startDateFrom,
      });
    }

    if (filters?.startDateTo) {
      query.andWhere('mission.startDate <= :startDateTo', {
        startDateTo: filters.startDateTo,
      });
    }

    const [data, total] = await query
      .orderBy(`mission.${sortBy}`, sortOrder)
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Update mission
   * @param organizationId - Required for tenant isolation
   */
  public async updateMission(
    id: string,
    organizationId: string,
    updates: Partial<Mission>
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    // If status change is requested, validate transition
    if (updates.status && updates.status !== mission.status) {
      if (!mission.canTransitionTo(updates.status)) {
        throw new ValidationError(
          `Invalid status transition from '${mission.status}' to '${updates.status}'`
        );
      }

      // Auto-set completedAt for terminal states
      if (updates.status === MissionStatus.COMPLETED || updates.status === MissionStatus.FAILED) {
        updates.completedAt = new Date();
      }
    }

    Object.assign(mission, updates, { updatedAt: new Date() });

    return this.missionRepository.save(mission);
  }

  /**
   * Soft-delete mission
   * @param organizationId - Required for tenant isolation
   * @param deletedBy - User performing the deletion
   */
  public async deleteMission(
    id: string,
    organizationId: string,
    deletedBy: string
  ): Promise<boolean> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return false;
    }

    mission.deletedAt = new Date();
    mission.deletedBy = deletedBy;
    await this.missionRepository.save(mission);
    return true;
  }

  // ---- Status Management ----

  public async getWorkflow(
    id: string,
    organizationId: string
  ): Promise<MissionWorkflowState | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    const phases = this.buildWorkflowPhases(mission);
    const completedPhases = phases.filter(phase => phase.completed).length;

    return {
      missionId: mission.id,
      missionStatus: mission.status,
      completedPhases,
      totalPhases: phases.length,
      completionPercent: Math.round((completedPhases / phases.length) * 100),
      phases,
    };
  }

  public async advanceWorkflowPhase(
    id: string,
    organizationId: string,
    phase: MissionWorkflowPhase,
    notes?: string
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    const phaseState = this.buildWorkflowPhases(mission).find(p => p.phase === phase);
    if (!phaseState) {
      throw new ValidationError(`Unknown workflow phase '${phase}'`);
    }

    if (phaseState.blockers.length > 0) {
      throw new ValidationError(
        `Cannot advance '${phase}' phase: ${phaseState.blockers.join('; ')}`
      );
    }

    this.markWorkflowPhaseComplete(mission, phase);
    this.applyWorkflowStatusTransition(mission, phase);
    this.appendWorkflowNotes(mission, phase, notes);

    mission.updatedAt = new Date();
    return this.missionRepository.save(mission);
  }

  /**
   * Transition mission to a new status with validation
   * @param organizationId - Required for tenant isolation
   */
  public async transitionStatus(
    id: string,
    organizationId: string,
    newStatus: MissionStatus
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    if (!mission.canTransitionTo(newStatus)) {
      throw new ValidationError(
        `Invalid status transition from '${mission.status}' to '${newStatus}'`
      );
    }

    mission.status = newStatus;

    if (newStatus === MissionStatus.COMPLETED || newStatus === MissionStatus.FAILED) {
      mission.completedAt = new Date();
    }

    mission.updatedAt = new Date();
    return this.missionRepository.save(mission);
  }

  /**
   * Complete a mission with optional outcome notes
   * @param organizationId - Required for tenant isolation
   */
  public async completeMission(
    id: string,
    organizationId: string,
    outcome: { status: MissionStatus.COMPLETED | MissionStatus.FAILED; notes?: string }
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    if (!mission.canTransitionTo(outcome.status)) {
      throw new ValidationError(
        `Cannot transition from '${mission.status}' to '${outcome.status}'`
      );
    }

    mission.status = outcome.status;
    mission.completedAt = new Date();
    if (outcome.notes) {
      mission.notes = outcome.notes;
    }
    mission.updatedAt = new Date();

    return this.missionRepository.save(mission);
  }

  // ---- Participant Management ----

  /**
   * Assign a user to a mission and set the assignedTo field.
   * If the user is not already a participant, they are added as 'leader'.
   * @param organizationId - Required for tenant isolation
   */
  public async assignMission(
    id: string,
    organizationId: string,
    userId: string,
    role: MissionParticipantData['role'] = 'leader'
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    mission.assignedTo = userId;

    // Also add/update participant entry
    const participants = mission.participants || [];
    const existingIdx = participants.findIndex(p => p.userId === userId);

    if (existingIdx >= 0) {
      participants[existingIdx].role = role;
      participants[existingIdx].status = 'confirmed';
    } else {
      participants.push({
        userId,
        role,
        joinedAt: new Date().toISOString(),
        status: 'confirmed',
      });
    }

    mission.participants = participants;
    mission.updatedAt = new Date();

    return this.missionRepository.save(mission);
  }

  /**
   * Add a participant to a mission
   * @param organizationId - Required for tenant isolation
   */
  public async addParticipant(
    id: string,
    organizationId: string,
    userId: string,
    role: MissionParticipantData['role'] = 'member'
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    const participants = mission.participants || [];

    if (participants.some(p => p.userId === userId)) {
      throw new ConflictError('User is already a participant in this mission');
    }

    participants.push({
      userId,
      role,
      joinedAt: new Date().toISOString(),
      status: 'pending',
    });

    mission.participants = participants;
    mission.updatedAt = new Date();

    return this.missionRepository.save(mission);
  }

  /**
   * Remove a participant from a mission
   * @param organizationId - Required for tenant isolation
   */
  public async removeParticipant(
    id: string,
    organizationId: string,
    userId: string
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    const participants = mission.participants || [];
    mission.participants = participants.filter(p => p.userId !== userId);

    // Clear assignedTo if the removed user was the assignee
    if (mission.assignedTo === userId) {
      mission.assignedTo = undefined;
    }

    mission.updatedAt = new Date();

    return this.missionRepository.save(mission);
  }

  /**
   * Get all participants for a mission
   * @param organizationId - Required for tenant isolation
   */
  public async getParticipants(
    id: string,
    organizationId: string
  ): Promise<MissionParticipantData[] | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }
    return mission.participants || [];
  }

  // ---- Objective Management ----

  /**
   * Add an objective to a mission
   * @param organizationId - Required for tenant isolation
   */
  public async addObjective(
    id: string,
    organizationId: string,
    objective: { title: string; description?: string; optional?: boolean }
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(id, organizationId);
    if (!mission) {
      return null;
    }

    const objectives = mission.objectives || [];
    const maxOrder = objectives.reduce((max, o) => Math.max(max, o.order), 0);

    objectives.push({
      id: crypto.randomUUID(),
      title: objective.title,
      description: objective.description,
      completed: false,
      optional: objective.optional ?? false,
      order: maxOrder + 1,
    });

    mission.objectives = objectives;
    mission.updatedAt = new Date();

    return this.missionRepository.save(mission);
  }

  /**
   * Update an objective
   * @param organizationId - Required for tenant isolation
   */
  public async updateObjective(
    missionId: string,
    organizationId: string,
    objectiveId: string,
    updates: { title?: string; description?: string; completed?: boolean; optional?: boolean }
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(missionId, organizationId);
    if (!mission?.objectives) {
      return null;
    }

    const objIdx = mission.objectives.findIndex(o => o.id === objectiveId);
    if (objIdx === -1) {
      return null;
    }

    mission.objectives[objIdx] = {
      ...mission.objectives[objIdx],
      ...updates,
    };
    mission.updatedAt = new Date();

    return this.missionRepository.save(mission);
  }

  /**
   * Remove an objective
   * @param organizationId - Required for tenant isolation
   */
  public async removeObjective(
    missionId: string,
    organizationId: string,
    objectiveId: string
  ): Promise<Mission | null> {
    const mission = await this.getMissionById(missionId, organizationId);
    if (!mission?.objectives) {
      return null;
    }

    mission.objectives = mission.objectives.filter(o => o.id !== objectiveId);
    mission.updatedAt = new Date();

    return this.missionRepository.save(mission);
  }

  // ---- Query Helpers ----

  /**
   * Get missions by fleet
   * @param organizationId - Required for tenant isolation
   */
  public async getMissionsByFleet(fleetId: string, organizationId: string): Promise<Mission[]> {
    return this.missionRepository.find({
      where: { fleetId, organizationId, deletedAt: undefined },
      order: { createdAt: 'DESC' },
      relations: ['fleet'],
    });
  }

  /**
   * Get active missions for an organization
   * @param organizationId - Required for tenant isolation
   */
  public async getActiveMissions(organizationId: string): Promise<Mission[]> {
    return this.missionRepository.find({
      where: [
        { organizationId, status: MissionStatus.PLANNED, deletedAt: undefined },
        { organizationId, status: MissionStatus.BRIEFED, deletedAt: undefined },
        { organizationId, status: MissionStatus.IN_PROGRESS, deletedAt: undefined },
      ],
      order: { priority: 'DESC', startDate: 'ASC' },
      relations: ['fleet'],
    });
  }

  /**
   * Get mission templates (draft missions with no assignee, used as blueprints)
   */
  public async getTemplates(organizationId: string): Promise<Mission[]> {
    return this.missionRepository.find({
      where: {
        organizationId,
        status: MissionStatus.DRAFT,
        assignedTo: undefined,
        deletedAt: undefined,
      },
      order: { createdAt: 'DESC' },
    });
  }

  private hasWorkflowTag(mission: Mission, phase: MissionWorkflowPhase): boolean {
    return (mission.tags ?? []).includes(WORKFLOW_PHASE_TAGS[phase]);
  }

  private markWorkflowPhaseComplete(mission: Mission, phase: MissionWorkflowPhase): void {
    const currentTags = mission.tags ?? [];
    const completionTag = WORKFLOW_PHASE_TAGS[phase];
    if (!currentTags.includes(completionTag)) {
      mission.tags = [...currentTags, completionTag];
    }
  }

  private applyWorkflowStatusTransition(mission: Mission, phase: MissionWorkflowPhase): void {
    const transition = WORKFLOW_STATUS_TRANSITIONS[phase];
    if (!transition) {
      return;
    }

    if (mission.status !== transition.from || !mission.canTransitionTo(transition.to)) {
      return;
    }

    mission.status = transition.to;
    if (transition.setsCompletedAt) {
      mission.completedAt = new Date();
    }
  }

  private appendWorkflowNotes(mission: Mission, phase: MissionWorkflowPhase, notes?: string): void {
    const trimmedNotes = notes?.trim();
    if (!trimmedNotes) {
      return;
    }

    const noteHeader = `\n[Workflow:${phase}] ${trimmedNotes}`;
    mission.notes = `${mission.notes ?? ''}${noteHeader}`.trim();
  }

  private isTerminalMissionStatus(status: MissionStatus): boolean {
    return [MissionStatus.COMPLETED, MissionStatus.FAILED, MissionStatus.CANCELLED].includes(
      status
    );
  }

  private getDispatchBlockers(mission: Mission): string[] {
    const blockers: string[] = [];
    if (!mission.assignedTo && (!mission.participants || mission.participants.length === 0)) {
      blockers.push('Assign a mission lead or add at least one participant.');
    }
    return blockers;
  }

  private getQuartermasterBlockers(mission: Mission): string[] {
    const blockers: string[] = [];
    if (!mission.objectives || mission.objectives.length === 0) {
      blockers.push('Define at least one mission objective.');
    }
    if (!mission.location) {
      blockers.push('Set a mission location for deployment planning.');
    }
    return blockers;
  }

  private getExecutionBlockers(mission: Mission): string[] {
    const blockers: string[] = [];
    if (!this.hasWorkflowTag(mission, 'dispatch')) {
      blockers.push('Complete dispatch phase first.');
    }
    if (!this.hasWorkflowTag(mission, 'quartermaster')) {
      blockers.push('Complete quartermaster phase first.');
    }
    return blockers;
  }

  private getAfterActionBlockers(mission: Mission, isTerminalStatus: boolean): string[] {
    const blockers: string[] = [];
    if (mission.status !== MissionStatus.IN_PROGRESS && !isTerminalStatus) {
      blockers.push('Mission must be in progress or finished before after-action.');
    }
    return blockers;
  }

  private isDispatchCompleted(mission: Mission): boolean {
    return this.hasWorkflowTag(mission, 'dispatch') || mission.status !== MissionStatus.DRAFT;
  }

  private isQuartermasterCompleted(mission: Mission): boolean {
    return (
      this.hasWorkflowTag(mission, 'quartermaster') ||
      QUARTERMASTER_COMPLETED_STATUSES.has(mission.status)
    );
  }

  private isExecutionCompleted(mission: Mission): boolean {
    return (
      this.hasWorkflowTag(mission, 'execution') || EXECUTION_COMPLETED_STATUSES.has(mission.status)
    );
  }

  private buildWorkflowPhases(mission: Mission): MissionWorkflowPhaseState[] {
    const dispatchBlockers = this.getDispatchBlockers(mission);
    const quartermasterBlockers = this.getQuartermasterBlockers(mission);
    const executionBlockers = this.getExecutionBlockers(mission);
    const isTerminalStatus = this.isTerminalMissionStatus(mission.status);
    const afterActionBlockers = this.getAfterActionBlockers(mission, isTerminalStatus);

    const phaseMap: Record<MissionWorkflowPhase, MissionWorkflowPhaseState> = {
      dispatch: {
        phase: 'dispatch',
        title: 'Dispatch',
        description: 'Confirm command lead, participants, and mission activation.',
        completed: this.isDispatchCompleted(mission),
        blockers: dispatchBlockers,
        suggestedStatus: MissionStatus.PLANNED,
        nextActions: [
          'Assign a mission lead',
          'Confirm participant roster',
          'Move mission to planned',
        ],
      },
      quartermaster: {
        phase: 'quartermaster',
        title: 'Quartermaster',
        description: 'Validate objectives, location, and mission prep before briefing.',
        completed: this.isQuartermasterCompleted(mission),
        blockers: quartermasterBlockers,
        suggestedStatus: MissionStatus.BRIEFED,
        nextActions: [
          'Finalize objectives',
          'Confirm logistics and location',
          'Mark mission briefed',
        ],
      },
      execution: {
        phase: 'execution',
        title: 'Execution',
        description: 'Launch mission execution and track active operation.',
        completed: this.isExecutionCompleted(mission),
        blockers: executionBlockers,
        suggestedStatus: MissionStatus.IN_PROGRESS,
        nextActions: [
          'Start mission run',
          'Monitor objective progress',
          'Capture in-mission updates',
        ],
      },
      after_action: {
        phase: 'after_action',
        title: 'After Action',
        description: 'Capture outcomes, lessons learned, and finalize mission result.',
        completed: this.hasWorkflowTag(mission, 'after_action') || isTerminalStatus,
        blockers: afterActionBlockers,
        suggestedStatus: MissionStatus.COMPLETED,
        nextActions: [
          'Record mission notes',
          'Close with completed/failed outcome',
          'Capture follow-up actions',
        ],
      },
    };

    return WORKFLOW_PHASE_ORDER.map(phase => phaseMap[phase]);
  }
}
