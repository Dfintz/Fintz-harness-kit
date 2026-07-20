import { NextFunction, Request, Response } from 'express';
import { ParsedQueryParams } from '../types/api';
export declare function parseQueryParams(query: Record<string, unknown>): ParsedQueryParams;
export declare function buildHateoasLinks(basePath: string, offset: number, limit: number, total: number, queryParams?: Record<string, string>): {
    self: string;
    first: string;
    prev?: string;
    next?: string;
    last: string;
};
export declare function selectFields<T extends object>(obj: T, fields: string[] | null): Partial<T>;
export declare function selectFieldsFromArray<T extends object>(items: T[], fields: string[] | null): Partial<T>[];
export declare const queryParserMiddleware: (req: Request, _res: Response, next: NextFunction) => void;
export declare function validateSortField(sort: {
    field: string;
    order: 'ASC' | 'DESC';
} | null, allowedFields: string[]): {
    field: string;
    order: 'ASC' | 'DESC';
} | null;
export declare function validateFilters(filters: Record<string, string | string[]>, allowedFields: string[]): Record<string, string | string[]>;
//# sourceMappingURL=queryParser.d.ts.map