import { BotCommand } from '../commands/types';
export interface CommandDocOption {
    name: string;
    description: string;
    type: string;
    required: boolean;
    choices?: Array<{
        name: string;
        value: string;
    }>;
}
export interface CommandDocSubcommand {
    name: string;
    description: string;
    options: CommandDocOption[];
}
export interface CommandDoc {
    name: string;
    description: string;
    category: string;
    examples: string[];
    permissions: string[];
    guildOnly: boolean;
    cooldown: number;
    subcommands: CommandDocSubcommand[];
    options: CommandDocOption[];
}
export declare function generateCommandDocs(commands: BotCommand[]): CommandDoc[];
//# sourceMappingURL=commandDocGenerator.d.ts.map