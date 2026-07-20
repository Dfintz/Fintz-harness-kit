export type GlobalSearchResultType = 'organization' | 'federation' | 'user';
export interface GlobalSearchResult {
    id: string;
    type: GlobalSearchResultType;
    title: string;
    subtitle?: string;
    avatarUrl?: string;
    url: string;
    metadata?: Record<string, unknown>;
}
export interface GlobalSearchOptions {
    query: string;
    types?: GlobalSearchResultType[];
    limit?: number;
}
export declare class GlobalSearchService {
    private readonly directoryService;
    private readonly federationService;
    private readonly userSearchService;
    search(options: GlobalSearchOptions): Promise<GlobalSearchResult[]>;
    private searchOrganizations;
    private searchFederations;
    private searchUsers;
}
//# sourceMappingURL=GlobalSearchService.d.ts.map