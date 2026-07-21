/**
 * Common Service Options Types
 * 
 * Reusable options types for service methods
 * Use these instead of 'any' for type-safe service calls
 */

/**
 * Base service options
 */
export interface BaseServiceOptions {
  /**
   * Skip validation checks
   */
  skipValidation?: boolean;
  
  /**
   * Skip notifications
   */
  skipNotifications?: boolean;
  
  /**
   * User ID performing the action (for audit logs)
   */
  userId?: string;
}

/**
 * Find/query options
 */
export interface FindOptions extends BaseServiceOptions {
  /**
   * Include soft-deleted entities
   */
  includeDeleted?: boolean;
  
  /**
   * Relations to load eagerly
   */
  relations?: string[];
  
  /**
   * Select specific fields only
   */
  select?: string[];
  
  /**
   * Lock mode for transaction
   */
  lock?:
    | { mode: 'optimistic'; version: number | Date }
    | { mode: 'pessimistic_read' | 'pessimistic_write' };
}

/**
 * Create options
 */
export interface CreateOptions extends BaseServiceOptions {
  /**
   * Return created entity with relations
   */
  includeRelations?: boolean;
}

/**
 * Update options
 */
export interface UpdateOptions extends BaseServiceOptions {
  /**
   * Allow partial updates
   */
  partial?: boolean;
  
  /**
   * Merge with existing data instead of replace
   */
  merge?: boolean;
}

/**
 * Delete options
 */
export interface DeleteOptions extends BaseServiceOptions {
  /**
   * Hard delete (permanent) vs soft delete
   */
  hardDelete?: boolean;
  
  /**
   * Cascade delete related entities
   */
  cascade?: boolean;
}

/**
 * Bulk operation options
 */
export interface BulkOperationOptions extends BaseServiceOptions {
  /**
   * Continue on error instead of rollback
   */
  continueOnError?: boolean;
  
  /**
   * Batch size for bulk operations
   */
  batchSize?: number;
}

/**
 * Transaction options
 */
export interface TransactionOptions {
  /**
   * Isolation level for transaction
   */
  isolationLevel?:
    | 'READ UNCOMMITTED'
    | 'READ COMMITTED'
    | 'REPEATABLE READ'
    | 'SERIALIZABLE';
}

/**
 * Cache options
 */
export interface CacheOptions {
  /**
   * Time to live in seconds
   */
  ttl?: number;
  
  /**
   * Skip cache and fetch fresh data
   */
  skipCache?: boolean;
  
  /**
   * Invalidate cache after operation
   */
  invalidateCache?: boolean;
}

/**
 * Export options
 */
export interface ExportOptions extends BaseServiceOptions {
  /**
   * Export format
   */
  format?: 'json' | 'csv' | 'xlsx';
  
  /**
   * Include archived data
   */
  includeArchived?: boolean;
  
  /**
   * Fields to include in export
   */
  fields?: string[];
}
