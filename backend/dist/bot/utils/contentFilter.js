"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentFilter = void 0;
const logger_1 = require("../../utils/logger");
class ContentFilter {
    static instance;
    profanityWords;
    spamPatterns;
    maliciousLinkPatterns;
    blockedDomains;
    MAX_MESSAGE_LENGTH = 2000;
    MAX_MENTIONS = 5;
    MAX_EMOJIS = 20;
    MAX_CAPS_PERCENTAGE = 70;
    constructor() {
        this.initializeFilters();
    }
    static getInstance() {
        if (!ContentFilter.instance) {
            ContentFilter.instance = new ContentFilter();
        }
        return ContentFilter.instance;
    }
    initializeFilters() {
        this.profanityWords = new Set([
            'fuck', 'shit', 'bitch', 'asshole', 'bastard',
            'damn', 'crap', 'dick', 'pussy', 'cock',
            'nigger', 'nigga', 'fag', 'faggot', 'retard',
        ]);
        this.spamPatterns = [
            /(.)\1{10,}/i,
            /(\b\w+\b)\s+\1\s+\1/i,
            /discord\.gg\/[a-zA-Z0-9]+/i,
            /(free|win|claim).*(nitro|gift|prize)/i,
            /(http[s]?:\/\/[^\s]+\s*){5,}/i,
        ];
        this.maliciousLinkPatterns = [
            /steamcommunity-[a-z]+\.com/i,
            /discordapp-[a-z]+\.com/i,
            /discord-nitro\.com/i,
            /bit\.ly|goo\.gl|tinyurl\.com/i,
        ];
        this.blockedDomains = new Set([
            'scam-site.com',
            'malware-host.com',
        ]);
    }
    filterMessage(content, _authorId) {
        if (content.length > this.MAX_MESSAGE_LENGTH) {
            return {
                allowed: false,
                reason: `Message exceeds maximum length (${this.MAX_MESSAGE_LENGTH} characters)`,
                severity: 'low'
            };
        }
        if (this.hasExcessiveCaps(content)) {
            return {
                allowed: false,
                reason: 'Message contains excessive capital letters (spam)',
                severity: 'low'
            };
        }
        const profanityCheck = this.checkProfanity(content);
        if (!profanityCheck.allowed) {
            return profanityCheck;
        }
        const spamCheck = this.checkSpam(content);
        if (!spamCheck.allowed) {
            return spamCheck;
        }
        const linkCheck = this.checkMaliciousLinks(content);
        if (!linkCheck.allowed) {
            return linkCheck;
        }
        const mentionCheck = this.checkMentions(content);
        if (!mentionCheck.allowed) {
            return mentionCheck;
        }
        const emojiCheck = this.checkEmojis(content);
        if (!emojiCheck.allowed) {
            return emojiCheck;
        }
        return { allowed: true };
    }
    checkProfanity(content) {
        const lowerContent = content.toLowerCase();
        const cleanContent = lowerContent.replace(/[\s\-_.]+/g, '');
        for (const word of this.profanityWords) {
            if (cleanContent.includes(word)) {
                logger_1.logger.warn(`Profanity detected: ${word}`);
                return {
                    allowed: false,
                    reason: 'Message contains inappropriate language',
                    severity: 'medium'
                };
            }
        }
        return { allowed: true };
    }
    checkSpam(content) {
        for (const pattern of this.spamPatterns) {
            if (pattern.test(content)) {
                logger_1.logger.warn(`Spam pattern detected: ${pattern}`);
                return {
                    allowed: false,
                    reason: 'Message detected as spam',
                    severity: 'medium'
                };
            }
        }
        return { allowed: true };
    }
    checkMaliciousLinks(content) {
        for (const pattern of this.maliciousLinkPatterns) {
            if (pattern.test(content)) {
                logger_1.logger.error(`Malicious link detected: ${pattern}`);
                return {
                    allowed: false,
                    reason: 'Message contains suspicious or malicious links',
                    severity: 'high'
                };
            }
        }
        const urlRegex = /https?:\/\/([^\s/]+)/gi;
        const matches = content.matchAll(urlRegex);
        for (const match of matches) {
            const domain = match[1].toLowerCase();
            if (this.blockedDomains.has(domain)) {
                logger_1.logger.error(`Blocked domain detected: ${domain}`);
                return {
                    allowed: false,
                    reason: 'Message contains blocked domain',
                    severity: 'high'
                };
            }
        }
        return { allowed: true };
    }
    checkMentions(content) {
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
    checkEmojis(content) {
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
    hasExcessiveCaps(content) {
        const letters = content.replace(/[^a-zA-Z]/g, '');
        if (letters.length < 10) {
            return false;
        }
        const caps = content.replace(/[^A-Z]/g, '');
        const percentage = (caps.length / letters.length) * 100;
        return percentage > this.MAX_CAPS_PERCENTAGE;
    }
    addProfanityWord(word) {
        this.profanityWords.add(word.toLowerCase());
        logger_1.logger.info(`Added word to profanity filter: ${word}`);
    }
    removeProfanityWord(word) {
        this.profanityWords.delete(word.toLowerCase());
        logger_1.logger.info(`Removed word from profanity filter: ${word}`);
    }
    addBlockedDomain(domain) {
        this.blockedDomains.add(domain.toLowerCase());
        logger_1.logger.info(`Added domain to blocklist: ${domain}`);
    }
    removeBlockedDomain(domain) {
        this.blockedDomains.delete(domain.toLowerCase());
        logger_1.logger.info(`Removed domain from blocklist: ${domain}`);
    }
    getStats() {
        return {
            profanityWords: this.profanityWords.size,
            spamPatterns: this.spamPatterns.length,
            maliciousPatterns: this.maliciousLinkPatterns.length,
            blockedDomains: this.blockedDomains.size
        };
    }
}
exports.ContentFilter = ContentFilter;
//# sourceMappingURL=contentFilter.js.map