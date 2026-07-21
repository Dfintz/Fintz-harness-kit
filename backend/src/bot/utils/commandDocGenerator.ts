import {
    ApplicationCommandOptionType
} from 'discord.js';

import { BotCommand } from '../commands/types';

export interface CommandDocOption {
  name: string;
  description: string;
  type: string;
  required: boolean;
  choices?: Array<{ name: string; value: string }>;
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

const OPTION_TYPE_NAMES: Record<number, string> = {
  [ApplicationCommandOptionType.String]: 'string',
  [ApplicationCommandOptionType.Integer]: 'integer',
  [ApplicationCommandOptionType.Boolean]: 'boolean',
  [ApplicationCommandOptionType.User]: 'user',
  [ApplicationCommandOptionType.Channel]: 'channel',
  [ApplicationCommandOptionType.Role]: 'role',
  [ApplicationCommandOptionType.Number]: 'number',
  [ApplicationCommandOptionType.Attachment]: 'attachment',
};

function mapOptionType(type: number): string {
  return OPTION_TYPE_NAMES[type] ?? 'unknown';
}

function extractOptions(options: readonly unknown[]): CommandDocOption[] {
  return options
    .filter((opt: unknown) => {
      const o = opt as { type?: number };
      return (
        o.type !== undefined &&
        o.type !== ApplicationCommandOptionType.Subcommand &&
        o.type !== ApplicationCommandOptionType.SubcommandGroup
      );
    })
    .map((opt: unknown) => {
      const o = opt as {
        name: string;
        description: string;
        type: number;
        required?: boolean;
        choices?: Array<{ name: string; value: string }>;
      };
      return {
        name: o.name,
        description: o.description,
        type: mapOptionType(o.type),
        required: o.required ?? false,
        choices: o.choices,
      };
    });
}

function extractSubcommands(options: readonly unknown[]): CommandDocSubcommand[] {
  return options
    .filter((opt: unknown) => {
      const o = opt as { type?: number };
      return o.type === ApplicationCommandOptionType.Subcommand;
    })
    .map((opt: unknown) => {
      const o = opt as {
        name: string;
        description: string;
        options?: readonly unknown[];
      };
      return {
        name: o.name,
        description: o.description,
        options: o.options ? extractOptions(o.options) : [],
      };
    });
}

/**
 * Generate documentation from a list of bot commands.
 * Uses SlashCommandBuilder.toJSON() to extract metadata.
 */
export function generateCommandDocs(commands: BotCommand[]): CommandDoc[] {
  return commands.map((command) => {
    const json = command.data.toJSON();
    const options = (json.options ?? []) as readonly unknown[];

    return {
      name: json.name,
      description: json.description,
      category: command.category ?? 'utility',
      examples: command.examples ?? [],
      permissions: command.permissions ?? [],
      guildOnly: command.guildOnly ?? true,
      cooldown: command.cooldown ?? 3,
      subcommands: extractSubcommands(options),
      options: extractOptions(options),
    };
  });
}
