import 'express';

import { ApiErrorCode, HateoasLinks, PaginationMeta, ParsedQueryParams, ResponseMeta } from './api';

declare module 'express' {
  export interface Request {
    user?: any; // Minimal augmentation for controllers that expect req.user
    tenantContext?: any; // tenant middleware may attach this
    id?: string; // Request ID for tracking
    queryParams?: ParsedQueryParams; // Parsed query parameters from queryParser middleware
    apiVersion?: 'v1' | 'v2' | 'unknown'; // Set by trackApiVersion middleware
  }

  export interface Response {
    success<T>(data: T, meta?: Partial<ResponseMeta>): this;
    paginated<T>(data: T[], pagination: PaginationMeta, links?: HateoasLinks): this;
    error(code: ApiErrorCode | string, message: string, details?: any, statusCode?: number): this;
  }
}
