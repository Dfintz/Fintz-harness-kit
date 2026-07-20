"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRecruitmentAnswers = buildRecruitmentAnswers;
exports.buildDynamicRecruitmentApplyPayload = buildDynamicRecruitmentApplyPayload;
exports.buildLegacyRecruitmentApplyPayload = buildLegacyRecruitmentApplyPayload;
function normaliseNonEmptyString(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function toOptionalSingleItemArray(value) {
    if (!value) {
        return undefined;
    }
    return [value];
}
function findAnswerByFieldKey(questions, answersByQuestionId, semanticKeys) {
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
function findAnswerByLabel(questions, answersByQuestionId, predicate) {
    const match = questions.find(question => predicate(question.label.toLowerCase()));
    if (!match) {
        return undefined;
    }
    return normaliseNonEmptyString(answersByQuestionId[match.id]);
}
function findAnswerBySemanticField(questions, answersByQuestionId, semanticKeys, labelPredicate) {
    const byFieldKey = findAnswerByFieldKey(questions, answersByQuestionId, semanticKeys);
    if (byFieldKey) {
        return byFieldKey;
    }
    return findAnswerByLabel(questions, answersByQuestionId, labelPredicate);
}
function buildRecruitmentAnswers(questions, answersByQuestionId) {
    const answers = [];
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
function buildDynamicRecruitmentApplyPayload(input) {
    const answers = buildRecruitmentAnswers(input.questions, input.answersByQuestionId);
    const rsiHandle = findAnswerBySemanticField(input.questions, input.answersByQuestionId, ['rsiHandle', 'rsi', 'handle'], label => label.includes('rsi') || label.includes('handle'));
    const timezone = findAnswerBySemanticField(input.questions, input.answersByQuestionId, ['timezone', 'timeZone', 'tz'], label => label.includes('timezone') || label.includes('time zone'));
    const message = findAnswerBySemanticField(input.questions, input.answersByQuestionId, ['message', 'motivation', 'whyJoin'], label => label.includes('motivation') || label.includes('why'));
    const availablePlaytime = findAnswerBySemanticField(input.questions, input.answersByQuestionId, ['availablePlaytimes', 'availability', 'playtime', 'availablePlaytime'], label => label.includes('availab') || label.includes('playtime'));
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
function buildLegacyRecruitmentApplyPayload(input) {
    const rsiHandle = normaliseNonEmptyString(input.rsiHandle);
    const timezone = normaliseNonEmptyString(input.timezone);
    const experience = normaliseNonEmptyString(input.experience);
    const availability = normaliseNonEmptyString(input.availability);
    const motivation = normaliseNonEmptyString(input.motivation);
    const preferredRole = normaliseNonEmptyString(input.selectedPreferredRole);
    const answers = [
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
//# sourceMappingURL=recruitmentApplyPayload.js.map