/**
 * Route status — represents the state of a trading route
 */
export enum RouteStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DEPRECATED = 'deprecated',
}

/**
 * Route status type (string literal union)
 * Use this type for function parameters and return types
 */
export type RouteStatusType = `${RouteStatus}`;

/**
 * Route visibility — controls who can see the trading route
 */
export enum RouteVisibility {
  PRIVATE = 'private', // Only creator can see
  ORGANIZATION = 'organization', // Organization members can see
  PUBLIC = 'public', // Everyone can see
}

/**
 * Route visibility type (string literal union)
 * Use this type for function parameters and return types
 */
export type RouteVisibilityType = `${RouteVisibility}`;
