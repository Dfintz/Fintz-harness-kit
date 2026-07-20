import { BotCommand } from './types';
export declare const events: BotCommand;
export declare function parseFleetInviteButtonId(customId: string): {
    action: 'joinship' | 'joinonly' | 'decline';
    activityId: string;
    fleetId: string;
} | null;
//# sourceMappingURL=events.d.ts.map