import { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
export declare function handleEventList(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void>;
export declare function handleEventInfo(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventCreate(interaction: ButtonInteraction | ChatInputCommandInteraction): Promise<void>;
export declare function handleEventJoin(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventTentative(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventDecline(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventLeave(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventRecurring(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventMirror(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventMirrorkey(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventUnmirror(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventMirrorlimit(interaction: ChatInputCommandInteraction): Promise<void>;
export declare function handleEventUnsigned(interaction: ChatInputCommandInteraction): Promise<void>;
//# sourceMappingURL=eventHandlers.d.ts.map