import { Briefing, BriefingStatus } from '../models/Briefing';
import { PaginatedResponse } from './pagination';
export declare const mockBriefings: Briefing[];
export declare function paginateMockData<T>(data: T[], page?: number, limit?: number): PaginatedResponse<T>;
export declare function filterMockBriefings(filters?: {
    creatorId?: string;
    missionId?: string;
    status?: BriefingStatus;
    tags?: string[];
}): Briefing[];
//# sourceMappingURL=mockData.d.ts.map