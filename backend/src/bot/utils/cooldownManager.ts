import { Collection } from 'discord.js';

import { logger } from '../../utils/logger';

/**
 * Manages command cooldowns to prevent spam
 */
export class CooldownManager {
    private static instance: CooldownManager;
    private cooldowns: Collection<string, Collection<string, number>>;

    private constructor() {
        this.cooldowns = new Collection();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): CooldownManager {
        if (!CooldownManager.instance) {
            CooldownManager.instance = new CooldownManager();
        }
        return CooldownManager.instance;
    }

    /**
     * Check if user is on cooldown for a command
     * @param commandName Command name
     * @param userId User ID
     * @param cooldownSeconds Cooldown duration in seconds
     * @returns Remaining cooldown time in seconds, or 0 if not on cooldown
     */
    public checkCooldown(
        commandName: string,
        userId: string,
        cooldownSeconds: number
    ): number {
        if (!this.cooldowns.has(commandName)) {
            this.cooldowns.set(commandName, new Collection());
        }

        const now = Date.now();
        const timestamps = this.cooldowns.get(commandName);
        const cooldownAmount = cooldownSeconds * 1000;

        if (timestamps?.has(userId)) {
            const userTimestamp = timestamps.get(userId);
            if (userTimestamp !== undefined) {
                const expirationTime = userTimestamp + cooldownAmount;

                if (now < expirationTime) {
                    const timeLeft = (expirationTime - now) / 1000;
                    return timeLeft;
                }
            }
        }

        return 0;
    }

    /**
     * Set cooldown for a user on a command
     * @param commandName Command name
     * @param userId User ID
     */
    public setCooldown(commandName: string, userId: string): void {
        if (!this.cooldowns.has(commandName)) {
            this.cooldowns.set(commandName, new Collection());
        }

        const timestamps = this.cooldowns.get(commandName);
        timestamps?.set(userId, Date.now());

        logger.debug(`Set cooldown for user ${userId} on command ${commandName}`);
    }

    /**
     * Clear cooldown for a user on a command (admin override)
     * @param commandName Command name
     * @param userId User ID
     */
    public clearCooldown(commandName: string, userId: string): void {
        if (this.cooldowns.has(commandName)) {
            const timestamps = this.cooldowns.get(commandName);
            timestamps?.delete(userId);
            logger.info(`Cleared cooldown for user ${userId} on command ${commandName}`);
        }
    }

    /**
     * Clear all cooldowns for a user (admin override)
     * @param userId User ID
     */
    public clearUserCooldowns(userId: string): void {
        let cleared = 0;
        for (const [_commandName, timestamps] of this.cooldowns.entries()) {
            if (timestamps.has(userId)) {
                timestamps.delete(userId);
                cleared++;
            }
        }
        logger.info(`Cleared ${cleared} cooldowns for user ${userId}`);
    }

    /**
     * Clear all cooldowns for a command
     * @param commandName Command name
     */
    public clearCommandCooldowns(commandName: string): void {
        if (this.cooldowns.has(commandName)) {
            const timestamps = this.cooldowns.get(commandName);
            const count = timestamps?.size ?? 0;
            this.cooldowns.delete(commandName);
            logger.info(`Cleared ${count} cooldowns for command ${commandName}`);
        }
    }

    /**
     * Get all active cooldowns for a user
     * @param userId User ID
     * @returns Array of command names with remaining cooldown times
     */
    public getUserCooldowns(userId: string): Array<{ command: string; remaining: number }> {
        const activeCooldowns: Array<{ command: string; remaining: number }> = [];
        const now = Date.now();

        for (const [commandName, timestamps] of this.cooldowns.entries()) {
            if (timestamps.has(userId)) {
                const expirationTime = timestamps.get(userId);
                if (expirationTime !== undefined) {
                    const remaining = (expirationTime - now) / 1000;
                    if (remaining > 0) {
                        activeCooldowns.push({
                            command: commandName,
                            remaining: Math.ceil(remaining)
                        });
                    } else {
                        // Clean up expired cooldown
                        timestamps.delete(userId);
                    }
                }
            }
        }

        return activeCooldowns;
    }

    /**
     * Cleanup expired cooldowns (run periodically)
     */
    public cleanupExpired(): void {
        const now = Date.now();
        let cleaned = 0;

        for (const [commandName, timestamps] of this.cooldowns.entries()) {
            const expiredUsers: string[] = [];

            for (const [userId, timestamp] of timestamps.entries()) {
                // If cooldown is older than 1 hour, consider it expired
                if (now - timestamp > 3600000) {
                    expiredUsers.push(userId);
                }
            }

            expiredUsers.forEach(userId => {
                timestamps.delete(userId);
                cleaned++;
            });

            // Remove empty collections
            if (timestamps.size === 0) {
                this.cooldowns.delete(commandName);
            }
        }

        if (cleaned > 0) {
            logger.debug(`Cleaned up ${cleaned} expired cooldowns`);
        }
    }

    /**
     * Get statistics about cooldowns
     */
    public getStats(): {
        totalCommands: number;
        totalActiveCooldowns: number;
        byCommand: Array<{ command: string; active: number }>;
    } {
        const byCommand: Array<{ command: string; active: number }> = [];
        let totalActiveCooldowns = 0;

        for (const [commandName, timestamps] of this.cooldowns.entries()) {
            const activeCount = timestamps.size;
            totalActiveCooldowns += activeCount;
            byCommand.push({
                command: commandName,
                active: activeCount
            });
        }

        return {
            totalCommands: this.cooldowns.size,
            totalActiveCooldowns,
            byCommand: byCommand.sort((a, b) => b.active - a.active)
        };
    }
}
