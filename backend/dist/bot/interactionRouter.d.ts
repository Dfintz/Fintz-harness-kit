import { Client, Interaction } from 'discord.js';
import { CommandAnalytics } from './utils/commandAnalytics';
import { CooldownManager } from './utils/cooldownManager';
import { trackInteractionLatency } from './utils/interactionExecutor';
export { trackInteractionLatency };
export declare function routeInteraction(interaction: Interaction, client: Client, cooldownManager: CooldownManager, commandAnalytics?: CommandAnalytics): Promise<boolean>;
//# sourceMappingURL=interactionRouter.d.ts.map