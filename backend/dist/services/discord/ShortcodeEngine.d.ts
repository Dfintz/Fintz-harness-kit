import { GuildMember, User } from 'discord.js';
export interface ShortcodeContext {
    user?: User | {
        id: string;
        username: string;
        displayName?: string;
        tag?: string;
    };
    member?: GuildMember | {
        displayName: string;
        roles?: {
            cache: {
                size: number;
            };
        };
    };
    guild?: {
        id: string;
        name: string;
        memberCount: number;
    };
    organization?: {
        id: string;
        name: string;
        memberCount: number;
    };
    ticket?: {
        number: string;
        subject: string;
        category: string;
        status: string;
    };
    event?: {
        title: string;
        date: string;
        location: string;
        type: string;
        hostName: string;
    };
    recruitment?: {
        title: string;
        position: string;
        status: string;
    };
    lfg?: {
        activity: string;
        maxPlayers: number;
        currentPlayers: number;
    };
    custom?: Record<string, string>;
}
type Resolver = (ctx: ShortcodeContext) => string | undefined;
export declare class ShortcodeEngine {
    private static instance;
    static getInstance(): ShortcodeEngine;
    resolve(template: string, context: ShortcodeContext): string;
    getAvailableShortcodes(): string[];
    validate(template: string): string[];
    registerResolver(key: string, resolver: Resolver): void;
}
export {};
//# sourceMappingURL=ShortcodeEngine.d.ts.map