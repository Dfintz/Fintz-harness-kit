/**
 * OrgWatchlistService
 *
 * CRUD operations and cross-reference for RSI citizens
 * that an org's intel team wants to monitor.
 *
 * Wave 2.1 — Membership Audit & Intel (Phase C)
 */
import type {
  CreateWatchlistEntryDto,
  ListWatchlistQuery,
  UpdateWatchlistEntryDto,
  WatchlistCrossReferenceResult,
  WatchlistEntrySummary,
} from '@sc-fleet-manager/shared-types';
import { In, type DeepPartial, type Repository } from 'typeorm';

import { AppDataSource } from '../../config/database';
import { OrgWatchlistEntry } from '../../models/OrgWatchlistEntry';
import { ConflictError, NotFoundError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

/* ──────────────────────────────────────────────────────────────────── */
/*  Pagination wrapper                                                 */
/* ──────────────────────────────────────────────────────────────────── */

export interface PaginatedWatchlist {
  data: WatchlistEntrySummary[];
  total: number;
  page: number;
  pageSize: number;
}

/* ──────────────────────────────────────────────────────────────────── */
/*  Service                                                            */
/* ──────────────────────────────────────────────────────────────────── */

export class OrgWatchlistService {
  private readonly repo: Repository<OrgWatchlistEntry>;

  constructor() {
    this.repo = AppDataSource.getRepository(OrgWatchlistEntry);
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  CRUD                                                              */
  /* ═══════════════════════════════════════════════════════════════════ */

  /**
   * Create a new watchlist entry.
   * Enforces unique (organizationId, rsiHandle) via DB unique index.
   */
  async createEntry(
    organizationId: string,
    officerId: string,
    dto: CreateWatchlistEntryDto
  ): Promise<WatchlistEntrySummary> {
    const data: DeepPartial<OrgWatchlistEntry> = {
      organizationId,
      addedBy: officerId,
      rsiHandle: dto.rsiHandle.trim().toUpperCase(),
      citizenName: dto.citizenName.trim(),
      reason: dto.reason,
      threatLevel: dto.threatLevel,
      notes: dto.notes,
    };

    const entry = this.repo.create(data);

    try {
      const saved = await this.repo.save(entry);
      return this.toSummary(saved);
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Error & { code: string }).code === '23505'
      ) {
        throw new ConflictError(
          `A watchlist entry for RSI handle "${data.rsiHandle}" already exists in this organization`
        );
      }
      throw error;
    }
  }

  /**
   * Get a single watchlist entry by ID within the org.
   */
  async getEntryById(
    organizationId: string,
    entryId: string
  ): Promise<WatchlistEntrySummary | null> {
    const entry = await this.repo.findOne({
      where: { id: entryId, organizationId },
    });
    return entry ? this.toSummary(entry) : null;
  }

  /**
   * List watchlist entries with filtering, pagination, and sorting.
   */
  async listEntries(
    organizationId: string,
    query?: ListWatchlistQuery
  ): Promise<PaginatedWatchlist> {
    const page = query?.page ?? 1;
    const pageSize = Math.min(query?.pageSize ?? 25, 100);
    const sortBy = query?.sortBy ?? 'createdAt';
    const sortOrder = query?.sortOrder ?? 'DESC';

    try {
      const qb = this.repo
        .createQueryBuilder('w')
        .where('w.organizationId = :organizationId', { organizationId });

      /* ── Filters ─────────────────────────────────────────────── */
      if (query?.reasons && query.reasons.length > 0) {
        qb.andWhere('w.reason IN (:...reasons)', { reasons: query.reasons });
      }
      if (query?.threatLevels && query.threatLevels.length > 0) {
        qb.andWhere('w.threatLevel IN (:...threatLevels)', {
          threatLevels: query.threatLevels,
        });
      }
      if (query?.search) {
        qb.andWhere('(LOWER(w.rsiHandle) LIKE :search OR LOWER(w.citizenName) LIKE :search)', {
          search: `%${query.search.toLowerCase()}%`,
        });
      }

      /* ── Sort + Paginate ────────────────────────────────────── */
      const ALLOWED_SORT = new Set([
        'createdAt',
        'updatedAt',
        'citizenName',
        'rsiHandle',
        'threatLevel',
        'reason',
      ]);
      const safeSortBy = ALLOWED_SORT.has(sortBy) ? sortBy : 'createdAt';
      qb.orderBy(`w.${safeSortBy}`, sortOrder)
        .skip((page - 1) * pageSize)
        .take(pageSize);

      const [entries, total] = await qb.getManyAndCount();

      return {
        data: entries.map(e => this.toSummary(e)),
        total,
        page,
        pageSize,
      };
    } catch (err: unknown) {
      logger.error('OrgWatchlistService.listEntries failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        organizationId,
      });
      return { data: [], total: 0, page, pageSize };
    }
  }

  /**
   * Update an existing watchlist entry (partial update).
   */
  async updateEntry(
    organizationId: string,
    entryId: string,
    dto: UpdateWatchlistEntryDto
  ): Promise<WatchlistEntrySummary> {
    const entry = await this.repo.findOne({
      where: { id: entryId, organizationId },
    });

    if (!entry) {
      throw new NotFoundError('Watchlist entry not found');
    }

    if (dto.reason !== undefined) {
      entry.reason = dto.reason;
    }
    if (dto.threatLevel !== undefined) {
      entry.threatLevel = dto.threatLevel;
    }
    if (dto.notes !== undefined) {
      entry.notes = dto.notes;
    }
    if (dto.citizenName !== undefined) {
      entry.citizenName = dto.citizenName.trim();
    }

    const saved = await this.repo.save(entry);
    return this.toSummary(saved);
  }

  /**
   * Delete a watchlist entry.
   * Returns true if the entry was found and deleted.
   */
  async deleteEntry(organizationId: string, entryId: string): Promise<boolean> {
    const result = await this.repo.delete({
      id: entryId,
      organizationId,
    });
    return (result.affected ?? 0) > 0;
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Cross-reference                                                   */
  /* ═══════════════════════════════════════════════════════════════════ */

  /**
   * Given a list of RSI handles (e.g., from member RSI profiles),
   * return watchlist entries that match any of them.
   */
  async crossReference(
    organizationId: string,
    rsiHandles: string[]
  ): Promise<WatchlistCrossReferenceResult[]> {
    if (rsiHandles.length === 0) {
      return [];
    }

    const normalised = rsiHandles.map(s => s.trim().toUpperCase());

    const entries = await this.repo.find({
      where: {
        organizationId,
        rsiHandle: In(normalised),
      },
    });

    return entries.map(entry => ({
      rsiHandle: entry.rsiHandle,
      entry: this.toSummary(entry),
    }));
  }

  /**
   * Check whether a single RSI handle is on the watchlist.
   * Returns the entry if found, null otherwise.
   */
  async findByHandle(
    organizationId: string,
    rsiHandle: string
  ): Promise<WatchlistEntrySummary | null> {
    const entry = await this.repo.findOne({
      where: {
        organizationId,
        rsiHandle: rsiHandle.trim().toUpperCase(),
      },
    });
    return entry ? this.toSummary(entry) : null;
  }

  /* ═══════════════════════════════════════════════════════════════════ */
  /*  Private helpers                                                   */
  /* ═══════════════════════════════════════════════════════════════════ */

  private toSummary(entry: OrgWatchlistEntry): WatchlistEntrySummary {
    return {
      id: entry.id,
      organizationId: entry.organizationId,
      rsiHandle: entry.rsiHandle,
      citizenName: entry.citizenName,
      reason: entry.reason,
      threatLevel: entry.threatLevel,
      notes: entry.notes,
      addedBy: entry.addedBy,
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
    };
  }
}

