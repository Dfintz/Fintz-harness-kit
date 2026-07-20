import { GuildOrganization } from '../../models/GuildOrganization';
export declare class GuildOrganizationService {
    private static instance;
    private readonly repository;
    private readonly orgRepository;
    private readonly cache;
    private readonly CACHE_PREFIX;
    private readonly CACHE_TTL;
    private readonly NEGATIVE_CACHE_TTL;
    private constructor();
    static getInstance(): GuildOrganizationService;
    createOrUpdateMapping(guildId: string, organizationId: string, guildName?: string, isPrimary?: boolean, createdBy?: string): Promise<GuildOrganization>;
    resolveOrganization(guildId: string): Promise<string | null>;
    resolveOrganizationWithFallback(guildId: string): Promise<string>;
    getGuildsForOrganization(organizationId: string, activeOnly?: boolean): Promise<GuildOrganization[]>;
    getPrimaryGuildForOrganization(organizationId: string): Promise<GuildOrganization | null>;
    deactivateMapping(guildId: string, userId: string): Promise<boolean>;
    syncOnDiscordConnection(guildId: string, organizationId: string, guildName: string, userId: string): Promise<GuildOrganization>;
    isMapped(guildId: string): Promise<boolean>;
    getMapping(guildId: string): Promise<GuildOrganization | null>;
    getOrganizationsForGuild(guildId: string): Promise<string[]>;
    fetchGuildName(guildId: string, fallback: string): Promise<string>;
    fetchGuildInfo(guildId: string): Promise<{
        name: string;
        iconUrl: string | null;
    } | null>;
    private getCacheKey;
    private invalidateGuildCache;
    clearCache(): void;
    getCacheMetrics(): import("../caching/EnhancedCacheService").CacheMetrics;
}
//# sourceMappingURL=GuildOrganizationService.d.ts.map