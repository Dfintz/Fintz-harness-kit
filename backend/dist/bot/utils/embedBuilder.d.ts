import { ColorResolvable, EmbedBuilder } from 'discord.js';
export declare const EmbedColors: {
    readonly SC_BLUE: ColorResolvable;
    readonly QUANTUM_GOLD: ColorResolvable;
    readonly SUCCESS: ColorResolvable;
    readonly ERROR: ColorResolvable;
    readonly WARNING: ColorResolvable;
    readonly INFO: ColorResolvable;
    readonly ALLIED: ColorResolvable;
    readonly NEUTRAL: ColorResolvable;
    readonly HOSTILE: ColorResolvable;
    readonly OPEN: ColorResolvable;
    readonly FULL: ColorResolvable;
    readonly CLOSED: ColorResolvable;
};
export declare const ActivityAccentColors: Record<string, number>;
export declare function getActivityAccentColor(key?: string): ColorResolvable;
export declare const StatusDots: {
    readonly ONLINE: "🟢";
    readonly AWAY: "🟡";
    readonly BUSY: "🔴";
    readonly OFFLINE: "⚫";
    readonly PENDING: "⚪";
};
export declare enum TimestampFormat {
    SHORT_TIME = "t",
    LONG_TIME = "T",
    SHORT_DATE = "d",
    LONG_DATE = "D",
    SHORT_DATETIME = "f",
    LONG_DATETIME = "F",
    RELATIVE = "R"
}
export declare function formatDiscordTimestamp(date: Date, format?: TimestampFormat): string;
export declare function formatRelativeTime(date: Date): string;
export type ProgressBarStyle = 'gradient' | 'blocks';
export interface ProgressBarOptions {
    width?: number;
    style?: ProgressBarStyle;
    filledChar?: string;
    emptyChar?: string;
    showPercentage?: boolean;
}
export declare function createProgressBar(current: number, max: number, options?: ProgressBarOptions): string;
export declare function createCapacityIndicator(current: number, max: number): string;
export declare class SCFleetEmbed {
    private embed;
    private constructor();
    static create(): SCFleetEmbed;
    static info(title: string, description?: string): SCFleetEmbed;
    static success(title: string, description?: string): SCFleetEmbed;
    static error(title: string, description?: string): SCFleetEmbed;
    static warning(title: string, description?: string): SCFleetEmbed;
    static event(title: string, description?: string): SCFleetEmbed;
    static fleet(title: string, description?: string): SCFleetEmbed;
    setTitle(title: string): SCFleetEmbed;
    setDescription(description: string): SCFleetEmbed;
    setColor(color: ColorResolvable): SCFleetEmbed;
    addFields(...fields: {
        name: string;
        value: string;
        inline?: boolean;
    }[]): SCFleetEmbed;
    setFooter(options: {
        text: string;
        iconURL?: string;
    }): SCFleetEmbed;
    setThumbnail(url: string): SCFleetEmbed;
    setImage(url: string): SCFleetEmbed;
    setTimestamp(date?: Date | number): SCFleetEmbed;
    setAuthor(options: {
        name: string;
        iconURL?: string;
        url?: string;
    }): SCFleetEmbed;
    addProgressField(name: string, current: number, max: number, options?: ProgressBarOptions & {
        inline?: boolean;
    }): SCFleetEmbed;
    addTimestampField(name: string, date: Date, format?: TimestampFormat, inline?: boolean): SCFleetEmbed;
    build(): EmbedBuilder;
    toJSON(): ReturnType<EmbedBuilder['toJSON']>;
}
//# sourceMappingURL=embedBuilder.d.ts.map