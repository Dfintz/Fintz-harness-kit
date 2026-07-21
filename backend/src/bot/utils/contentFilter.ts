/**
 * Content Filter for Tunnel Messages
 * Filters inappropriate content, spam, and malicious links
 */

import { logger } from '../../utils/logger';

export interface FilterResult {
    allowed: boolean;
    reason?: string;
    severity?: 'low' | 'medium' | 'high';
}

export class ContentFilter {
    private static instance: ContentFilter;
    
    // Configurable filter lists
    private profanityWords: Set<string>;
    private spamPatterns: RegExp[];
    private maliciousLinkPatterns: RegExp[];
    private blockedDomains: Set<string>;
    
    // Configuration
    private readonly MAX_MESSAGE_LENGTH = 2000;
    private readonly MAX_MENTIONS = 5;
    private readonly MAX_EMOJIS = 20;
    private readonly MAX_CAPS_PERCENTAGE = 70;

    private constructor() {
        this.initializeFilters();
    }

    public static getInstance(): ContentFilter {
        if (!ContentFilter.instance) {
            ContentFilter.instance = new ContentFilter();
        }
        return ContentFilter.instance;
    }

    /**
     * Initialize filter lists
     */
    private initializeFilters() {
        // Profanity filter (basic list - expand as needed)
        this.profanityWords = new Set([
            'fuck', 'shit', 'bitch', 'asshole', 'bastard',
            'damn', 'crap', 'dick', 'pussy', 'cock',
            'nigger', 'nigga', 'fag', 'faggot', 'retard',
            // Add more words as needed
        ]);

        // Spam patterns
        this.spamPatterns = [
            /(.)\1{10,}/i, // Repeated characters (10+ times)
            /(\b\w+\b)\s+\1\s+\1/i, // Repeated words (3+ times)
            /discord\.gg\/[a-zA-Z0-9]+/i, // Discord invite links (configurable)
            /(free|win|claim).*(nitro|gift|prize)/i, // Scam patterns
            /(http[s]?:\/\/[^\s]+\s*){5,}/i, // Multiple links (5+)
        ];

        // Malicious link patterns
        this.maliciousLinkPatterns = [
            /steamcommunity-[a-z]+\.com/i, // Fake Steam sites
            /discordapp-[a-z]+\.com/i, // Fake Discord sites
            /discord-nitro\.com/i, // Fake Discord Nitro
            /bit\.ly|goo\.gl|tinyurl\.com/i, // URL shorteners (can hide malicious links)
        ];

        // Blocked domains
        this.blockedDomains = new Set([
            'scam-site.com',
            'malware-host.com',
            // Add known malicious domains
        ]);
    }

    /**
     * Filter message content
     */
    public filterMessage(content: string, _authorId: string): FilterResult {
        // Check message length
        if (content.length > this.MAX_MESSAGE_LENGTH) {
            return {
                allowed: false,
                reason: `Message exceeds maximum length (${this.MAX_MESSAGE_LENGTH} characters)`,
                severity: 'low'
            };
        }

        // Check for excessive caps
        if (this.hasExcessiveCaps(content)) {
            return {
                allowed: false,
                reason: 'Message contains excessive capital letters (spam)',
                severity: 'low'
            };
        }

        // Check for profanity
        const profanityCheck = this.checkProfanity(content);
        if (!profanityCheck.allowed) {
            return profanityCheck;
        }

        // Check for spam patterns
        const spamCheck = this.checkSpam(content);
        if (!spamCheck.allowed) {
            return spamCheck;
        }

        // Check for malicious links
        const linkCheck = this.checkMaliciousLinks(content);
        if (!linkCheck.allowed) {
            return linkCheck;
        }

        // Check for excessive mentions
        const mentionCheck = this.checkMentions(content);
        if (!mentionCheck.allowed) {
            return mentionCheck;
        }

        // Check for excessive emojis
        const emojiCheck = this.checkEmojis(content);
        if (!emojiCheck.allowed) {
            return emojiCheck;
        }

        // All checks passed
        return { allowed: true };
    }

    /**
     * Check for profanity
     */
    private checkProfanity(content: string): FilterResult {
        const lowerContent = content.toLowerCase();
        
        // Remove spaces and special characters for better detection
        const cleanContent = lowerContent.replace(/[\s\-_.]+/g, '');
        
        for (const word of this.profanityWords) {
            if (cleanContent.includes(word)) {
                logger.warn(`Profanity detected: ${word}`);
                return {
                    allowed: false,
                    reason: 'Message contains inappropriate language',
                    severity: 'medium'
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Check for spam patterns
     */
    private checkSpam(content: string): FilterResult {
        for (const pattern of this.spamPatterns) {
            if (pattern.test(content)) {
                logger.warn(`Spam pattern detected: ${pattern}`);
                return {
                    allowed: false,
                    reason: 'Message detected as spam',
                    severity: 'medium'
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Check for malicious links
     */
    private checkMaliciousLinks(content: string): FilterResult {
        // Check malicious patterns
        for (const pattern of this.maliciousLinkPatterns) {
            if (pattern.test(content)) {
                logger.error(`Malicious link detected: ${pattern}`);
                return {
                    allowed: false,
                    reason: 'Message contains suspicious or malicious links',
                    severity: 'high'
                };
            }
        }

        // Check blocked domains
        const urlRegex = /https?:\/\/([^\s/]+)/gi;
        const matches = content.matchAll(urlRegex);
        
        for (const match of matches) {
            const domain = match[1].toLowerCase();
            if (this.blockedDomains.has(domain)) {
                logger.error(`Blocked domain detected: ${domain}`);
                return {
                    allowed: false,
                    reason: 'Message contains blocked domain',
                    severity: 'high'
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Check for excessive mentions
     */
    private checkMentions(content: string): FilterResult {
        const mentionCount = (content.match(/<@[!&]?\d+>/g) || []).length;
        
        if (mentionCount > this.MAX_MENTIONS) {
            return {
                allowed: false,
                reason: `Message contains too many mentions (max: ${this.MAX_MENTIONS})`,
                severity: 'low'
            };
        }

        return { allowed: true };
    }

    /**
     * Check for excessive emojis
     */
    private checkEmojis(content: string): FilterResult {
        // Count standard emojis and custom Discord emojis
        const emojiCount = (content.match(/<a?:\w+:\d+>|[\u{1F600}-\u{1F64F}]/gu) || []).length;
        
        if (emojiCount > this.MAX_EMOJIS) {
            return {
                allowed: false,
                reason: `Message contains too many emojis (max: ${this.MAX_EMOJIS})`,
                severity: 'low'
            };
        }

        return { allowed: true };
    }

    /**
     * Check for excessive caps
     */
    private hasExcessiveCaps(content: string): boolean {
        const letters = content.replace(/[^a-zA-Z]/g, '');
        if (letters.length < 10) {return false;} // Skip short messages
        
        const caps = content.replace(/[^A-Z]/g, '');
        const percentage = (caps.length / letters.length) * 100;
        
        return percentage > this.MAX_CAPS_PERCENTAGE;
    }

    /**
     * Add word to profanity filter
     */
    public addProfanityWord(word: string): void {
        this.profanityWords.add(word.toLowerCase());
        logger.info(`Added word to profanity filter: ${word}`);
    }

    /**
     * Remove word from profanity filter
     */
    public removeProfanityWord(word: string): void {
        this.profanityWords.delete(word.toLowerCase());
        logger.info(`Removed word from profanity filter: ${word}`);
    }

    /**
     * Add domain to blocklist
     */
    public addBlockedDomain(domain: string): void {
        this.blockedDomains.add(domain.toLowerCase());
        logger.info(`Added domain to blocklist: ${domain}`);
    }

    /**
     * Remove domain from blocklist
     */
    public removeBlockedDomain(domain: string): void {
        this.blockedDomains.delete(domain.toLowerCase());
        logger.info(`Removed domain from blocklist: ${domain}`);
    }

    /**
     * Get filter statistics
     */
    public getStats(): {
        profanityWords: number;
        spamPatterns: number;
        maliciousPatterns: number;
        blockedDomains: number;
    } {
        return {
            profanityWords: this.profanityWords.size,
            spamPatterns: this.spamPatterns.length,
            maliciousPatterns: this.maliciousLinkPatterns.length,
            blockedDomains: this.blockedDomains.size
        };
    }
}
