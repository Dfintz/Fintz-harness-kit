import type { ChatInputCommandInteraction, RepliableInteraction } from 'discord.js';
import { UserService } from '../../services/user/UserService';
export declare function __setUserServiceFactoryForTesting(factory: () => UserService): void;
export declare function __clearPlatformRbacCacheForTesting(): void;
export declare function isPlatformAdmin(discordId: string): Promise<boolean>;
export declare function requirePlatformAdmin(interaction: ChatInputCommandInteraction | RepliableInteraction): Promise<boolean>;
//# sourceMappingURL=platformRbac.d.ts.map