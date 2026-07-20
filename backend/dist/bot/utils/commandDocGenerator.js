"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCommandDocs = generateCommandDocs;
const discord_js_1 = require("discord.js");
const OPTION_TYPE_NAMES = {
    [discord_js_1.ApplicationCommandOptionType.String]: 'string',
    [discord_js_1.ApplicationCommandOptionType.Integer]: 'integer',
    [discord_js_1.ApplicationCommandOptionType.Boolean]: 'boolean',
    [discord_js_1.ApplicationCommandOptionType.User]: 'user',
    [discord_js_1.ApplicationCommandOptionType.Channel]: 'channel',
    [discord_js_1.ApplicationCommandOptionType.Role]: 'role',
    [discord_js_1.ApplicationCommandOptionType.Number]: 'number',
    [discord_js_1.ApplicationCommandOptionType.Attachment]: 'attachment',
};
function mapOptionType(type) {
    return OPTION_TYPE_NAMES[type] ?? 'unknown';
}
function extractOptions(options) {
    return options
        .filter((opt) => {
        const o = opt;
        return (o.type !== undefined &&
            o.type !== discord_js_1.ApplicationCommandOptionType.Subcommand &&
            o.type !== discord_js_1.ApplicationCommandOptionType.SubcommandGroup);
    })
        .map((opt) => {
        const o = opt;
        return {
            name: o.name,
            description: o.description,
            type: mapOptionType(o.type),
            required: o.required ?? false,
            choices: o.choices,
        };
    });
}
function extractSubcommands(options) {
    return options
        .filter((opt) => {
        const o = opt;
        return o.type === discord_js_1.ApplicationCommandOptionType.Subcommand;
    })
        .map((opt) => {
        const o = opt;
        return {
            name: o.name,
            description: o.description,
            options: o.options ? extractOptions(o.options) : [],
        };
    });
}
function generateCommandDocs(commands) {
    return commands.map((command) => {
        const json = command.data.toJSON();
        const options = (json.options ?? []);
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
//# sourceMappingURL=commandDocGenerator.js.map