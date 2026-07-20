import { Organization } from './Organization';
export declare enum OrgPrimaryFocus {
    COMBAT = "combat",
    MINING = "mining",
    TRADING = "trading",
    EXPLORATION = "exploration",
    BOUNTY_HUNTING = "bounty_hunting",
    MEDICAL = "medical",
    TRANSPORT = "transport",
    SALVAGE = "salvage",
    SECURITY = "security",
    SOCIAL = "social",
    PIRACY = "piracy",
    RACING = "racing",
    MIXED = "mixed"
}
export declare enum ActivityLevel {
    INACTIVE = "inactive",
    LOW = "low",
    MODERATE = "moderate",
    HIGH = "high",
    VERY_HIGH = "very_high"
}
export declare class PublicOrgProfile {
    id: string;
    organizationId: string;
    organization: Organization;
    slug?: string;
    isPublic: boolean;
    tagline?: string;
    primaryFocus: OrgPrimaryFocus;
    secondaryFocus?: OrgPrimaryFocus[];
    memberCount: number;
    activityLevel: ActivityLevel;
    rsiUrl?: string;
    discordInvite?: string;
    twitterUrl?: string;
    youtubeUrl?: string;
    twitchUrl?: string;
    websiteUrl?: string;
    bannerUrl?: string;
    languages?: string[];
    timezone?: string;
    isVerified: boolean;
    isRecruiting: boolean;
    useDiscordForApplications: boolean;
    scstatsVisibility?: {
        showVerification?: boolean;
        showSkills?: boolean;
        showTimezone?: boolean;
        showAnalytics?: boolean;
    };
    rsiArchetype?: string;
    rsiCommitment?: string;
    rsiRolePlay?: boolean;
    rsiExclusive?: boolean;
    createdAt: Date;
    updatedAt: Date;
}
//# sourceMappingURL=PublicOrgProfile.d.ts.map