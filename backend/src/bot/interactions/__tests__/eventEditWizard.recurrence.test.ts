// Unit tests for the event edit wizard's recurrence handling (INT-08).
//
// INT-08 collapsed the recurrence flow from "button -> pattern select -> a
// broken 'click the icon again to set the end date' step" into a single modal
// (pattern + repeat-until date). normalizeRecurrenceInput is the pure validator
// behind that modal; these tests pin its behaviour plus the custom-id routing.

import {
  isEditWizardButtonId,
  isEditWizardModalId,
  normalizeRecurrenceInput,
} from '../eventEditWizard';

describe('normalizeRecurrenceInput', () => {
  it('defaults an empty pattern to none and clears the end date', () => {
    const result = normalizeRecurrenceInput('', '2026-12-31');
    expect(result).toEqual({ ok: true, pattern: 'none' });
  });

  it('treats none as a cleared end date even when one is typed', () => {
    const result = normalizeRecurrenceInput('none', '2026-12-31');
    expect(result).toEqual({ ok: true, pattern: 'none' });
  });

  it('accepts a recurring pattern case-insensitively with no end date', () => {
    expect(normalizeRecurrenceInput('Weekly', '')).toEqual({ ok: true, pattern: 'weekly' });
    expect(normalizeRecurrenceInput('  DAILY ', '   ')).toEqual({ ok: true, pattern: 'daily' });
  });

  it('parses a UTC date-only end date for a recurring pattern', () => {
    const result = normalizeRecurrenceInput('monthly', '2026-12-31');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pattern).toBe('monthly');
      expect(result.endDate?.toISOString()).toBe('2026-12-31T00:00:00.000Z');
    }
  });

  it('parses a full UTC datetime end date', () => {
    const result = normalizeRecurrenceInput('weekly', '2026-12-31 18:30');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endDate?.toISOString()).toBe('2026-12-31T18:30:00.000Z');
    }
  });

  it('rejects an unknown pattern', () => {
    const result = normalizeRecurrenceInput('fortnightly', '');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/none, daily, weekly, or monthly/);
    }
  });

  it('rejects an invalid end date for a recurring pattern', () => {
    const result = normalizeRecurrenceInput('weekly', 'not-a-date');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Invalid end date/);
    }
  });
});

describe('edit wizard custom-id routing for the recurrence modal', () => {
  it('classifies the recurrence modal id as a modal, not a button', () => {
    expect(isEditWizardModalId('event_edw_modal_recur_abc123')).toBe(true);
    expect(isEditWizardButtonId('event_edw_modal_recur_abc123')).toBe(false);
  });

  it('still classifies the 🔁 trigger as a button', () => {
    expect(isEditWizardButtonId('event_edw_recur_abc123')).toBe(true);
    expect(isEditWizardModalId('event_edw_recur_abc123')).toBe(false);
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
