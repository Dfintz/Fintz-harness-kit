import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';

import {
  buildDynamicRecruitmentApplyPayload,
  buildLegacyRecruitmentApplyPayload,
} from '../utils/recruitmentApplyPayload';
import { recruitmentSchemas } from '../../schemas/recruitmentSchemas';

function createQuestion(
  id: string,
  label: string,
  type: ApplicationQuestion['type'] = 'paragraph',
  overrides: Partial<ApplicationQuestion> = {}
): ApplicationQuestion {
  return {
    id,
    label,
    type,
    required: true,
    order: 0,
    ...overrides,
  };
}

describe('recruitmentApplyPayload', () => {
  it('builds dynamic payload with canonical answers and array fields accepted by apply schema', () => {
    const questions: ApplicationQuestion[] = [
      createQuestion('q-rsi', 'RSI Handle', 'short'),
      createQuestion('q-tz', 'Timezone', 'short'),
      createQuestion('q-exp', 'Experience', 'paragraph'),
      createQuestion('q-avail', 'Available Playtimes', 'paragraph'),
      createQuestion('q-why', 'Why do you want to join?', 'paragraph'),
    ];

    const payload = buildDynamicRecruitmentApplyPayload({
      questions,
      answersByQuestionId: {
        'q-rsi': 'PilotAce',
        'q-tz': 'UTC+1',
        'q-exp': '3 years running cargo and security missions.',
        'q-avail': 'Weekday evenings',
        'q-why': 'I want to fly with an organized crew.',
      },
      selectedPreferredRole: 'Escort Pilot',
      discordUserId: 'discord-123',
      discordUsername: 'pilot',
    });

    expect(payload.answers).toEqual([
      { questionId: 'q-rsi', question: 'RSI Handle', answer: 'PilotAce' },
      { questionId: 'q-tz', question: 'Timezone', answer: 'UTC+1' },
      {
        questionId: 'q-exp',
        question: 'Experience',
        answer: '3 years running cargo and security missions.',
      },
      {
        questionId: 'q-avail',
        question: 'Available Playtimes',
        answer: 'Weekday evenings',
      },
      {
        questionId: 'q-why',
        question: 'Why do you want to join?',
        answer: 'I want to fly with an organized crew.',
      },
    ]);
    expect(payload.availablePlaytimes).toEqual(['Weekday evenings']);
    expect(payload.preferredRoles).toEqual(['Escort Pilot']);
    expect(payload).not.toHaveProperty('preferredRole');

    const validation = recruitmentSchemas.apply.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    expect(validation.error).toBeUndefined();
  });

  it('builds legacy modal payload with canonical message and array fields accepted by apply schema', () => {
    const payload = buildLegacyRecruitmentApplyPayload({
      rsiHandle: 'PilotAce',
      timezone: 'UTC',
      experience: 'Experienced hauler and medic.',
      availability: 'Weekends',
      motivation: 'I want to help new players learn logistics.',
      selectedPreferredRole: 'Logistics',
      discordUserId: 'discord-123',
      discordUsername: 'pilot',
    });

    expect(payload.message).toBe('I want to help new players learn logistics.');
    expect(payload.availablePlaytimes).toEqual(['Weekends']);
    expect(payload.preferredRoles).toEqual(['Logistics']);
    expect(payload).not.toHaveProperty('availability');
    expect(payload).not.toHaveProperty('motivation');
    expect(payload).not.toHaveProperty('preferredRole');

    const validation = recruitmentSchemas.apply.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    expect(validation.error).toBeUndefined();
  });

  it('prefers stable fieldKey mappings over mutable labels for canonical dynamic fields', () => {
    const questions: ApplicationQuestion[] = [
      createQuestion('q-rsi', 'Pilot Alias', 'short', { fieldKey: 'rsiHandle' }),
      createQuestion('q-tz', 'Preferred UTC Offset', 'short', { fieldKey: 'timezone' }),
      createQuestion('q-avail', 'Primary Play Window', 'paragraph', {
        fieldKey: 'availablePlaytimes',
      }),
      createQuestion('q-why', 'Reason for Joining', 'paragraph', { fieldKey: 'message' }),
    ];

    const payload = buildDynamicRecruitmentApplyPayload({
      questions,
      answersByQuestionId: {
        'q-rsi': 'PilotAce',
        'q-tz': 'UTC+2',
        'q-avail': 'Weeknights',
        'q-why': 'I enjoy coordinated operations.',
      },
      discordUserId: 'discord-123',
      discordUsername: 'pilot',
    });

    expect(payload.rsiHandle).toBe('PilotAce');
    expect(payload.timezone).toBe('UTC+2');
    expect(payload.availablePlaytimes).toEqual(['Weeknights']);
    expect(payload.message).toBe('I enjoy coordinated operations.');

    const validation = recruitmentSchemas.apply.validate(payload, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    expect(validation.error).toBeUndefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
