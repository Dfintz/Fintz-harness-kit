import Joi from 'joi';

/**
 * Common reusable Joi schemas
 */

// ID validation
export const id = Joi.string().trim().min(1).max(100).required();
export const optionalId = Joi.string().trim().min(1).max(100).optional();

// UUID validation
export const uuid = Joi.string().uuid().required();
export const optionalUuid = Joi.string().uuid().optional();

// Pagination
/**
 * Build page-based pagination fields for spreading into query schemas.
 *
 * Returns the canonical `{ page, limit }` Joi validators with a configurable
 * limit default and maximum, so domain schemas can share one definition
 * instead of re-declaring the identical `page`/`limit` pair. Domain-specific
 * sort fields stay declared alongside the spread.
 *
 * @param limitDefault Default page size when `limit` is omitted (e.g. 10, 20, 25).
 * @param maxLimit Maximum allowed page size (default 100).
 *
 * @example
 *   const pagination = {
 *     ...paginationKeysWith(10),
 *     sortBy: Joi.string().valid('name', 'createdAt').default('createdAt'),
 *     sortOrder: Joi.string().valid('ASC', 'DESC').default('DESC'),
 *   };
 */
export const paginationKeysWith = (limitDefault = 20, maxLimit = 100) => ({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(maxLimit).default(limitDefault),
});

export const pagination = Joi.object(paginationKeysWith());

/**
 * Pagination fields for spreading into query schemas.
 * Use `...paginationKeys` instead of `...pagination.describe().keys`
 * (the latter returns metadata objects, not Joi validators).
 *
 * Equivalent to `paginationKeysWith(20)` — kept as a named export for the
 * common default-20 case; use `paginationKeysWith(n)` for other page sizes.
 */
export const paginationKeys = paginationKeysWith();

/**
 * Build `pageSize`-style pagination fields for spreading into query schemas.
 *
 * Identical in spirit to {@link paginationKeysWith} but emits `{ page, pageSize }`
 * (instead of `{ page, limit }`) for the endpoints that standardized on a
 * `pageSize` query parameter. Keep this distinct from `paginationKeysWith` —
 * the two parameter names are part of each endpoint's public contract and are
 * NOT interchangeable.
 *
 * @param pageSizeDefault Default page size when `pageSize` is omitted (e.g. 20, 25).
 * @param maxPageSize Maximum allowed page size (default 100).
 *
 * @example
 *   listQuery: Joi.object({
 *     ...pageSizeKeysWith(20),
 *     sortBy: Joi.string().valid('createdAt').default('createdAt'),
 *   });
 */
export const pageSizeKeysWith = (pageSizeDefault = 20, maxPageSize = 100) => ({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(maxPageSize).default(pageSizeDefault),
});

// Date range
export const dateRange = Joi.object({
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
});

// Email
export const email = Joi.string().email().trim().lowercase().required();
export const optionalEmail = Joi.string().email().trim().lowercase().optional();

// URL
export const url = Joi.string().uri().trim().required();
export const optionalUrl = Joi.string().uri().trim().optional();

// Common status values
export const statusActive = Joi.string().valid('active', 'inactive').default('active');

// Array of IDs
export const idArray = Joi.array().items(id).min(1).max(100);

// Coordinates
export const coordinates = Joi.object({
  x: Joi.number().required(),
  y: Joi.number().required(),
  z: Joi.number().required(),
});

// Notes/Description fields
export const notes = Joi.string().trim().max(2000).optional().allow(null, '');
export const description = Joi.string().trim().max(1000).optional();

// Application question sub-schema (shared between org + federation settings)
export const applicationQuestionSchema = Joi.object({
  id: Joi.string().uuid().required(),
  label: Joi.string().max(200).required(),
  fieldKey: Joi.string().max(100).optional(),
  type: Joi.string().valid('short', 'paragraph', 'select', 'checkbox', 'rules').required(),
  required: Joi.boolean().required(),
  placeholder: Joi.string().max(200).optional().allow(''),
  options: Joi.array().items(Joi.string().max(100)).max(20).optional(),
  maxLength: Joi.number().integer().min(1).max(5000).optional(),
  order: Joi.number().integer().min(0).required(),
});

// Common parameter schemas
export const paramSchemas = {
  id: Joi.object({ id }),
  uuid: Joi.object({ uuid }),
  squadronId: Joi.object({
    squadronId: id.description('Squadron ID'),
  }),
  userId: Joi.object({
    userId: id.description('User ID'),
  }),
  orgId: Joi.object({
    orgId: id.description('Organization ID'),
  }),
  shipId: Joi.object({
    shipId: id.description('Ship ID'),
  }),
  memberId: Joi.object({
    memberId: id.description('Member ID'),
  }),
  federationId: Joi.object({
    federationId: id.description('Federation ID'),
  }),
  jobId: Joi.object({
    jobId: uuid.required().description('Job listing ID'),
  }),
  applicationId: Joi.object({
    applicationId: uuid.required().description('Application ID'),
  }),
  jobIdAndApplicationId: Joi.object({
    jobId: uuid.required().description('Job listing ID'),
    applicationId: uuid.required().description('Application ID'),
  }),
  /** Accepts a UUID or a URL slug (lowercase alphanumeric + hyphens, max 255) */
  identifier: Joi.object({
    identifier: Joi.string()
      .trim()
      .min(1)
      .max(255)
      .pattern(/^[a-z0-9-]+$/i)
      .required()
      .description('UUID or URL slug'),
  }),
};

// Common query schemas
export const querySchemas = {
  pagination,
  dateRange,
  search: Joi.object({
    query: Joi.string().trim().max(200).optional(),
  }),
};
