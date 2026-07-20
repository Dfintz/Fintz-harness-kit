import type { InvalidRequestWarningData, RateLimitData, REST } from 'discord.js';
import { logger } from '../../utils/logger';
export interface RateLimitLogEntry {
    level: 'warn' | 'debug';
    message: string;
    context: Record<string, unknown>;
}
export type RateLimitObserverLogger = Pick<typeof logger, 'warn' | 'debug'>;
export declare function describeRateLimit(data: RateLimitData): RateLimitLogEntry;
export declare function describeInvalidRequestWarning(data: InvalidRequestWarningData): RateLimitLogEntry;
export declare function registerRestRateLimitObserver(rest: Pick<REST, 'on'>, log?: RateLimitObserverLogger): void;
//# sourceMappingURL=restRateLimitObserver.d.ts.map