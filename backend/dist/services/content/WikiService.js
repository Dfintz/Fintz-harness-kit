"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WikiService = void 0;
const crypto = __importStar(require("node:crypto"));
const data_source_1 = require("../../data-source");
const WikiPage_1 = require("../../models/WikiPage");
const WikiPageRevision_1 = require("../../models/WikiPageRevision");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const MAX_NESTING_DEPTH = 3;
class WikiService {
    _pageRepository;
    _revisionRepository;
    get pageRepository() {
        if (!data_source_1.AppDataSource.isInitialized) {
            throw new apiErrors_1.ServiceUnavailableError('Database not initialized - call initializeDatabase() before using WikiService');
        }
        this._pageRepository ??= data_source_1.AppDataSource.getRepository(WikiPage_1.WikiPage);
        return this._pageRepository;
    }
    get revisionRepository() {
        if (!data_source_1.AppDataSource.isInitialized) {
            throw new apiErrors_1.ServiceUnavailableError('Database not initialized - call initializeDatabase() before using WikiService');
        }
        this._revisionRepository ??= data_source_1.AppDataSource.getRepository(WikiPageRevision_1.WikiPageRevision);
        return this._revisionRepository;
    }
    async createPage(organizationId, userId, dto) {
        if (dto.parentPageId) {
            await this.validateNestingDepth(organizationId, dto.parentPageId);
        }
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
        await this.createRevision(saved.id, saved.content, userId, 'Initial creation', 1);
        logger_1.logger.info(`Wiki page created: ${saved.id} (${saved.slug}) in org ${organizationId}`);
        return saved;
    }
    async getPage(organizationId, pageIdOrSlug) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageIdOrSlug);
        let page;
        if (isUuid) {
            page = await this.pageRepository.findOne({
                where: { id: pageIdOrSlug, organizationId, deletedAt: undefined },
            });
        }
        else {
            page = await this.pageRepository.findOne({
                where: { slug: pageIdOrSlug, organizationId, deletedAt: undefined },
            });
        }
        if (page?.deletedAt) {
            page = null;
        }
        if (!page) {
            throw new apiErrors_1.NotFoundError('Wiki page');
        }
        return page;
    }
    async updatePage(organizationId, pageId, userId, dto) {
        const page = await this.getPage(organizationId, pageId);
        if (page.isLocked) {
            throw new apiErrors_1.ValidationError('This page is locked and cannot be edited');
        }
        const contentChanged = dto.content !== undefined && dto.content !== page.content;
        const titleChanged = dto.title !== undefined && dto.title !== page.title;
        if (contentChanged || titleChanged) {
            await this.createRevision(page.id, page.content, userId, dto.changeDescription ?? null, page.version);
            page.version += 1;
        }
        if (dto.title !== undefined) {
            page.title = dto.title;
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
        logger_1.logger.info(`Wiki page updated: ${saved.id} v${saved.version} in org ${organizationId}`);
        return saved;
    }
    async deletePage(organizationId, pageId, userId) {
        const page = await this.getPage(organizationId, pageId);
        await this.pageRepository
            .createQueryBuilder()
            .update(WikiPage_1.WikiPage)
            .set({ parentPageId: null })
            .where('parentPageId = :pageId AND organizationId = :organizationId', {
            pageId,
            organizationId,
        })
            .execute();
        page.deletedAt = new Date();
        page.deletedBy = userId;
        await this.pageRepository.save(page);
        logger_1.logger.info(`Wiki page deleted: ${pageId} in org ${organizationId}`);
    }
    async getAllPages(organizationId) {
        return this.pageRepository.find({
            where: { organizationId },
            order: { sortOrder: 'ASC', title: 'ASC' },
        });
    }
    async getPageTree(organizationId) {
        try {
            const pages = await this.pageRepository.find({
                where: { organizationId },
                order: { sortOrder: 'ASC', title: 'ASC' },
            });
            const active = pages.filter(p => !p.deletedAt);
            return this.buildTree(active);
        }
        catch (error) {
            logger_1.logger.warn('Failed to load wiki page tree, returning empty tree', {
                organizationId,
                error: error instanceof Error ? error.message : String(error),
            });
            return [];
        }
    }
    async movePage(organizationId, pageId, dto) {
        const page = await this.getPage(organizationId, pageId);
        if (dto.parentPageId === pageId) {
            throw new apiErrors_1.ValidationError('A page cannot be its own parent');
        }
        if (dto.parentPageId) {
            await this.getPage(organizationId, dto.parentPageId);
            const descendants = await this.getDescendantIds(organizationId, pageId);
            if (descendants.includes(dto.parentPageId)) {
                throw new apiErrors_1.ValidationError('Cannot move a page under one of its own descendants');
            }
            const parentDepth = await this.getPageDepth(organizationId, dto.parentPageId);
            if (parentDepth + 1 >= MAX_NESTING_DEPTH) {
                throw new apiErrors_1.ValidationError(`Maximum nesting depth of ${MAX_NESTING_DEPTH} levels exceeded`);
            }
        }
        page.parentPageId = dto.parentPageId;
        page.sortOrder = dto.sortOrder;
        await this.pageRepository.save(page);
        logger_1.logger.info(`Wiki page moved: ${pageId} → parent ${dto.parentPageId ?? 'root'}`);
    }
    async getRevisions(organizationId, pageId) {
        await this.getPage(organizationId, pageId);
        return this.revisionRepository.find({
            where: { pageId },
            order: { version: 'DESC' },
        });
    }
    async getRevision(organizationId, pageId, revisionId) {
        await this.getPage(organizationId, pageId);
        const revision = await this.revisionRepository.findOne({
            where: { id: revisionId, pageId },
        });
        if (!revision) {
            throw new apiErrors_1.NotFoundError('Wiki page revision');
        }
        return revision;
    }
    async restoreRevision(organizationId, pageId, revisionId, userId) {
        const revision = await this.getRevision(organizationId, pageId, revisionId);
        return this.updatePage(organizationId, pageId, userId, {
            content: revision.content,
            changeDescription: `Restored from version ${revision.version}`,
        });
    }
    async searchPages(organizationId, query, limit = 20) {
        const sanitized = query.replaceAll(/[^a-zA-Z0-9\s]/g, '').trim();
        if (!sanitized) {
            return [];
        }
        try {
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
        }
        catch {
            logger_1.logger.warn('tsvector search unavailable, falling back to ILIKE');
            return this.searchPagesIlike(organizationId, sanitized, limit);
        }
    }
    async generateUniqueSlug(organizationId, title, excludePageId) {
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
            const suffix = crypto.randomBytes(3).toString('hex');
            slug = `${base}-${suffix}`;
            attempt++;
        }
        return `${base}-${crypto.randomUUID().slice(0, 8)}`;
    }
    async createRevision(pageId, content, editedBy, changeDescription, version) {
        const revision = this.revisionRepository.create({
            pageId,
            content,
            editedBy,
            changeDescription,
            version,
        });
        return this.revisionRepository.save(revision);
    }
    async validateNestingDepth(organizationId, parentPageId) {
        const depth = await this.getPageDepth(organizationId, parentPageId);
        if (depth + 1 >= MAX_NESTING_DEPTH) {
            throw new apiErrors_1.ValidationError(`Maximum nesting depth of ${MAX_NESTING_DEPTH} levels exceeded`);
        }
    }
    async getPageDepth(organizationId, pageId) {
        let depth = 0;
        let currentId = pageId;
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
            }
        }
        return depth;
    }
    async getDescendantIds(organizationId, pageId) {
        const descendants = [];
        const queue = [pageId];
        while (queue.length > 0) {
            const currentId = queue.shift();
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
    buildTree(pages) {
        const nodeMap = new Map();
        for (const page of pages) {
            nodeMap.set(page.id, { ...page, children: [] });
        }
        const roots = [];
        for (const page of pages) {
            const node = nodeMap.get(page.id);
            if (page.parentPageId && nodeMap.has(page.parentPageId)) {
                nodeMap.get(page.parentPageId).children.push(node);
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
    async searchPagesIlike(organizationId, query, limit) {
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
exports.WikiService = WikiService;
//# sourceMappingURL=WikiService.js.map