import { Request } from 'express';
export interface PaginationParams {
    page: number;
    limit: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export declare function parsePaginationParams(query: Request['query']): PaginationParams;
export interface DateRangeFilter {
    startDate?: Date;
    endDate?: Date;
}
export declare function parseDateRangeFilter(query: Request['query']): DateRangeFilter;
export interface StatusFilter<T> {
    status?: T;
    statuses?: T[];
}
export declare function parseStatusFilter<T extends string>(query: Request['query'], validStatuses: readonly T[]): StatusFilter<T>;
export declare function parseSearchTerm(query: Request['query']): string | undefined;
//# sourceMappingURL=controllerHelpers.d.ts.map