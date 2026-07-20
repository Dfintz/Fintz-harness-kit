import { ApiErrorCode } from '@sc-fleet-manager/shared-types';
export interface ApiResponse<T> {
    success: true;
    data: T;
    meta?: ResponseMeta;
    links?: HateoasLinks;
}
export interface ApiError {
    success: false;
    error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
        timestamp: string;
        requestId?: string;
    };
}
export interface ResponseMeta {
    timestamp: string;
    requestId?: string;
    pagination?: PaginationMeta;
}
export interface PaginatedResponseMeta extends Omit<ResponseMeta, 'pagination'> {
    timestamp: string;
    requestId?: string;
    pagination: PaginationMeta;
}
export interface PaginationMeta {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
    page?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
}
export interface HateoasLinks {
    self: string;
    first?: string;
    prev?: string;
    next?: string;
    last?: string;
}
export interface PaginatedResponse<T> extends ApiResponse<T[]> {
    meta: PaginatedResponseMeta;
    links: HateoasLinks;
}
export { ApiErrorCode } from '@sc-fleet-manager/shared-types';
export interface StandardQueryParams {
    limit?: number;
    offset?: number;
    page?: number;
    sort?: string;
    filter?: Record<string, string | string[]>;
    fields?: string[];
    search?: string;
}
export interface ParsedQueryParams {
    limit: number;
    offset: number;
    sort: {
        field: string;
        order: 'ASC' | 'DESC';
    } | null;
    filters: Record<string, string | string[]>;
    fields: string[] | null;
    search: string | null;
}
export declare const DEFAULT_QUERY_PARAMS: ParsedQueryParams;
export interface PaginatedListOptions {
    basePath: string;
    queryParams?: Record<string, string>;
}
declare global {
    namespace Express {
        interface Request {
            id?: string;
            startTime?: number;
            queryParams?: ParsedQueryParams;
            apiVersion?: 'v1' | 'v2' | 'unknown';
        }
        interface Response {
            success<T>(data: T, meta?: Partial<ResponseMeta>): void;
            paginated<T>(data: T[], pagination: PaginationMeta, links?: HateoasLinks): void;
            error(code: ApiErrorCode, message: string, details?: Record<string, unknown>, statusCode?: number): void;
        }
    }
}
//# sourceMappingURL=api.d.ts.map