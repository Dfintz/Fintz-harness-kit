export declare enum ExperienceLevel {
    BEGINNER = "beginner",
    INTERMEDIATE = "intermediate",
    ADVANCED = "advanced",
    EXPERT = "expert"
}
export declare enum Playstyle {
    CASUAL = "casual",
    HARDCORE = "hardcore",
    COMPETITIVE = "competitive",
    ROLEPLAY = "roleplay",
    SOCIAL = "social"
}
export declare enum Availability {
    WEEKDAYS_MORNING = "weekdays_morning",
    WEEKDAYS_AFTERNOON = "weekdays_afternoon",
    WEEKDAYS_EVENING = "weekdays_evening",
    WEEKDAYS_NIGHT = "weekdays_night",
    WEEKENDS_MORNING = "weekends_morning",
    WEEKENDS_AFTERNOON = "weekends_afternoon",
    WEEKENDS_EVENING = "weekends_evening",
    WEEKENDS_NIGHT = "weekends_night"
}
export declare class UserGameplayPreferences {
    id: string;
    userId: string;
    activityPreferences: {
        [activity: string]: number;
    };
    experienceLevels?: {
        [activity: string]: ExperienceLevel;
    };
    playstyles: Playstyle[];
    preferredGroupSizeMin: number;
    preferredGroupSizeMax: number;
    requiresVoiceChat: boolean;
    prefersSilentPlay: boolean;
    timezone?: string;
    availability?: Availability[];
    preferredRoles?: string[];
    languages: string[];
    combatSkill: number;
    pilotingSkill: number;
    tradingSkill: number;
    miningSkill: number;
    allowCrossOrgMatching: boolean;
    onlyMatchWithVerified: boolean;
    minReputationScore: number;
    preferenceUpdateCount: number;
    lastPreferenceUpdate?: Date;
    scstatsRawData: string | null;
    scstatsLastImport: Date | null;
    scstatsVerified: boolean;
    scstatsTotalHours: number | null;
    scstatsKdRatio: number | null;
    scstatsMissionsCompleted: number | null;
    scstatsFavoriteVehicle: string | null;
    scstatsImportCount: number;
    scstatsConsentGranted: boolean;
    scstatsConsentDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    canUpdatePreferences(): boolean;
    recordUpdate(): void;
    getActivityPreference(activity: string): number;
    getExperienceLevel(activity: string): ExperienceLevel;
    hasPlaystyle(playstyle: Playstyle): boolean;
    isTimezoneCompatible(otherTimezone: string | undefined): boolean;
    getOverallSkillLevel(): number;
    getSummary(): {
        topActivities: string[];
        playstyles: string[];
        skillLevel: number;
        languages: string[];
    };
}
//# sourceMappingURL=UserGameplayPreferences.d.ts.map