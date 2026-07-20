import { Collection } from 'discord.js';
import { BotCommand } from './commands/index';
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, BotCommand>;
    }
}
declare const client: import("discord.js").Client<boolean>;
export declare function startBot(): Promise<void>;
export declare function shutdownBotRuntime(): Promise<void>;
export { client };
//# sourceMappingURL=botApp.d.ts.map