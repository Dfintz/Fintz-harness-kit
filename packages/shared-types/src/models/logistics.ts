/**
 * Logistics status — represents the state of a logistics operation
 */
export enum LogisticsStatus {
  PLANNING = 'planning',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Logistics status type (string literal union)
 * Use this type for function parameters and return types
 */
export type LogisticsStatusType = `${LogisticsStatus}`;

/**
 * Resource item in a logistics operation
 */
export interface ResourceItem {
  resourceType: string;
  quantity: number;
  unitWeight?: number;
  totalWeight?: number;
}
