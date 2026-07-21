/**
 * Shared types for Group Scheduling & Availability (Wave 2.4)
 */

/** A single availability slot for a user within an organization */
export interface AvailabilitySlot {
  id: string;
  userId: string;
  organizationId: string;
  /** 0 = Sunday, 6 = Saturday */
  dayOfWeek: number;
  /** Minutes from midnight, 0–1439 */
  startMinute: number;
  /** Minutes from midnight, 0–1439 */
  endMinute: number;
  isRecurring: boolean;
  effectiveDate?: string | null;
  expiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Payload to set (bulk upsert) availability for the current user */
export interface SetAvailabilityRequest {
  slots: Array<{
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
    isRecurring?: boolean;
    effectiveDate?: string | null;
    expiresAt?: string | null;
  }>;
}

/** Query params for the "find best times" endpoint */
export interface FindBestTimesQuery {
  /** Duration in minutes (e.g. 120 for 2h) */
  durationMinutes: number;
  /** Minimum attendees required */
  minAttendees: number;
}

/** A cell in the 7×24 availability heatmap */
export interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  count: number;
  total: number;
}

/** Group availability heatmap: 7 days × 24 hours */
export interface GroupAvailabilityHeatmap {
  orgId: string;
  totalMembers: number;
  cells: HeatmapCell[];
}

/** A suggested best-time window */
export interface BestTimeWindow {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  availableCount: number;
  /** Day name for display, e.g. "Monday" */
  dayName: string;
  /** Human-readable time range, e.g. "14:00 – 16:00" */
  timeRange: string;
}
