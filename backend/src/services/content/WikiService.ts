import * as crypto from 'node:crypto';

import type {
  CreateWikiPageRequest,
  MoveWikiPageRequest,
  UpdateWikiPageRequest,
  WikiSearchResult,
  WikiTreeNode,
} from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { WikiPage } from '../../models/WikiPage';
import { WikiPageRevision } from '../../models/WikiPageRevision';
import { NotFoundError, ServiceUnavailableError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

// Re-use shared-types interfaces for DTOs

/** Maximum nesting depth for wiki pages */
const MAX_NESTING_DEPTH = 3;

/**
 * WikiService
 *
 * Handles wiki page CRUD, hierarchical tree operations, slug generation,
 * automatic revision tracking, and PostgreSQL tsvector full-text search.
 *
 * All operations enforce tenant isolation via organizationId scoping.
 */
export class WikiService {
  private _pageRepository?: Repository<WikiPage>;
  private _revisionRepository?: Repository<WikiPageRevision>;

  // ── Lazy repository accessors (same pattern as MissionService) ──

  private get pageRepository(): Repository<WikiPage> {
    if (!AppDataSource.isInitialized) {
      throw new ServiceUnavailableError(
        'Database not initialized - call initializeDatabase() before using WikiService'
      );
    }
    this._pageRepository ??= AppDataSource.getRepository(WikiPage);
    return this._pageRepository;
  }

  private get revisionRepository(): Repository<WikiPageRevision> {
    if (!AppDataSource.isInitialized) {
      throw new ServiceUnavailableError(
        'Database not initialized - call initializeDatabase() before using WikiService'
      );
    }
    this._revisionRepository ??= AppDataSource.getRepository(WikiPageRevision);
    return this._revisionRepository;
  }

  // ════════════════════════════════════════════════════════════════
  //  CRUD
  // ════════════════════════════════════════════════════════════════

  /**
   * Create a new wiki page.
   *
   * - Generates a unique slug from the title
   * - Validates nesting depth (max 3 levels)
   * - Creates initial revision (version 1)
   */
  public async createPage(
    organizationId: string,
    userId: string,
    dto: CreateWikiPageRequest
  ): Promise<WikiPage> {
    // Validate nesting depth if a parent is specified
    if (dto.parentPageId) {
      await this.validateNestingDepth(organizationId, dto.parentPageId);
    }

    // Generate slug from title
    const slug = await this.generateUniqueSlug(organizationId, dto.title);

    const page = this.pageRepository.create({
      organizationId,
      title: dto.title,
      slug,
      content: dto.content ?? '',
      parentPageId: dto.parentPageId ?? null,
      sortOrder: 0,
      tags: dto.tags ?? [],
      version: 1,
      isLocked: false,
      createdBy: userId,
      lastEditedBy: userId,
    });

    const saved = await this.pageRepository.save(page);

    // Create initial revision
    await this.createRevision(saved.id, saved.content, userId, 'Initial creation', 1);

    logger.info(`Wiki page created: ${saved.id} (${saved.slug}) in org ${organizationId}`);
    return saved;
  }

  /**
   * Get a single wiki page by ID or slug.
   *
   * Falls back to slug lookup when the identifier is not a UUID.
   */
  public async getPage(organizationId: string, pageIdOrSlug: string): Promise<WikiPage> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pageIdOrSlug
    );

    let page: WikiPage | null;

    if (isUuid) {
      page = await this.pageRepository.findOne({
        where: { id: pageIdOrSlug, organizationId, deletedAt: undefined },
      });
    } else {
      page = await this.pageRepository.findOne({
        where: { slug: pageIdOrSlug, organizationId, deletedAt: undefined },
      });
    }

    // Filter out soft-deleted pages
    if (page?.deletedAt) {
      page = null;
    }

    if (!page) {
      throw new NotFoundError('Wiki page');
    }
    return page;
  }

  /**
   * Update an existing wiki page.
   *
   * - Bumps version
   * - Creates a new revision with previous content
   * - Updates lastEditedBy and updatedAt
   */
  public async updatePage(
    organizationId: string,
    pageId: string,
    userId: string,
    dto: UpdateWikiPageRequest
  ): Promise<WikiPage> {
    const page = await this.getPage(organizationId, pageId);

    if (page.isLocked) {
      throw new ValidationError('This page is locked and cannot be edited');
    }

    // Determine if content has changed (triggers revision)
    const contentChanged = dto.content !== undefined && dto.content !== page.content;
    const titleChanged = dto.title !== undefined && dto.title !== page.title;

    // Save a revision of the PREVIOUS content before applying changes
    if (contentChanged || titleChanged) {
      await this.createRevision(
        page.id,
        page.content,
        userId,
        dto.changeDescription ?? null,
        page.version
      );
      page.version += 1;
    }

    // Apply partial updates
    if (dto.title !== undefined) {
      page.title = dto.title;
      // Re-generate slug if title changed
      page.slug = await this.generateUniqueSlug(organizationId, dto.title, page.id);
    }
    if (dto.content !== undefined) {
      page.content = dto.content;
    }
    if (dto.tags !== undefined) {
      page.tags = dto.tags;
    }
    if (dto.isLocked !== undefined) {
      page.isLocked = dto.isLocked;
    }

    page.lastEditedBy = userId;

    const saved = await this.pageRepository.save(page);
    logger.info(`Wiki page updated: ${saved.id} v${saved.version} in org ${organizationId}`);
    return saved;
  }

  /**
   * Soft-delete a wiki page.
   *
   * Children are orphaned (parentPageId set to null) rather than cascade-deleted
   * to prevent accidental data loss.
   */
  public async deletePage(organizationId: string, pageId: string, userId: string): Promise<void> {
    const page = await this.getPage(organizationId, pageId);

    // Orphan children
    await this.pageRepository
      .createQueryBuilder()
      .update(WikiPage)
      .set({ parentPageId: null })
      .where('parentPageId = :pageId AND organizationId = :organizationId', {
        pageId,
        organizationId,
      })
      .execute();

    // Soft delete
    page.deletedAt = new Date();
    page.deletedBy = userId;
    await this.pageRepository.save(page);

    logger.info(`Wiki page deleted: ${pageId} in org ${organizationId}`);
  }

  /**
   * List all (non-deleted) wiki pages for an organization, flat list.
   */
  public async getAllPages(organizationId: string): Promise<WikiPage[]> {
    return this.pageRepository.find({
      where: { organizationId },
      order: { sortOrder: 'ASC', title: 'ASC' },
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  TREE OPERATIONS
  // ════════════════════════════════════════════════════════════════

  /**
   * Build the hierarchical wiki page tree for an organization.
   *
   * Returns root pages (parentPageId IS NULL) with nested children.
   */
  public async getPageTree(organizationId: string): Promise<WikiTreeNode[]> {
    try {
      const pages = await this.pageRepository.find({
        where: { organizationId },
        order: { sortOrder: 'ASC', title: 'ASC' },
      });

      // Filter out soft-deleted
      const active = pages.filter(p => !p.deletedAt);
      return this.buildTree(active);
    } catch (error: unknown) {
      logger.warn('Failed to load wiki page tree, returning empty tree', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Move a page to a new parent (or root) with a new sort order.
   * Validates nesting depth after the move.
   */
  public async movePage(
    organizationId: string,
    pageId: string,
    dto: MoveWikiPageRequest
  ): Promise<void> {
    const page = await this.getPage(organizationId, pageId);

    // Prevent a page from being its own parent
    if (dto.parentPageId === pageId) {
      throw new ValidationError('A page cannot be its own parent');
    }

    // Validate the new parent exists (if not moving to root)
    if (dto.parentPageId) {
      await this.getPage(organizationId, dto.parentPageId);

      // Prevent circular references: ensure new parent is not a descendant
      const descendants = await this.getDescendantIds(organizationId, pageId);
      if (descendants.includes(dto.parentPageId)) {
        throw new ValidationError('Cannot move a page under one of its own descendants');
      }

      // Validate depth after move
      const parentDepth = await this.getPageDepth(organizationId, dto.parentPageId);
      if (parentDepth + 1 >= MAX_NESTING_DEPTH) {
        throw new ValidationError(`Maximum nesting depth of ${MAX_NESTING_DEPTH} levels exceeded`);
      }
    }

    page.parentPageId = dto.parentPageId;
    page.sortOrder = dto.sortOrder;
    await this.pageRepository.save(page);

    logger.info(`Wiki page moved: ${pageId} → parent ${dto.parentPageId ?? 'root'}`);
  }

  // ════════════════════════════════════════════════════════════════
  //  REVISION HISTORY
  // ════════════════════════════════════════════════════════════════

  /**
   * List all revisions for a page, newest first.
   */
  public async getRevisions(organizationId: string, pageId: string): Promise<WikiPageRevision[]> {
    // Verify page belongs to org
    await this.getPage(organizationId, pageId);

    return this.revisionRepository.find({
      where: { pageId },
      order: { version: 'DESC' },
    });
  }

  /**
   * Get a single revision by ID.
   */
  public async getRevision(
    organizationId: string,
    pageId: string,
    revisionId: string
  ): Promise<WikiPageRevision> {
    await this.getPage(organizationId, pageId);

    const revision = await this.revisionRepository.findOne({
      where: { id: revisionId, pageId },
    });

    if (!revision) {
      throw new NotFoundError('Wiki page revision');
    }
    return revision;
  }

  /**
   * Restore a specific revision: copies its content as the new current version.
   */
  public async restoreRevision(
    organizationId: string,
    pageId: string,
    revisionId: string,
    userId: string
  ): Promise<WikiPage> {
    const revision = await this.getRevision(organizationId, pageId, revisionId);

    return this.updatePage(organizationId, pageId, userId, {
      content: revision.content,
      changeDescription: `Restored from version ${revision.version}`,
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  FULL-TEXT SEARCH (PostgreSQL tsvector)
  // ════════════════════════════════════════════════════════════════

  /**
   * Search wiki pages using PostgreSQL full-text search.
   *
   * Uses the GENERATED tsvector column `search_vector` with GIN index
   * for fast ranked results. Falls back to ILIKE for short queries
   * or when tsvector is unavailable (e.g. SQLite tests).
   */
  public async searchPages(
    organizationId: string,
    query: string,
    limit: number = 20
  ): Promise<WikiSearchResult[]> {
    const sanitized = query.replaceAll(/[^a-zA-Z0-9\s]/g, '').trim();
    if (!sanitized) {
      return [];
    }

    try {
      // PostgreSQL tsvector search with rank
      const tsquery = sanitized.split(/\s+/).join(' & ');

      const results = await this.pageRepository
        .createQueryBuilder('page')
        .select([
          'page.id AS id',
          'page.title AS title',
          'page.slug AS slug',
          `ts_rank(page.search_vector, to_tsquery('english', :tsquery)) AS rank`,
          `ts_headline('english', page.content, to_tsquery('english', :tsquery), 'MaxWords=30, MinWords=15, StartSel=**, StopSel=**') AS snippet`,
          'page.updatedAt AS "updatedAt"',
        ])
        .where('page.organizationId = :organizationId', { organizationId })
        .andWhere('page.deletedAt IS NULL')
        .andWhere(`page.search_vector @@ to_tsquery('english', :tsquery)`, { tsquery })
        .orderBy('rank', 'DESC')
        .setParameter('tsquery', tsquery)
        .limit(limit)
        .getRawMany();

      return results.map(r => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        snippet: r.snippet ?? '',
        rank: Number.parseFloat(r.rank) || 0,
        updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
      }));
    } catch {
      // Fallback: ILIKE for non-PostgreSQL environments (tests with SQLite)
      logger.warn('tsvector search unavailable, falling back to ILIKE');
      return this.searchPagesIlike(organizationId, sanitized, limit);
    }
  }

  // ════════════════════════════════════════════════════════════════
  //  PRIVATE HELPERS
  // ════════════════════════════════════════════════════════════════

  /**
   * Generate a URL-safe slug from a title, ensuring uniqueness per org.
   * Appends a short random suffix if the base slug is taken.
   */
  private async generateUniqueSlug(
    organizationId: string,
    title: string,
    excludePageId?: string
  ): Promise<string> {
    const base = title
      .toLowerCase()
      .replaceAll(/[^a-z0-9]+/g, '-')
      .replaceAll(/^-|-$/g, '')
      .slice(0, 180);

    let slug = base || 'untitled';
    let attempt = 0;

    while (attempt < 10) {
      const query = this.pageRepository
        .createQueryBuilder('page')
        .where('page.organizationId = :organizationId', { organizationId })
        .andWhere('page.slug = :slug', { slug });

      if (excludePageId) {
        query.andWhere('page.id != :excludePageId', { excludePageId });
      }

      const exists = await query.getOne();
      if (!exists) {
        return slug;
      }

      // Append short random suffix
      const suffix = crypto.randomBytes(3).toString('hex');
      slug = `${base}-${suffix}`;
      attempt++;
    }

    // Should never happen, but fail safely
    return `${base}-${crypto.randomUUID().slice(0, 8)}`;
  }

  /**
   * Create a revision record.
   */
  private async createRevision(
    pageId: string,
    content: string,
    editedBy: string,
    changeDescription: string | null,
    version: number
  ): Promise<WikiPageRevision> {
    const revision = this.revisionRepository.create({
      pageId,
      content,
      editedBy,
      changeDescription,
      version,
    });
    return this.revisionRepository.save(revision);
  }

  /**
   * Validate that adding a child to parentId would not exceed MAX_NESTING_DEPTH.
   */
  private async validateNestingDepth(organizationId: string, parentPageId: string): Promise<void> {
    const depth = await this.getPageDepth(organizationId, parentPageId);
    if (depth + 1 >= MAX_NESTING_DEPTH) {
      throw new ValidationError(`Maximum nesting depth of ${MAX_NESTING_DEPTH} levels exceeded`);
    }
  }

  /**
   * Calculate the depth of a page in the tree (0-indexed root).
   */
  private async getPageDepth(organizationId: string, pageId: string): Promise<number> {
    let depth = 0;
    let currentId: string | null = pageId;

    while (currentId) {
      const page = await this.pageRepository.findOne({
        where: { id: currentId, organizationId },
        select: ['id', 'parentPageId'],
      });
      if (!page?.parentPageId) {
        break;
      }
      currentId = page.parentPageId;
      depth++;
      if (depth > MAX_NESTING_DEPTH + 1) {
        break;
      } // safety valve
    }

    return depth;
  }

  /**
   * Get all descendant page IDs for cycle detection during move.
   */
  private async getDescendantIds(organizationId: string, pageId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue: string[] = [pageId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.pageRepository.find({
        where: { parentPageId: currentId, organizationId },
        select: ['id'],
      });
      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  /**
   * Build a tree structure from a flat list of pages.
   */
  private buildTree(pages: WikiPage[]): WikiTreeNode[] {
    const nodeMap = new Map<string, WikiTreeNode>();

    // Create nodes
    for (const page of pages) {
      nodeMap.set(page.id, { ...page, children: [] } as unknown as WikiTreeNode);
    }

    const roots: WikiTreeNode[] = [];

    // Link children to parents
    for (const page of pages) {
      const node = nodeMap.get(page.id)!;
      if (page.parentPageId && nodeMap.has(page.parentPageId)) {
        nodeMap.get(page.parentPageId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  /**
   * Fallback ILIKE search for non-PostgreSQL databases (unit tests).
   */
  private async searchPagesIlike(
    organizationId: string,
    query: string,
    limit: number
  ): Promise<WikiSearchResult[]> {
    const pages = await this.pageRepository
      .createQueryBuilder('page')
      .where('page.organizationId = :organizationId', { organizationId })
      .andWhere('page.deletedAt IS NULL')
      .andWhere('(page.title ILIKE :search OR page.content ILIKE :search)', {
        search: `%${query}%`,
      })
      .orderBy('page.updatedAt', 'DESC')
      .take(limit)
      .getMany();

    return pages.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      snippet: p.content.slice(0, 200),
      rank: 1,
      updatedAt: p.updatedAt instanceof Date ? p.updatedAt.toISOString() : String(p.updatedAt),
    }));
  }
}

