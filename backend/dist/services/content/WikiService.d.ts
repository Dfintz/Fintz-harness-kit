import type { CreateWikiPageRequest, MoveWikiPageRequest, UpdateWikiPageRequest, WikiSearchResult, WikiTreeNode } from '@sc-fleet-manager/shared-types';
import { WikiPage } from '../../models/WikiPage';
import { WikiPageRevision } from '../../models/WikiPageRevision';
export declare class WikiService {
    private _pageRepository?;
    private _revisionRepository?;
    private get pageRepository();
    private get revisionRepository();
    createPage(organizationId: string, userId: string, dto: CreateWikiPageRequest): Promise<WikiPage>;
    getPage(organizationId: string, pageIdOrSlug: string): Promise<WikiPage>;
    updatePage(organizationId: string, pageId: string, userId: string, dto: UpdateWikiPageRequest): Promise<WikiPage>;
    deletePage(organizationId: string, pageId: string, userId: string): Promise<void>;
    getAllPages(organizationId: string): Promise<WikiPage[]>;
    getPageTree(organizationId: string): Promise<WikiTreeNode[]>;
    movePage(organizationId: string, pageId: string, dto: MoveWikiPageRequest): Promise<void>;
    getRevisions(organizationId: string, pageId: string): Promise<WikiPageRevision[]>;
    getRevision(organizationId: string, pageId: string, revisionId: string): Promise<WikiPageRevision>;
    restoreRevision(organizationId: string, pageId: string, revisionId: string, userId: string): Promise<WikiPage>;
    searchPages(organizationId: string, query: string, limit?: number): Promise<WikiSearchResult[]>;
    private generateUniqueSlug;
    private createRevision;
    private validateNestingDepth;
    private getPageDepth;
    private getDescendantIds;
    private buildTree;
    private searchPagesIlike;
}
//# sourceMappingURL=WikiService.d.ts.map