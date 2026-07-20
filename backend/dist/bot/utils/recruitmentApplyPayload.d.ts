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
export declare function buildRecruitmentAnswers(questions: ApplicationQuestion[], answersByQuestionId: Record<string, string>): RecruitmentApplyAnswer[];
export declare function buildDynamicRecruitmentApplyPayload(input: DynamicRecruitmentApplyPayloadInput): RecruitmentApplyPayload;
export declare function buildLegacyRecruitmentApplyPayload(input: LegacyRecruitmentApplyPayloadInput): RecruitmentApplyPayload;
export {};
//# sourceMappingURL=recruitmentApplyPayload.d.ts.map