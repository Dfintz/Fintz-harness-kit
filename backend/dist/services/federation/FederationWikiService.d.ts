import type { CreateWikiPageRequest, UpdateWikiPageRequest, WikiTreeNode } from '@sc-fleet-manager/shared-types';
import { WikiPage } from '../../models/WikiPage';
export type FederationWikiVisibility = 'public' | 'members' | 'council';
export declare class FederationWikiService {
    private static instance;
    private readonly pageRepository;
    private readonly revisionRepository;
    private readonly ambassadorService;
    constructor();
    static getInstance(): FederationWikiService;
    private requireWikiPermission;
    private requireViewAccess;
    private generateSlug;
    private generateUniqueSlug;
    private validateNestingDepth;
    createPage(federationId: string, userId: string, dto: CreateWikiPageRequest & {
        visibility?: FederationWikiVisibility;
    }): Promise<WikiPage>;
    getPage(federationId: string, userId: string, pageIdOrSlug: string): Promise<WikiPage>;
    updatePage(federationId: string, userId: string, pageId: string, dto: UpdateWikiPageRequest & {
        visibility?: FederationWikiVisibility;
    }): Promise<WikiPage>;
    deletePage(federationId: string, userId: string, pageId: string): Promise<void>;
    listPages(federationId: string, userId: string): Promise<WikiPage[]>;
    getPageTree(federationId: string, userId: string): Promise<WikiTreeNode[]>;
    private buildTree;
    private getDescendantIds;
}
//# sourceMappingURL=FederationWikiService.d.ts.map