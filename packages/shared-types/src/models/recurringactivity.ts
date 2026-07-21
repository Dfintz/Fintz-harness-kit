/**
 * Recurring activity domain types.
 */

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  endDate?: Date | string;
  maxOccurrences?: number;
  exceptions?: (Date | string)[];
}

export interface RecurringActivityTemplate {
  id: string;
  organizationId: string;
  title: string;
  description?: string;
  activityType: string;
  duration: number;
  location?: string;
  recurrenceRule: RecurrenceRule;
  createdBy: string;
  createdByName: string;
  isActive: boolean;
  lastGenerated?: Date | string;
  nextOccurrence?: Date | string;
  parentActivityId?: string;
}

export interface FrequencyOption {
  value: RecurrenceFrequency;
  label: string;
  description: string;
}

export interface DayOfWeekOption {
  value: number;
  label: string;
  short: string;
}

export interface FrequenciesResponse {
  frequencies: FrequencyOption[];
  daysOfWeek: DayOfWeekOption[];
}

export interface RecurrencePreviewRequest {
  rule: RecurrenceRule;
  startTime: string;
  duration?: number;
  count?: number;
  title?: string;
}

export interface RecurrenceOccurrence {
  index: number;
  title: string;
  startTime: string;
  endTime: string;
}

export interface RecurrencePreviewResponse {
  recurrenceDescription: string;
  occurrences: RecurrenceOccurrence[];
  count: number;
  rule: RecurrenceRule;
  duration: number;
}
