export const TOP_LEVEL_SLASH_COMMAND_NAMES = ['user', 'org', 'federation'] as const;

export const TOP_LEVEL_SLASH_COMMAND_NAME_SET = new Set<string>(TOP_LEVEL_SLASH_COMMAND_NAMES);
