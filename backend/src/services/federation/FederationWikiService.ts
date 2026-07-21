import type {
  CreateWikiPageRequest,
  UpdateWikiPageRequest,
  WikiTreeNode,
} from '@sc-fleet-manager/shared-types';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { WikiPage } from '../../models/WikiPage';
import { WikiPageRevision } from '../../models/WikiPageRevision';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';

import { FederationAmbassadorService } from './FederationAmbassadorService';
import { requireFederationPermission, requireFederationViewAccess } from './federationPermissions';

/** Visibility levels for federation wiki pages */
export type FederationWikiVisibility = 'public' | 'members' | 'council';

/** Maximum nesting depth for federation wiki pages */
const MAX_NESTING_DEPTH = 3;

/**
 * FederationWikiService
 *
 * Wraps the WikiPage entity with federation-scoped access control.
 * Pages belong to a federation (not an org), and ambassadors with
 * the 'wiki' permission can create/edit. Visibility is controlled
 * by the federationVisibility column.
 */
export class FederationWikiService {
  private static instance: FederationWikiService;
  private readonly pageRepository: Repository<WikiPage>;
  private readonly revisionRepository: Repository<WikiPageRevision>;
  private readonly ambassadorService: FederationAmbassadorService;

  constructor() {
    this.pageRepository = AppDataSource.getRepository(WikiPage);
    this.revisionRepository = AppDataSource.getRepository(WikiPageRevision);
    this.ambassadorService = FederationAmbassadorService.getInstance();
  }

  public static getInstance(): FederationWikiService {
    if (!FederationWikiService.instance) {
      FederationWikiService.instance = new FederationWikiService();
    }
    return FederationWikiService.instance;
  }

  // ─── Permission Check ──────────────────────────────────────

  private async requireWikiPermission(federationId: string, userId: string): Promise<void> {
    return requireFederationPermission(
      this.ambassadorService,
      federationId,
      userId,
      'wiki',
      'Ambassador wiki permission required to manage federation wiki pages'
    );
  }

  private async requireViewAccess(federationId: string, userId: string): Promise<void> {
    return requireFederationViewAccess(
      this.ambassadorService,
      federationId,
      userId,
      'federation wiki pages'
    );
  }

  // ─── Slug Generation ───────────────────────────────────────

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replaceAll(/[^a-z0-9\s-]/g, '')
      .replaceAll(/\s+/g, '-')
      .replaceAll(/-+/g, '-')
      .substring(0, 200);
  }

  private async generateUniqueSlug(federationId: string, title: string): Promise<string> {
    let slug = this.generateSlug(title);
    const existing = await this.pageRepository.findOne({
      where: { federationId, slug },
    });
    if (existing) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }
    return slug;
  }

  // ─── Nesting Validation ────────────────────────────────────

  private async validateNestingDepth(federationId: string, parentPageId: string): Promise<void> {
    let depth = 1;
    let currentId: string | null = parentPageId;

    while (currentId) {
      const parent = await this.pageRepository.findOne({
        where: { id: currentId, federationId },
      });
      if (!parent) {
        break;
      }
      currentId = parent.parentPageId;
      depth++;
      if (depth >= MAX_NESTING_DEPTH) {
        throw new ValidationError(`Maximum nesting depth of ${MAX_NESTING_DEPTH} levels exceeded`);
      }
    }
  }

  // ─── CRUD Operations ───────────────────────────────────────

  /**
   * Create a federation wiki page.
   */
  async createPage(
    federationId: string,
    userId: string,
    dto: CreateWikiPageRequest & { visibility?: FederationWikiVisibility }
  ): Promise<WikiPage> {
    await this.requireWikiPermission(federationId, userId);

    if (dto.parentPageId) {
      await this.validateNestingDepth(federationId, dto.parentPageId);
    }

    const slug = await this.generateUniqueSlug(federationId, dto.title);

    const page = this.pageRepository.create({
      // Use federationId as the organizationId for tenant scoping
      organizationId: federationId,
      federationId,
      federationVisibility: dto.visibility ?? 'members',
      title: dto.title,
      slug,
      content: dto.content ?? '',
      parentPageId: dto.parentPageId ?? null,
      tags: dto.tags ?? [],
      version: 1,
      isLocked: false,
      createdBy: userId,
      lastEditedBy: null,
    });

    const saved = await this.pageRepository.save(page);

    // Create initial revision
    await this.revisionRepository.save(
      this.revisionRepository.create({
        pageId: saved.id,
        content: saved.content,
        editedBy: userId,
        changeDescription: 'Initial creation',
        version: 1,
      })
    );

    logger.info('Federation wiki page created', {
      federationId,
      pageId: saved.id,
      slug: saved.slug,
    });

    return saved;
  }

  /**
   * Get a federation wiki page by ID or slug.
   */
  async getPage(federationId: string, userId: string, pageIdOrSlug: string): Promise<WikiPage> {
    await this.requireViewAccess(federationId, userId);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      pageIdOrSlug
    );

    const page = await this.pageRepository.findOne({
      where: isUuid ? { id: pageIdOrSlug, federationId } : { slug: pageIdOrSlug, federationId },
      relations: ['revisions'],
    });

    if (!page) {
      throw new NotFoundError('Wiki page', pageIdOrSlug);
    }

    return page;
  }

  /**
   * Update a federation wiki page.
   */
  async updatePage(
    federationId: string,
    userId: string,
    pageId: string,
    dto: UpdateWikiPageRequest & { visibility?: FederationWikiVisibility }
  ): Promise<WikiPage> {
    await this.requireWikiPermission(federationId, userId);

    const page = await this.pageRepository.findOne({
      where: { id: pageId, federationId },
    });
    if (!page) {
      throw new NotFoundError('Wiki page', pageId);
    }

    if (page.isLocked) {
      throw new ValidationError('This page is locked and cannot be edited');
    }

    // Save revision before updating
    if (dto.content !== undefined && dto.content !== page.content) {
      page.version += 1;
      await this.revisionRepository.save(
        this.revisionRepository.create({
          pageId: page.id,
          content: dto.content,
          editedBy: userId,
          changeDescription: dto.changeDescription ?? null,
          version: page.version,
        })
      );
    }

    if (dto.title !== undefined) {
      page.title = dto.title;
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
    if (dto.visibility !== undefined) {
      page.federationVisibility = dto.visibility;
    }
    page.lastEditedBy = userId;

    const saved = await this.pageRepository.save(page);

    logger.info('Federation wiki page updated', {
      federationId,
      pageId,
      version: saved.version,
    });

    return saved;
  }

  /**
   * Delete a federation wiki page (and its descendants).
   */
  async deletePage(federationId: string, userId: string, pageId: string): Promise<void> {
    await this.requireWikiPermission(federationId, userId);

    const page = await this.pageRepository.findOne({
      where: { id: pageId, federationId },
    });
    if (!page) {
      throw new NotFoundError('Wiki page', pageId);
    }

    // Get all descendant pages
    const descendants = await this.getDescendantIds(federationId, pageId);
    const allIds = [pageId, ...descendants];

    // Delete revisions for all pages in batch, then delete pages
    if (allIds.length > 0) {
      await this.revisionRepository
        .createQueryBuilder()
        .delete()
        .where('pageId IN (:...ids)', { ids: allIds })
        .execute();
    }
    await this.pageRepository.delete(allIds);

    logger.info('Federation wiki page deleted', {
      federationId,
      pageId,
      descendantsDeleted: descendants.length,
    });
  }

  /**
   * Get all federation wiki pages as a flat list.
   */
  async listPages(federationId: string, userId: string): Promise<WikiPage[]> {
    await this.requireViewAccess(federationId, userId);

    return this.pageRepository.find({
      where: { federationId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get the federation wiki page tree.
   */
  async getPageTree(federationId: string, userId: string): Promise<WikiTreeNode[]> {
    await this.requireViewAccess(federationId, userId);

    const pages = await this.pageRepository.find({
      where: { federationId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });

    return this.buildTree(pages);
  }

  // ─── Tree Helpers ──────────────────────────────────────────

  private buildTree(pages: WikiPage[]): WikiTreeNode[] {
    const nodeMap = new Map<string, WikiTreeNode>();
    const roots: WikiTreeNode[] = [];

    for (const page of pages) {
      // WikiPage entity has Date fields; WikiTreeNode shared type has string — cast through unknown
      const node = { ...page, children: [] } as unknown as WikiTreeNode;
      nodeMap.set(page.id, node);
    }

    for (const page of pages) {
      const node = nodeMap.get(page.id);
      if (!node) {
        continue;
      }
      if (page.parentPageId && nodeMap.has(page.parentPageId)) {
        const parentNode = nodeMap.get(page.parentPageId);
        if (parentNode) {
          parentNode.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private async getDescendantIds(federationId: string, pageId: string): Promise<string[]> {
    const children = await this.pageRepository.find({
      where: { parentPageId: pageId, federationId },
      select: ['id'],
    });

    const ids: string[] = [];
    for (const child of children) {
      ids.push(child.id);
      const grandchildren = await this.getDescendantIds(federationId, child.id);
      ids.push(...grandchildren);
    }

    return ids;
  }
}

