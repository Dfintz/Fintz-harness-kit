import { randomUUID } from 'node:crypto';

import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { Briefing, BriefingClassification, BriefingStatus } from '../../models/Briefing';
import { PaginatedResponse, PaginationOptions } from '../../utils/pagination';
import { StarCommsContextSyncService } from '../communication/starcomms';

export class BriefingService {
  private _briefingRepository?: Repository<Briefing>;
  private readonly starCommsContextSyncService = new StarCommsContextSyncService();

  /**
   * Repository is acquired lazily to allow instantiation when the DB is unavailable.
   * Any method that touches the database will fail fast with a clear error if the
   * AppDataSource has not been initialized.
   */
  private get briefingRepository(): Repository<Briefing> {
    if (!AppDataSource.isInitialized) {
      throw new Error(
        'Database not initialized - call initializeDatabase() before using BriefingService database operations'
      );
    }
    this._briefingRepository ??= AppDataSource.getRepository(Briefing);
    return this._briefingRepository;
  }

  /**
   * Create a new briefing
   * @param organizationId - Required for tenant isolation
   */
  public async createBriefing(
    organizationId: string,
    briefingData: Partial<Briefing>
  ): Promise<Briefing> {
    const briefing = this.briefingRepository.create({
      ...briefingData,
      organizationId,
    });
    const saved = await this.briefingRepository.save(briefing);

    this.starCommsContextSyncService
      .syncBriefingContext({
        organizationId,
        briefingId: saved.id,
        title: saved.title,
        classification: saved.classification,
        status: saved.status,
        missionId: saved.missionId,
        operationIds: saved.operationIds,
      })
      .catch(() => {
        // Keep briefing CRUD non-blocking if StarComms sync is unavailable.
      });

    return saved;
  }

  /**
   * Get briefing by ID
   * @param organizationId - Required for tenant isolation
   */
  public async getBriefingById(id: string, organizationId: string): Promise<Briefing | null> {
    return this.briefingRepository.findOne({
      where: { id, organizationId },
    });
  }

  /**
   * Get all briefings with optional filtering and pagination
   * @param organizationId - Required for tenant isolation
   */
  public async getAllBriefings(
    organizationId: string,
    paginationOptions: PaginationOptions,
    filters?: {
      creatorId?: string;
      missionId?: string;
      status?: BriefingStatus;
      classification?: BriefingClassification;
      operationId?: string;
      tags?: string[];
    }
  ): Promise<PaginatedResponse<Briefing>> {
    const page = paginationOptions.page ?? 1;
    const limit = paginationOptions.limit ?? 10;
    const skip = (page - 1) * limit;

    const ALLOWED_SORT_COLUMNS = [
      'createdAt',
      'updatedAt',
      'title',
      'status',
      'classification',
      'version',
    ] as const;
    const rawSortBy = paginationOptions.sortBy ?? 'createdAt';
    const sortBy = (ALLOWED_SORT_COLUMNS as readonly string[]).includes(rawSortBy)
      ? rawSortBy
      : 'createdAt';
    const sortOrder = paginationOptions.sortOrder ?? 'DESC';

    const query = this.briefingRepository.createQueryBuilder('briefing');

    // Tenant isolation: always scope by organization
    query.andWhere('briefing.organizationId = :organizationId', { organizationId });

    if (filters?.creatorId) {
      query.andWhere('briefing.creatorId = :creatorId', {
        creatorId: filters.creatorId,
      });
    }

    if (filters?.missionId) {
      query.andWhere('briefing.missionId = :missionId', {
        missionId: filters.missionId,
      });
    }

    if (filters?.status) {
      query.andWhere('briefing.status = :status', { status: filters.status });
    }

    if (filters?.classification) {
      query.andWhere('briefing.classification = :classification', {
        classification: filters.classification,
      });
    }

    if (filters?.operationId) {
      // operationIds is stored as simple-json (text serialised JSON array).
      // Match the exact UUID surrounded by quotes to avoid partial matches.
      query.andWhere('briefing."operationIds" LIKE :operationId', {
        operationId: `%"${filters.operationId}"%`,
      });
    }

    if (filters?.tags && filters.tags.length > 0) {
      // tags is stored as simple-array (comma-separated TEXT), not a native PG array.
      // Use LIKE for text-based matching instead of the && array overlap operator.
      filters.tags.forEach((tag, index) => {
        query.andWhere(`briefing.tags LIKE :tag_${index}`, {
          [`tag_${index}`]: `%${tag}%`,
        });
      });
    }

    const [data, total] = await query
      .orderBy(`briefing.${sortBy}`, sortOrder)
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
   * Update briefing
   * @param organizationId - Required for tenant isolation
   */
  public async updateBriefing(
    id: string,
    organizationId: string,
    updates: Partial<Briefing>
  ): Promise<Briefing | null> {
    const briefing = await this.getBriefingById(id, organizationId);
    if (!briefing) {
      return null;
    }

    Object.assign(briefing, updates, { updatedAt: new Date() });
    const saved = await this.briefingRepository.save(briefing);

    this.starCommsContextSyncService
      .syncBriefingContext({
        organizationId,
        briefingId: saved.id,
        title: saved.title,
        classification: saved.classification,
        status: saved.status,
        missionId: saved.missionId,
        operationIds: saved.operationIds,
      })
      .catch(() => {
        // Keep briefing update non-blocking if StarComms sync is unavailable.
      });

    return saved;
  }

  /**
   * Delete briefing
   * @param organizationId - Required for tenant isolation
   */
  public async deleteBriefing(id: string, organizationId: string): Promise<boolean> {
    // Verify briefing belongs to organization before deleting
    const briefing = await this.getBriefingById(id, organizationId);
    if (!briefing) {
      return false;
    }
    const result = await this.briefingRepository.delete({ id, organizationId });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Add element to briefing
   * @param organizationId - Required for tenant isolation
   */
  public async addElement(
    briefingId: string,
    organizationId: string,
    element: {
      type: 'text' | 'shape' | 'line' | 'arrow' | 'marker';
      position: { x: number; y: number };
      data: unknown;
    }
  ): Promise<Briefing | null> {
    const briefing = await this.getBriefingById(briefingId, organizationId);
    if (!briefing) {
      return null;
    }

    const elements = briefing.elements ?? [];
    const newElement = {
      id: randomUUID(),
      type: element.type,
      position: element.position,
      data: element.data,
    };

    elements.push(newElement);
    briefing.elements = elements;
    briefing.updatedAt = new Date();

    return this.briefingRepository.save(briefing);
  }

  /**
   * Update element
   * @param organizationId - Required for tenant isolation
   */
  public async updateElement(
    briefingId: string,
    organizationId: string,
    elementId: string,
    updates: {
      type?: 'text' | 'shape' | 'line' | 'arrow' | 'marker';
      position?: { x: number; y: number };
      data?: unknown;
    }
  ): Promise<Briefing | null> {
    const briefing = await this.getBriefingById(briefingId, organizationId);
    if (!briefing?.elements) {
      return null;
    }

    const elementIndex = briefing.elements.findIndex(e => e.id === elementId);
    if (elementIndex === -1) {
      return null;
    }

    briefing.elements[elementIndex] = {
      ...briefing.elements[elementIndex],
      ...updates,
    };
    briefing.updatedAt = new Date();

    return this.briefingRepository.save(briefing);
  }

  /**
   * Delete element
   * @param organizationId - Required for tenant isolation
   */
  public async deleteElement(
    briefingId: string,
    organizationId: string,
    elementId: string
  ): Promise<Briefing | null> {
    const briefing = await this.getBriefingById(briefingId, organizationId);
    if (!briefing?.elements) {
      return null;
    }

    briefing.elements = briefing.elements.filter(e => e.id !== elementId);
    briefing.updatedAt = new Date();

    return this.briefingRepository.save(briefing);
  }

  /**
   * Add participant to briefing
   * @param organizationId - Required for tenant isolation
   */
  public async addParticipant(
    briefingId: string,
    organizationId: string,
    userId: string
  ): Promise<Briefing | null> {
    const briefing = await this.getBriefingById(briefingId, organizationId);
    if (!briefing) {
      return null;
    }

    const participants = briefing.participants ?? [];
    if (!participants.includes(userId)) {
      participants.push(userId);
      briefing.participants = participants;
      briefing.updatedAt = new Date();

      return this.briefingRepository.save(briefing);
    }

    return briefing;
  }

  /**
   * Remove participant
   * @param organizationId - Required for tenant isolation
   */
  public async removeParticipant(
    briefingId: string,
    organizationId: string,
    userId: string
  ): Promise<Briefing | null> {
    const briefing = await this.getBriefingById(briefingId, organizationId);
    if (!briefing) {
      return null;
    }

    const participants = briefing.participants ?? [];
    briefing.participants = participants.filter(id => id !== userId);
    briefing.updatedAt = new Date();

    return this.briefingRepository.save(briefing);
  }

  /**
   * Update briefing status
   * @param organizationId - Required for tenant isolation
   */
  public async updateStatus(
    briefingId: string,
    organizationId: string,
    status: BriefingStatus
  ): Promise<Briefing | null> {
    return this.updateBriefing(briefingId, organizationId, { status });
  }

  /**
   * Create new version
   * @param organizationId - Required for tenant isolation
   */
  public async createVersion(briefingId: string, organizationId: string): Promise<Briefing | null> {
    const originalBriefing = await this.getBriefingById(briefingId, organizationId);
    if (!originalBriefing) {
      return null;
    }

    const newVersion = this.briefingRepository.create({
      ...originalBriefing,
      id: undefined, // Let TypeORM generate new ID
      organizationId, // Preserve tenant isolation on cloned version
      version: originalBriefing.version + 1,
      createdAt: undefined,
      updatedAt: undefined,
    });

    return this.briefingRepository.save(newVersion);
  }

  /**
   * Get briefings by mission
   * @param organizationId - Required for tenant isolation
   */
  public async getBriefingsByMission(
    missionId: string,
    organizationId: string
  ): Promise<Briefing[]> {
    return this.briefingRepository.find({
      where: { missionId, organizationId },
      order: { version: 'DESC' },
    });
  }
}
