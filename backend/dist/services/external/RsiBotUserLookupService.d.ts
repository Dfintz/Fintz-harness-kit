export declare class RsiBotUserLookupService {
    private userRepository;
    constructor();
    isAvailable(): boolean;
    getPlatformUserIdByDiscordId(discordUserId: string): Promise<string | null>;
}
export declare const rsiBotUserLookupService: RsiBotUserLookupService;
//# sourceMappingURL=RsiBotUserLookupService.d.ts.map