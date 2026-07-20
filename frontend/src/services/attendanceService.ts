/**
 * Attendance Service
 *
 * Frontend service for the Attendance subsystem. Maps to the backend
 * endpoints for event attendance tracking, history, and leaderboards.
 *
 * Sprint 26 — Bot vs Web Feature Parity
 */

import { apiClient } from './apiClient';
import { BaseService } from './baseService';

// ============================================================================
// Types
// ============================================================================

export type AttendanceStatus =
  | 'attended'
  | 'no_show'
  | 'late'
  | 'early_departure'
  | 'pending_confirmation';

export interface AttendanceStats {
  total: number;
  attended: number;
  noShow: number;
  late: number;
  earlyDeparture: number;
  pending: number;
  attendanceRate: number;
}

export interface UserAttendanceHistory {
  userId: string;
  totalEvents: number;
  attended: number;
  noShows: number;
  late: number;
  excusedAbsences: number;
  reliabilityScore: number;
  averageRating?: number;
}

export interface AttendanceReportAttendee {
  userId: string;
  displayName?: string;
  status: AttendanceStatus;
  score: number;
  checkInTime?: string;
  checkOutTime?: string;
  durationMinutes?: number;
  notes?: string;
}

export interface AttendanceReport {
  activity: {
    id: string;
    title: string;
    startTime?: string;
    endTime?: string;
  };
  stats: AttendanceStats;
  attendees: AttendanceReportAttendee[];
}

export interface LeaderboardEntry extends UserAttendanceHistory {
  displayName?: string;
  rank?: number;
}

// ============================================================================
// Service
// ============================================================================

class AttendanceService extends BaseService {
  protected basePath = '/api';

  async getActivityStats(activityId: string): Promise<AttendanceStats> {
    try {
      this.log('getActivityStats', activityId);
      const response = await apiClient.get<AttendanceStats>(
        `${this.basePath}/activities/${encodeURIComponent(activityId)}/attendance/stats`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getActivityStats');
    }
  }

  async getActivityReport(activityId: string): Promise<AttendanceReport> {
    try {
      this.log('getActivityReport', activityId);
      const response = await apiClient.get<AttendanceReport>(
        `${this.basePath}/activities/${encodeURIComponent(activityId)}/attendance/report`
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getActivityReport');
    }
  }

  async getUserHistory(
    userId: string,
    params?: { monthsBack?: number }
  ): Promise<UserAttendanceHistory> {
    try {
      this.log('getUserHistory', { userId, params });
      const response = await apiClient.get<UserAttendanceHistory>(
        `${this.basePath}/users/${encodeURIComponent(userId)}/attendance/history`,
        { params }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getUserHistory');
    }
  }

  async getLeaderboard(
    organizationId: string,
    params?: { monthsBack?: number; limit?: number }
  ): Promise<LeaderboardEntry[]> {
    try {
      this.log('getLeaderboard', { organizationId, params });
      const response = await apiClient.get<LeaderboardEntry[]>(
        `${this.basePath}/organizations/${encodeURIComponent(organizationId)}/attendance/leaderboard`,
        { params }
      );
      return response.data;
    } catch (error) {
      this.handleError(error, 'getLeaderboard');
    }
  }

  async confirmAttendance(
    activityId: string,
    data: { userId?: string; notes?: string }
  ): Promise<void> {
    try {
      this.log('confirmAttendance', { activityId, data });
      await apiClient.post(
        `${this.basePath}/activities/${encodeURIComponent(activityId)}/attendance/confirm`,
        data
      );
    } catch (error) {
      this.handleError(error, 'confirmAttendance');
    }
  }

  async markNoShow(
    activityId: string,
    data: { userId: string; isExcused?: boolean; reason?: string }
  ): Promise<void> {
    try {
      this.log('markNoShow', { activityId, data });
      await apiClient.post(
        `${this.basePath}/activities/${encodeURIComponent(activityId)}/attendance/no-show`,
        data
      );
    } catch (error) {
      this.handleError(error, 'markNoShow');
    }
  }
}

export const attendanceService = new AttendanceService();
