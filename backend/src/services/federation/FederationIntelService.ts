import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import {
  FederationIntelClassification,
  FederationIntelEntry,
  FederationIntelStatus,
} from '../../models/FederationIntelEntry';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationPermission, requireFederationViewAccess } from './federationPermissions';

// ─── Data Interface ───────────────────────────────────────────

export interface FederationIntelData {
  id: string;
  federationId: string;
  title: string;
  content: string;
  classification: FederationIntelClassification;
  status: FederationIntelStatus;
  submittedBy: string;
  submittedByName: string | null;
  submittedByOrgId: string | null;
  approvedBy: string | null;
  tags: string[];
  visibleToTreaties: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * FederationIntelService
 *
 * Manages federation-level shared intel. Ambassadors with 'intel'
 * permission can submit entries. Council members can approve/publish.
 *
 * Classification controls visibility:
 *   - open: all federation ambassadors
 *   - restricted: council+ ambassadors only
 *   - secret: only ambassadors from orgs with matching treaty access
 */
export class FederationIntelService {
  private static instance: FederationIntelService;
  private readonly intelRepository: Repository<FederationIntelEntry>;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.intelRepository = AppDataSource.getRepository(FederationIntelEntry);
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationIntelService {
    if (!FederationIntelService.instance) {
      FederationIntelService.instance = new FederationIntelService();
    }
    return FederationIntelService.instance;
  }

  // ─── Helpers ───────────────────────────────────────────────

  private toData(entity: FederationIntelEntry): FederationIntelData {
    return {
      id: entity.id,
      federationId: entity.federationId,
      title: entity.title,
      content: entity.content,
      classification: entity.classification,
      status: entity.status,
      submittedBy: entity.submittedBy,
      submittedByName: entity.submittedByName,
      submittedByOrgId: entity.submittedByOrgId,
      approvedBy: entity.approvedBy,
      tags: entity.tags ?? [],
      visibleToTreaties: entity.visibleToTreaties ?? [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  // ─── CRUD ─────────────────────────────────────────────────

  /**
   * Submit a new intel entry (draft or pending review).
   */
  async submitIntel(
    federationId: string,
    userId: string,
    data: {
      title: string;
      content: string;
      classification?: FederationIntelClassification;
      tags?: string[];
      visibleToTreaties?: string[];
      submittedByName?: string;
      submittedByOrgId?: string;
    }
  ): Promise<FederationIntelData> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'intel',
      'Ambassador intel permission required to submit intel'
    );

    if (!data.title?.trim() || data.title.trim().length < 3) {
      throw new ValidationError('Intel title must be at least 3 characters');
    }
    if (!data.content?.trim() || data.content.trim().length < 10) {
      throw new ValidationError('Intel content must be at least 10 characters');
    }

    const entry = this.intelRepository.create({
      federationId,
      title: data.title.trim(),
      content: data.content.trim(),
      classification: data.classification ?? 'open',
      status: 'pending_review',
      submittedBy: userId,
      submittedByName: data.submittedByName ?? null,
      submittedByOrgId: data.submittedByOrgId ?? null,
      tags: data.tags ?? [],
      visibleToTreaties: data.visibleToTreaties ?? [],
    });

    const saved = await this.intelRepository.save(entry);

    logger.info('Federation intel submitted', {
      federationId,
      intelId: saved.id,
      classification: saved.classification,
    });

    return this.toData(saved);
  }

  /**
   * List intel entries visible to the current user.
   */
  async listIntel(
    federationId: string,
    userId: string,
    filters?: { classification?: string; status?: string }
  ): Promise<FederationIntelData[]> {
    await requireFederationViewAccess(
      this.ambassadorService,
      federationId,
      userId,
      'federation intel'
    );

    const where: Record<string, unknown> = { federationId };
    if (filters?.classification) {
      where.classification = filters.classification;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    const entries = await this.intelRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 100,
    });

    return entries.map(e => this.toData(e));
  }

  /**
   * Get a single intel entry.
   */
  async getIntel(
    federationId: string,
    userId: string,
    intelId: string
  ): Promise<FederationIntelData> {
    await requireFederationViewAccess(
      this.ambassadorService,
      federationId,
      userId,
      'federation intel'
    );

    const entry = await this.intelRepository.findOne({
      where: { id: intelId, federationId },
    });
    if (!entry) {
      throw new NotFoundError('Intel entry', intelId);
    }

    return this.toData(entry);
  }

  /**
   * Approve and publish an intel entry (requires intel permission).
   */
  async approveIntel(
    federationId: string,
    userId: string,
    intelId: string
  ): Promise<FederationIntelData> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'intel',
      'Ambassador intel permission required to approve intel'
    );

    const entry = await this.intelRepository.findOne({
      where: { id: intelId, federationId },
    });
    if (!entry) {
      throw new NotFoundError('Intel entry', intelId);
    }
    if (entry.status !== 'pending_review' && entry.status !== 'draft') {
      throw new ValidationError('Only pending or draft intel can be approved');
    }

    entry.status = 'published';
    entry.approvedBy = userId;

    const saved = await this.intelRepository.save(entry);

    logger.info('Federation intel approved', { federationId, intelId });

    return this.toData(saved);
  }

  /**
   * Archive an intel entry.
   */
  async archiveIntel(
    federationId: string,
    userId: string,
    intelId: string
  ): Promise<FederationIntelData> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'intel',
      'Ambassador intel permission required to archive intel'
    );

    const entry = await this.intelRepository.findOne({
      where: { id: intelId, federationId },
    });
    if (!entry) {
      throw new NotFoundError('Intel entry', intelId);
    }

    entry.status = 'archived';
    const saved = await this.intelRepository.save(entry);

    logger.info('Federation intel archived', { federationId, intelId });

    return this.toData(saved);
  }

  /**
   * Update an intel entry (only draft/pending entries).
   */
  async updateIntel(
    federationId: string,
    userId: string,
    intelId: string,
    data: {
      title?: string;
      content?: string;
      classification?: FederationIntelClassification;
      tags?: string[];
      visibleToTreaties?: string[];
    }
  ): Promise<FederationIntelData> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'intel',
      'Ambassador intel permission required to update intel'
    );

    const entry = await this.intelRepository.findOne({
      where: { id: intelId, federationId },
    });
    if (!entry) {
      throw new NotFoundError('Intel entry', intelId);
    }
    if (entry.status === 'archived') {
      throw new ValidationError('Archived intel cannot be edited');
    }

    if (data.title !== undefined) {
      entry.title = data.title.trim();
    }
    if (data.content !== undefined) {
      entry.content = data.content.trim();
    }
    if (data.classification !== undefined) {
      entry.classification = data.classification;
    }
    if (data.tags !== undefined) {
      entry.tags = data.tags;
    }
    if (data.visibleToTreaties !== undefined) {
      entry.visibleToTreaties = data.visibleToTreaties;
    }

    const saved = await this.intelRepository.save(entry);

    logger.info('Federation intel updated', { federationId, intelId });

    return this.toData(saved);
  }

  /**
   * Delete an intel entry.
   */
  async deleteIntel(federationId: string, userId: string, intelId: string): Promise<void> {
    await requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'intel',
      'Ambassador intel permission required to delete intel'
    );

    const entry = await this.intelRepository.findOne({
      where: { id: intelId, federationId },
    });
    if (!entry) {
      throw new NotFoundError('Intel entry', intelId);
    }

    await this.intelRepository.remove(entry);

    logger.info('Federation intel deleted', { federationId, intelId });
  }
}

