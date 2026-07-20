import { RsiCrawledMember } from '../../models/RsiCrawledMember';
import { RsiCrawledOrganization } from '../../models/RsiCrawledOrganization';
export declare class RsiCrawlerDataService {
    private orgRepository;
    private memberRepository;
    private changeRepository;
    private readonly memberBatchSize;
    private isDegradedCrawlerFailure;
    private detectFieldChange;
    private saveChanges;
    private chunkItems;
    private toMemberUpsertRow;
    private toChangeInsertRow;
    fetchAndStoreOrganization(sid: string, force?: boolean): Promise<RsiCrawledOrganization>;
    fetchAndStoreMembers(sid: string, force?: boolean): Promise<RsiCrawledMember[]>;
    getOrganization(sid: string): Promise<RsiCrawledOrganization | null>;
    getMembers(sid: string, limit?: number, offset?: number): Promise<{
        members: RsiCrawledMember[];
        total: number;
    }>;
    getUserMemberships(handle: string): Promise<RsiCrawledMember[]>;
    listOrganizations(limit?: number, offset?: number): Promise<{
        organizations: RsiCrawledOrganization[];
        total: number;
    }>;
    deleteOrganization(sid: string): Promise<void>;
    getStatistics(): Promise<{
        totalOrgs: number;
        totalMembers: number;
        recentlyCrawledOrgs: number;
        failedOrgs: number;
    }>;
    getMemberCountHistory(sid: string): Promise<{
        date: string;
        memberCount: number;
    }[]>;
}
export declare const rsiCrawlerDataService: RsiCrawlerDataService;
//# sourceMappingURL=RsiCrawlerDataService.d.ts.map