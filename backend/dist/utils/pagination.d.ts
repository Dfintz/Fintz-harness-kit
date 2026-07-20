import { Request } from 'express';
import { Repository, SelectQueryBuilder } from 'typeorm';
export interface PaginationOptions {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
}
export interface PaginatedResponse<T> {
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNext: boolean;
        hasPrev: boolean;
    };
}
export declare function extractPaginationOptions(req: Request): PaginationOptions;
export declare function parsePaginationQuery(query: Record<string, unknown>, defaults?: {
    page: number;
    limit: number;
}): PaginationOptions;
export declare function safeParseLimit(raw: string | undefined | null, defaultLimit?: number, maxLimit?: number): number;
export declare function paginateRepository<T extends object>(repository: Repository<T>, options: PaginationOptions, whereConditions?: Record<string, unknown>, defaultSortField?: string): Promise<PaginatedResponse<T>>;
export declare function paginateQueryBuilder<T extends object>(queryBuilder: SelectQueryBuilder<T>, options: PaginationOptions): Promise<PaginatedResponse<T>>;
export declare function paginateArray<T>(items: T[], options: PaginationOptions, sortFunction?: (a: T, b: T) => number): PaginatedResponse<T>;
//# sourceMappingURL=pagination.d.ts.map