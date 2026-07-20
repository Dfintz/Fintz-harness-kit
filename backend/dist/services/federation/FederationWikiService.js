"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationWikiService = void 0;
const data_source_1 = require("../../data-source");
const WikiPage_1 = require("../../models/WikiPage");
const WikiPageRevision_1 = require("../../models/WikiPageRevision");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const FederationAmbassadorService_1 = require("./FederationAmbassadorService");
const federationPermissions_1 = require("./federationPermissions");
const MAX_NESTING_DEPTH = 3;
class FederationWikiService {
    static instance;
    pageRepository;
    revisionRepository;
    ambassadorService;
    constructor() {
        this.pageRepository = data_source_1.AppDataSource.getRepository(WikiPage_1.WikiPage);
        this.revisionRepository = data_source_1.AppDataSource.getRepository(WikiPageRevision_1.WikiPageRevision);
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
    }
    static getInstance() {
        if (!FederationWikiService.instance) {
            FederationWikiService.instance = new FederationWikiService();
        }
        return FederationWikiService.instance;
    }
    async requireWikiPermission(federationId, userId) {
        return (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, federationId, userId, 'wiki', 'Ambassador wiki permission required to manage federation wiki pages');
    }
    async requireViewAccess(federationId, userId) {
        return (0, federationPermissions_1.requireFederationViewAccess)(this.ambassadorService, federationId, userId, 'federation wiki pages');
    }
    generateSlug(title) {
        return title
            .toLowerCase()
            .replaceAll(/[^a-z0-9\s-]/g, '')
            .replaceAll(/\s+/g, '-')
            .replaceAll(/-+/g, '-')
            .substring(0, 200);
    }
    async generateUniqueSlug(federationId, title) {
        let slug = this.generateSlug(title);
        const existing = await this.pageRepository.findOne({
            where: { federationId, slug },
        });
        if (existing) {
            slug = `${slug}-${Date.now().toString(36)}`;
        }
        return slug;
    }
    async validateNestingDepth(federationId, parentPageId) {
        let depth = 1;
        let currentId = parentPageId;
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
                throw new apiErrors_1.ValidationError(`Maximum nesting depth of ${MAX_NESTING_DEPTH} levels exceeded`);
            }
        }
    }
    async createPage(federationId, userId, dto) {
        await this.requireWikiPermission(federationId, userId);
        if (dto.parentPageId) {
            await this.validateNestingDepth(federationId, dto.parentPageId);
        }
        const slug = await this.generateUniqueSlug(federationId, dto.title);
        const page = this.pageRepository.create({
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
        await this.revisionRepository.save(this.revisionRepository.create({
            pageId: saved.id,
            content: saved.content,
            editedBy: userId,
            changeDescription: 'Initial creation',
            version: 1,
        }));
        logger_1.logger.info('Federation wiki page created', {
            federationId,
            pageId: saved.id,
            slug: saved.slug,
        });
        return saved;
    }
    async getPage(federationId, userId, pageIdOrSlug) {
        await this.requireViewAccess(federationId, userId);
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pageIdOrSlug);
        const page = await this.pageRepository.findOne({
            where: isUuid ? { id: pageIdOrSlug, federationId } : { slug: pageIdOrSlug, federationId },
            relations: ['revisions'],
        });
        if (!page) {
            throw new apiErrors_1.NotFoundError('Wiki page', pageIdOrSlug);
        }
        return page;
    }
    async updatePage(federationId, userId, pageId, dto) {
        await this.requireWikiPermission(federationId, userId);
        const page = await this.pageRepository.findOne({
            where: { id: pageId, federationId },
        });
        if (!page) {
            throw new apiErrors_1.NotFoundError('Wiki page', pageId);
        }
        if (page.isLocked) {
            throw new apiErrors_1.ValidationError('This page is locked and cannot be edited');
        }
        if (dto.content !== undefined && dto.content !== page.content) {
            page.version += 1;
            await this.revisionRepository.save(this.revisionRepository.create({
                pageId: page.id,
                content: dto.content,
                editedBy: userId,
                changeDescription: dto.changeDescription ?? null,
                version: page.version,
            }));
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
        logger_1.logger.info('Federation wiki page updated', {
            federationId,
            pageId,
            version: saved.version,
        });
        return saved;
    }
    async deletePage(federationId, userId, pageId) {
        await this.requireWikiPermission(federationId, userId);
        const page = await this.pageRepository.findOne({
            where: { id: pageId, federationId },
        });
        if (!page) {
            throw new apiErrors_1.NotFoundError('Wiki page', pageId);
        }
        const descendants = await this.getDescendantIds(federationId, pageId);
        const allIds = [pageId, ...descendants];
        if (allIds.length > 0) {
            await this.revisionRepository
                .createQueryBuilder()
                .delete()
                .where('pageId IN (:...ids)', { ids: allIds })
                .execute();
        }
        await this.pageRepository.delete(allIds);
        logger_1.logger.info('Federation wiki page deleted', {
            federationId,
            pageId,
            descendantsDeleted: descendants.length,
        });
    }
    async listPages(federationId, userId) {
        await this.requireViewAccess(federationId, userId);
        return this.pageRepository.find({
            where: { federationId },
            order: { sortOrder: 'ASC', createdAt: 'ASC' },
        });
    }
    async getPageTree(federationId, userId) {
        await this.requireViewAccess(federationId, userId);
        const pages = await this.pageRepository.find({
            where: { federationId },
            order: { sortOrder: 'ASC', createdAt: 'ASC' },
        });
        return this.buildTree(pages);
    }
    buildTree(pages) {
        const nodeMap = new Map();
        const roots = [];
        for (const page of pages) {
            const node = { ...page, children: [] };
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
            }
            else {
                roots.push(node);
            }
        }
        return roots;
    }
    async getDescendantIds(federationId, pageId) {
        const children = await this.pageRepository.find({
            where: { parentPageId: pageId, federationId },
            select: ['id'],
        });
        const ids = [];
        for (const child of children) {
            ids.push(child.id);
            const grandchildren = await this.getDescendantIds(federationId, child.id);
            ids.push(...grandchildren);
        }
        return ids;
    }
}
exports.FederationWikiService = FederationWikiService;
//# sourceMappingURL=FederationWikiService.js.map