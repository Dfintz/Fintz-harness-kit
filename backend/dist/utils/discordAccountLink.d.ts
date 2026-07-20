export declare const DISCORD_ACCOUNT_NOT_LINKED_CODE = "DISCORD_ACCOUNT_NOT_LINKED";
export interface DiscordAccountLinkPrompt {
    message: string;
    loginUrl: string;
}
export interface ParseDiscordAccountLinkPromptOptions {
    allowedStatusCodes?: number[];
    fallbackMessage: string;
    fallbackLoginUrl: string;
}
export declare function getDiscordWebLoginUrl(): string;
export declare function isHttpUrl(value: unknown): value is string;
export declare function parseDiscordAccountLinkPrompt(error: unknown, options: ParseDiscordAccountLinkPromptOptions): DiscordAccountLinkPrompt | null;
//# sourceMappingURL=discordAccountLink.d.ts.map