import type { CreateWatchlistEntryDto, ListWatchlistQuery, UpdateWatchlistEntryDto, WatchlistCrossReferenceResult, WatchlistEntrySummary } from '@sc-fleet-manager/shared-types';
export interface PaginatedWatchlist {
    data: WatchlistEntrySummary[];
    total: number;
    page: number;
    pageSize: number;
}
export declare class OrgWatchlistService {
    private readonly repo;
    constructor();
    createEntry(organizationId: string, officerId: string, dto: CreateWatchlistEntryDto): Promise<WatchlistEntrySummary>;
    getEntryById(organizationId: string, entryId: string): Promise<WatchlistEntrySummary | null>;
    listEntries(organizationId: string, query?: ListWatchlistQuery): Promise<PaginatedWatchlist>;
    updateEntry(organizationId: string, entryId: string, dto: UpdateWatchlistEntryDto): Promise<WatchlistEntrySummary>;
    deleteEntry(organizationId: string, entryId: string): Promise<boolean>;
    crossReference(organizationId: string, rsiHandles: string[]): Promise<WatchlistCrossReferenceResult[]>;
    findByHandle(organizationId: string, rsiHandle: string): Promise<WatchlistEntrySummary | null>;
    private toSummary;
}
//# sourceMappingURL=OrgWatchlistService.d.ts.map