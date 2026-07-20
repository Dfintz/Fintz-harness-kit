import type {
  FrequenciesResponse,
  RecurrencePreviewRequest,
  RecurrencePreviewResponse,
  RecurrenceRule,
} from '@sc-fleet-manager/shared-types';
import { apiClient } from './apiClient';
import { BaseService } from './baseService';

class RecurringActivityService extends BaseService {
  protected basePath = '/api/v2/recurring-activities';

  /** Fetch available frequencies and day-of-week metadata */
  async getFrequencies(): Promise<FrequenciesResponse> {
    try {
      this.log('getFrequencies');
      const response = await apiClient.get<FrequenciesResponse>(`${this.basePath}/frequencies`);
      return response.data;
    } catch (error) {
      return this.handleError(error, 'getFrequencies');
    }
  }

  /** Preview upcoming occurrences for a recurrence rule */
  async preview(payload: RecurrencePreviewRequest): Promise<RecurrencePreviewResponse> {
    try {
      this.log('preview', payload);
      const response = await apiClient.post<RecurrencePreviewResponse>(
        `${this.basePath}/preview`,
        payload
      );
      return response.data;
    } catch (error) {
      return this.handleError(error, 'preview');
    }
  }

  /** Format a recurrence rule into a human-readable string */
  async formatRule(rule: RecurrenceRule): Promise<string> {
    try {
      this.log('formatRule', rule);
      const response = await apiClient.post<{ description: string }>(`${this.basePath}/format`, {
        rule,
      });
      return response.data.description;
    } catch (error) {
      return this.handleError(error, 'formatRule');
    }
  }
}

export const recurringActivityService = new RecurringActivityService();
