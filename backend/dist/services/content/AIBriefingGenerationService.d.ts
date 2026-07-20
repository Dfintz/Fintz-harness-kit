import { AIFeatureType } from '../../models/AIUsageTracking';
import { MissionDifficulty, MissionObjectiveData, MissionType } from '../../models/Mission';
export interface AIGenerationRequest {
    missionType: MissionType;
    objectives: MissionObjectiveData[];
    difficulty: MissionDifficulty;
    location?: string;
    fleetComposition?: Array<{
        shipName: string;
        role: string;
    }>;
    participantCount?: number;
    estimatedDuration?: number;
    additionalContext?: string;
}
export interface AIBriefingElement {
    type: 'header' | 'text' | 'objective' | 'warning' | 'timeline' | 'role-assignment';
    content: string;
    metadata?: Record<string, unknown>;
}
export interface AIGenerationResult {
    briefingElements: AIBriefingElement[];
    tokensUsed: number;
    promptTokens: number;
    completionTokens: number;
    modelUsed: string;
}
export interface AIUsageStats {
    organizationId: string;
    featureType: AIFeatureType;
    date: string;
    requestCount: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    dailyLimit: number;
    remaining: number;
}
export declare class AIBriefingGenerationService {
    private client;
    private readonly model;
    private readonly maxTokensPerRequest;
    private readonly maxGenerationsPerOrgPerDay;
    private _usageRepository?;
    private get usageRepository();
    constructor();
    isAvailable(): boolean;
    generateBriefing(organizationId: string, userId: string, request: AIGenerationRequest): Promise<AIGenerationResult>;
    generateBriefingStream(organizationId: string, userId: string, request: AIGenerationRequest, onChunk: (chunk: string) => void): Promise<{
        tokensUsed: number;
        promptTokens: number;
        completionTokens: number;
    }>;
    getUsageStats(organizationId: string, featureType?: AIFeatureType): Promise<AIUsageStats>;
    private getSystemPrompt;
    private buildUserPrompt;
    private logFlaggedInjectionMarkers;
    private checkRateLimit;
    private trackUsage;
    private assertAvailable;
    private safeParse;
    private mapToBriefingElements;
    private todayDateString;
}
//# sourceMappingURL=AIBriefingGenerationService.d.ts.map