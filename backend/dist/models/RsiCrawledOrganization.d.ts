export declare class RsiCrawledOrganization {
    sid: string;
    name: string;
    description?: string;
    banner?: string;
    logo?: string;
    archetype?: string;
    commitment?: string;
    roleplay?: string;
    memberCount: number;
    affiliateCount: number;
    focus?: {
        primary?: string;
        secondary?: string;
    };
    recruiting?: string;
    language?: string;
    exclusive?: string;
    links?: {
        website?: string;
        discord?: string;
        youtube?: string;
        twitch?: string;
    };
    firstCrawledAt: Date;
    lastCrawledAt: Date;
    crawlError?: string;
    crawlFailed: boolean;
}
//# sourceMappingURL=RsiCrawledOrganization.d.ts.map