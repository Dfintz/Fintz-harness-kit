import { Request } from 'express';
import { FindManyOptions, Repository, SelectQueryBuilder } from 'typeorm';

/**
 * Pagination options interface
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Paginated response interface
 */
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

/**
 * Extract pagination options from Express request query parameters
 */
export function extractPaginationOptions(req: Request): PaginationOptions {
  return parsePaginationQuery(req.query);
}

/**
 * Parse a raw query param value to a number.
 * Handles both string values (raw Express) and numbers (after Joi convert: true).
 */
function parseNumericParam(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return Number.parseInt(value, 10);
  }
  return Number.NaN;
}

/**
 * Parse pagination from raw query object (Express ParsedQs).
 * Used by controllers that receive query params directly instead of a Request object.
 * Enforces a maximum limit of 100 to prevent abuse.
 */
export function parsePaginationQuery(
  query: Record<string, unknown>,
  defaults?: { page: number; limit: number }
): PaginationOptions {
  const MAX_LIMIT = 100;
  const defaultPage = defaults?.page ?? 1;
  const defaultLimit = defaults?.limit ?? 20;

  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const rawLimit = Array.isArray(query.limit) ? query.limit[0] : query.limit;

  // Handle both string query params (raw Express) and numbers (after Joi convert: true)
  const parsedPage = parseNumericParam(rawPage);
  const parsedLimit = parseNumericParam(rawLimit);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : defaultPage;
  let limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : defaultLimit;
  if (limit > MAX_LIMIT) {
    limit = MAX_LIMIT;
  }

  const rawSortBy = typeof query.sortBy === 'string' ? query.sortBy : undefined;
  const rawSortOrder = typeof query.sortOrder === 'string' ? query.sortOrder : '';
  const sortOrder = rawSortOrder.toUpperCase() === 'DESC' ? ('DESC' as const) : ('ASC' as const);

  return { page, limit, sortBy: rawSortBy, sortOrder };
}

/**
 * Safely parse a limit value from query params with a max cap.
 * Use this in controllers that parse limit directly instead of using extractPaginationOptions.
 * Prevents ?limit=999999 abuse.
 */
export function safeParseLimit(
  raw: string | undefined | null,
  defaultLimit: number = 20,
  maxLimit: number = 200
): number {
  const parsed = Number.parseInt(raw as string, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return defaultLimit;
  }
  return Math.min(parsed, maxLimit);
}

/**
 * Paginate a TypeORM repository query
 */
export async function paginateRepository<T extends object>(
  repository: Repository<T>,
  options: PaginationOptions,
  whereConditions?: Record<string, unknown>,
  defaultSortField: string = 'createdAt'
): Promise<PaginatedResponse<T>> {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;
  const sortBy = options.sortBy || defaultSortField;
  const sortOrder = options.sortOrder || 'DESC';

  const findOptions: FindManyOptions<T> = {
    skip,
    take: limit,
    order: { [sortBy]: sortOrder } as FindManyOptions<T>['order'],
  };

  if (whereConditions) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findOptions.where = whereConditions as any;
  }

  const [data, total] = await repository.findAndCount(findOptions);

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Paginate a TypeORM QueryBuilder
 * Use this when you need to apply complex filters/joins that require a query builder
 */
export async function paginateQueryBuilder<T extends object>(
  queryBuilder: SelectQueryBuilder<T>,
  options: PaginationOptions
): Promise<PaginatedResponse<T>> {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;

  // Apply pagination to the query builder
  queryBuilder.skip(skip).take(limit);

  // Use getManyAndCount for query builders
  const [data, total] = await queryBuilder.getManyAndCount();

  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

/**
 * Paginate an in-memory array (for services not using repositories)
 */
export function paginateArray<T>(
  items: T[],
  options: PaginationOptions,
  sortFunction?: (a: T, b: T) => number
): PaginatedResponse<T> {
  const page = options.page || 1;
  const limit = options.limit || 10;
  const skip = (page - 1) * limit;

  // Sort if sort function provided
  const sortedItems = [...items];
  if (sortFunction) {
    sortedItems.sort(sortFunction);
  }

  const data = sortedItems.slice(skip, skip + limit);
  const total = items.length;
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
