import type { Activity, ActivityType } from '../../models/Activity';
export interface LFGPreferences {
    preferredRoles: string[];
    skillLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    availableHours: number;
    timeZone: string;
    communicationPreference: 'text' | 'voice' | 'both';
    languages: string[];
    microphone: boolean;
    ageRestriction?: boolean;
}
export interface MatchCriteria {
    activityTypes: ActivityType[];
    location?: string;
    maxDistance?: number;
    timeRange: {
        start: Date;
        end: Date;
    };
    groupSize?: {
        min: number;
        max: number;
    };
    skillLevel?: 'beginner' | 'intermediate' | 'advanced' | 'expert';
    requiresVoice?: boolean;
}
export interface LFGMatch {
    activityId: string;
    matchScore: number;
    reasons: string[];
    activity: Activity;
    availableSlots: number;
    estimatedWaitTime?: number;
}
export interface CreateGroupHistoryParams {
    lfgPostId: string;
    activity: string;
    description: string;
    creatorId: string;
    creatorName: string;
    participantIds: string[];
    guildId: string;
    channelId: string;
    wasSuccessful: boolean;
    durationMinutes?: number;
    completionNotes?: {
        submittedBy: string;
        note: string;
        timestamp: Date;
    };
}
export interface GroupHistoryStats {
    totalSessions: number;
    successfulSessions: number;
    failedSessions: number;
    successRate: number;
    averageDuration?: number;
    favoriteActivity?: string;
    totalPlayersEncountered: number;
}
//# sourceMappingURL=SocialGroupService.types.d.ts.map