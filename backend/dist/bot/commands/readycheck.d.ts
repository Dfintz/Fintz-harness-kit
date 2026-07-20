import { BotCommand } from './types';
export declare function parseReadycheckDurationModalActivityId(customId: string): string | null;
export declare function _resetServicesForTesting(): void;
interface ReadyCheckVoteAction {
    activityId: string;
    response: 'ready' | 'not_ready';
}
export declare function parseReadyCheckVoteCustomId(customId: string): ReadyCheckVoteAction | null;
export declare const readycheck: BotCommand;
export {};
//# sourceMappingURL=readycheck.d.ts.map