export interface FilterResult {
    allowed: boolean;
    reason?: string;
    severity?: 'low' | 'medium' | 'high';
}
export declare class ContentFilter {
    private static instance;
    private profanityWords;
    private spamPatterns;
    private maliciousLinkPatterns;
    private blockedDomains;
    private readonly MAX_MESSAGE_LENGTH;
    private readonly MAX_MENTIONS;
    private readonly MAX_EMOJIS;
    private readonly MAX_CAPS_PERCENTAGE;
    private constructor();
    static getInstance(): ContentFilter;
    private initializeFilters;
    filterMessage(content: string, _authorId: string): FilterResult;
    private checkProfanity;
    private checkSpam;
    private checkMaliciousLinks;
    private checkMentions;
    private checkEmojis;
    private hasExcessiveCaps;
    addProfanityWord(word: string): void;
    removeProfanityWord(word: string): void;
    addBlockedDomain(domain: string): void;
    removeBlockedDomain(domain: string): void;
    getStats(): {
        profanityWords: number;
        spamPatterns: number;
        maliciousPatterns: number;
        blockedDomains: number;
    };
}
//# sourceMappingURL=contentFilter.d.ts.map