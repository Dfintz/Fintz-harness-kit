/**
 * API v2 Type Definitions for Mobile
 * Standard response formats matching backend API v2 endpoints.
 */

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta: {
    timestamp: string;
    requestId: string;
    [key: string]: unknown;
  };
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
    details?: Record<string, unknown>;
  };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: {
    timestamp: string;
    requestId: string;
    pagination: PaginationMeta;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface FleetListParams extends PaginationParams {
  search?: string;
}

export interface ActivityListParams extends PaginationParams {
  status?: string;
  type?: string;
  search?: string;
}

// Fleet types used by services
export interface FleetV2 {
  id: string;
  name: string;
  description?: string;
  type?: string;
  organizationId: string;
  memberCount?: number;
  shipCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FleetStatistics {
  totalFleets: number;
  totalShips: number;
  totalMembers: number;
  totalValue?: number;
  fleetsByType?: Record<string, number>;
}

export interface FleetComposition {
  fleetId: string;
  totalShips: number;
  byRole: Record<string, number>;
  byManufacturer: Record<string, number>;
  bySize: Record<string, number>;
}

export interface FleetHealth {
  fleetId: string;
  overallScore: number;
  crewCoverage: number;
  roleBalance: number;
  readiness: number;
}

// Ship types
export interface ShipV2 {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  role: string;
  size: string;
  customName?: string;
  status?: string;
  condition?: string;
  ownerId?: string;
  organizationId?: string;
  createdAt?: string;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  memberCount?: number;
  shipCount?: number;
  rsiSpectrumId?: string;
  createdAt?: string;
}

export interface OrganizationStatistics {
  totalMembers: number;
  totalShips: number;
  totalFleets: number;
  totalActivities: number;
  activeMembers?: number;
}

export interface OrganizationDashboard {
  overview: OrganizationOverview;
  statistics: OrganizationStatistics;
}

export interface OrganizationOverview {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  shipCount: number;
  fleetCount: number;
}

export interface OrganizationInsights {
  recommendations: { type: string; message: string; priority: string }[];
}

export interface FeedItem {
  id: string;
  type: string;
  message: string;
  userId?: string;
  username?: string;
  timestamp: string;
}

// Notification types
export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  timestamp?: number;
  data?: Record<string, unknown>;
}
