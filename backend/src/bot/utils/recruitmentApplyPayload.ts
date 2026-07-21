import type { ApplicationQuestion } from '@sc-fleet-manager/shared-types';

export interface RecruitmentApplyAnswer {
  questionId: string;
  question: string;
  answer: string;
}

export interface RecruitmentApplyPayload {
  answers?: RecruitmentApplyAnswer[];
  message?: string;
  rsiHandle?: string;
  timezone?: string;
  availablePlaytimes?: string[];
  preferredRoles?: string[];
  discordUserId: string;
  discordUsername: string;
}

interface DynamicRecruitmentApplyPayloadInput {
  questions: ApplicationQuestion[];
  answersByQuestionId: Record<string, string>;
  selectedPreferredRole?: string;
  discordUserId: string;
  discordUsername: string;
}

interface LegacyRecruitmentApplyPayloadInput {
  rsiHandle: string;
  timezone: string;
  experience: string;
  availability: string;
  motivation: string;
  selectedPreferredRole?: string;
  discordUserId: string;
  discordUsername: string;
}

function normaliseNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toOptionalSingleItemArray(value: string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return [value];
}

function findAnswerByFieldKey(
  questions: ApplicationQuestion[],
  answersByQuestionId: Record<string, string>,
  semanticKeys: string[]
): string | undefined {
  if (semanticKeys.length === 0) {
    return undefined;
  }

  const keySet = new Set(semanticKeys.map(key => key.trim().toLowerCase()).filter(Boolean));
  if (keySet.size === 0) {
    return undefined;
  }

  const match = questions.find(question => {
    const key = typeof question.fieldKey === 'string' ? question.fieldKey.trim().toLowerCase() : '';
    return key.length > 0 && keySet.has(key);
  });

  if (!match) {
    return undefined;
  }

  return normaliseNonEmptyString(answersByQuestionId[match.id]);
}

function findAnswerByLabel(
  questions: ApplicationQuestion[],
  answersByQuestionId: Record<string, string>,
  predicate: (label: string) => boolean
): string | undefined {
  const match = questions.find(question => predicate(question.label.toLowerCase()));
  if (!match) {
    return undefined;
  }
  return normaliseNonEmptyString(answersByQuestionId[match.id]);
}

function findAnswerBySemanticField(
  questions: ApplicationQuestion[],
  answersByQuestionId: Record<string, string>,
  semanticKeys: string[],
  labelPredicate: (label: string) => boolean
): string | undefined {
  const byFieldKey = findAnswerByFieldKey(questions, answersByQuestionId, semanticKeys);
  if (byFieldKey) {
    return byFieldKey;
  }

  return findAnswerByLabel(questions, answersByQuestionId, labelPredicate);
}

/**
 * Convert dynamic question responses into the canonical apply answer schema.
 * Optional blank answers are omitted so Joi does not reject empty strings.
 */
export function buildRecruitmentAnswers(
  questions: ApplicationQuestion[],
  answersByQuestionId: Record<string, string>
): RecruitmentApplyAnswer[] {
  const answers: RecruitmentApplyAnswer[] = [];

  for (const question of questions) {
    const answer = normaliseNonEmptyString(answersByQuestionId[question.id]);
    if (!answer) {
      continue;
    }

    answers.push({
      questionId: question.id,
      question: question.label,
      answer,
    });
  }

  return answers;
}

export function buildDynamicRecruitmentApplyPayload(
  input: DynamicRecruitmentApplyPayloadInput
): RecruitmentApplyPayload {
  const answers = buildRecruitmentAnswers(input.questions, input.answersByQuestionId);
  const rsiHandle = findAnswerBySemanticField(
    input.questions,
    input.answersByQuestionId,
    ['rsiHandle', 'rsi', 'handle'],
    label => label.includes('rsi') || label.includes('handle')
  );
  const timezone = findAnswerBySemanticField(
    input.questions,
    input.answersByQuestionId,
    ['timezone', 'timeZone', 'tz'],
    label => label.includes('timezone') || label.includes('time zone')
  );
  const message = findAnswerBySemanticField(
    input.questions,
    input.answersByQuestionId,
    ['message', 'motivation', 'whyJoin'],
    label => label.includes('motivation') || label.includes('why')
  );
  const availablePlaytime = findAnswerBySemanticField(
    input.questions,
    input.answersByQuestionId,
    ['availablePlaytimes', 'availability', 'playtime', 'availablePlaytime'],
    label => label.includes('availab') || label.includes('playtime')
  );
  const preferredRole = normaliseNonEmptyString(input.selectedPreferredRole);

  return {
    ...(answers.length > 0 ? { answers } : {}),
    ...(message ? { message } : {}),
    ...(rsiHandle ? { rsiHandle } : {}),
    ...(timezone ? { timezone } : {}),
    ...(availablePlaytime
      ? { availablePlaytimes: toOptionalSingleItemArray(availablePlaytime) }
      : {}),
    ...(preferredRole ? { preferredRoles: toOptionalSingleItemArray(preferredRole) } : {}),
    discordUserId: input.discordUserId,
    discordUsername: input.discordUsername,
  };
}

export function buildLegacyRecruitmentApplyPayload(
  input: LegacyRecruitmentApplyPayloadInput
): RecruitmentApplyPayload {
  const rsiHandle = normaliseNonEmptyString(input.rsiHandle);
  const timezone = normaliseNonEmptyString(input.timezone);
  const experience = normaliseNonEmptyString(input.experience);
  const availability = normaliseNonEmptyString(input.availability);
  const motivation = normaliseNonEmptyString(input.motivation);
  const preferredRole = normaliseNonEmptyString(input.selectedPreferredRole);

  const answers: RecruitmentApplyAnswer[] = [
    { questionId: 'legacy_experience', question: 'Experience', answer: experience ?? '' },
    { questionId: 'legacy_availability', question: 'Availability', answer: availability ?? '' },
    { questionId: 'legacy_motivation', question: 'Motivation', answer: motivation ?? '' },
  ].filter(answer => answer.answer.length > 0);

  return {
    ...(answers.length > 0 ? { answers } : {}),
    ...((motivation ?? experience) ? { message: motivation ?? experience } : {}),
    ...(rsiHandle ? { rsiHandle } : {}),
    ...(timezone ? { timezone } : {}),
    ...(availability ? { availablePlaytimes: toOptionalSingleItemArray(availability) } : {}),
    ...(preferredRole ? { preferredRoles: toOptionalSingleItemArray(preferredRole) } : {}),
    discordUserId: input.discordUserId,
    discordUsername: input.discordUsername,
  };
}
