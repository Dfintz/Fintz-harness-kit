/**
 * Event Service
 * Handles event management API calls
 *
 * Created during Sprint 0.5 — raw-axios migration
 */

import { apiClient } from './apiClient';
import { BaseService, unwrapArrayResponse, unwrapResponse } from './baseService';

// ============================================================================
// Types
// ============================================================================

export interface EventData {
  id: string;
  title: string;
  description: string;
  date: string;
  location: string;
  attendees: string[];
  organizationId?: string;
  sharedWithOrgs?: string[];
}

export interface CreateEventInput {
  title: string;
  description: string;
  date: string;
  location: string;
  organizationId?: string;
  duration?: number;
  recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceEndDate?: string;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  date?: string;
  location?: string;
  duration?: number;
  recurrence?: 'none' | 'daily' | 'weekly' | 'biweekly' | 'monthly';
  recurrenceEndDate?: string;
}

// ============================================================================
// Service
// ============================================================================

class EventService extends BaseService {
  protected basePath = '/api/v2/events';

  async getEvents(params?: { startDate?: string; endDate?: string }): Promise<EventData[]> {
    try {
      this.log('getEvents', params);
      const queryParams = new URLSearchParams();
      if (params?.startDate) {
        queryParams.set('startDate', params.startDate);
      }
      if (params?.endDate) {
        queryParams.set('endDate', params.endDate);
      }
      const url = queryParams.toString()
        ? `${this.basePath}?${queryParams.toString()}`
        : this.basePath;
      const response = await apiClient.get<EventData[]>(url);
      return unwrapArrayResponse<EventData>(response);
    } catch (error) {
      this.handleError(error, 'getEvents');
    }
  }

  async createEvent(data: CreateEventInput): Promise<EventData> {
    try {
      this.log('createEvent', data);
      const response = await apiClient.post<EventData>(this.basePath, data);
      return unwrapResponse<EventData>(response);
    } catch (error) {
      this.handleError(error, 'createEvent');
    }
  }

  async updateEvent(eventId: string, data: UpdateEventInput): Promise<EventData> {
    try {
      this.log('updateEvent', { eventId, data });
      const response = await apiClient.put<EventData>(`${this.basePath}/${eventId}`, data);
      return unwrapResponse<EventData>(response);
    } catch (error) {
      this.handleError(error, 'updateEvent');
    }
  }

  async deleteEvent(eventId: string): Promise<void> {
    try {
      this.log('deleteEvent', eventId);
      await apiClient.delete(`${this.basePath}/${eventId}`);
    } catch (error) {
      this.handleError(error, 'deleteEvent');
    }
  }

  async addAttendee(eventId: string, attendeeId: string): Promise<void> {
    try {
      this.log('addAttendee', { eventId, attendeeId });
      await apiClient.post(`${this.basePath}/${eventId}/attendees`, { attendeeId });
    } catch (error) {
      this.handleError(error, 'addAttendee');
    }
  }

  async removeAttendee(eventId: string, attendeeId: string): Promise<void> {
    try {
      this.log('removeAttendee', { eventId, attendeeId });
      await apiClient.delete(`${this.basePath}/${eventId}/attendees`, {
        data: { attendeeId },
      });
    } catch (error) {
      this.handleError(error, 'removeAttendee');
    }
  }

  async shareWithOrg(eventId: string, orgId: string): Promise<void> {
    try {
      this.log('shareWithOrg', { eventId, orgId });
      await apiClient.post(`${this.basePath}/${eventId}/share`, { orgId });
    } catch (error) {
      this.handleError(error, 'shareWithOrg');
    }
  }

  async unshareWithOrg(eventId: string, orgId: string): Promise<void> {
    try {
      this.log('unshareWithOrg', { eventId, orgId });
      await apiClient.delete(`${this.basePath}/${eventId}/share`, {
        data: { orgId },
      });
    } catch (error) {
      this.handleError(error, 'unshareWithOrg');
    }
  }
}

export const eventService = new EventService();
