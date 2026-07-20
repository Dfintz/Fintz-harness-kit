import { ButtonInteraction } from 'discord.js';
export type RsiSyncAdminAction = 'status' | 'setup' | 'run' | 'audit';
export declare function isRsiSyncAdminAction(value: string): value is RsiSyncAdminAction;
export declare function hasManageRolesPermission(interaction: ButtonInteraction): boolean;
export declare function resolveOrgIdFromGuild(guildId: string): Promise<string | null>;
export declare function handleRsiSyncAdminAction(action: RsiSyncAdminAction, interaction: ButtonInteraction): Promise<void>;
//# sourceMappingURL=rsiSyncAdminActions.d.ts.map