import { logger } from '../../utils/logger';

export interface BotInternalSecretValidationOptions {
  contextLabel: string;
  onFailure: 'throw' | 'exit';
  logSuccess?: boolean;
}

/**
 * Validate BOT_INTERNAL_SECRET using the shared runtime policy used by bot startup paths.
 * Non-dev environments fail closed; development and test only warn.
 */
export function validateBotInternalSecret({
  contextLabel,
  onFailure,
  logSuccess = false,
}: BotInternalSecretValidationOptions): void {
  const botSecret = process.env.BOT_INTERNAL_SECRET;
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isNonProdEnv = nodeEnv === 'development' || nodeEnv === 'test';

  if (!botSecret) {
    const message =
      `${contextLabel} BOT_INTERNAL_SECRET is required for bot-to-API authentication. ` +
      `NODE_ENV=${nodeEnv}. ` +
      'Set BOT_INTERNAL_SECRET to the same value in both API and bot containers. ' +
      'Check docker-compose.yml and .env files to verify both services have matching values.';

    if (isNonProdEnv) {
      logger.warn(`${contextLabel} Dev mode: ${message}`);
      return;
    }

    logger.error(message);
    if (onFailure === 'exit') {
      process.exit(1);
    }
    throw new Error(message);
  }

  if (logSuccess) {
    logger.info(`${contextLabel} BOT_INTERNAL_SECRET is configured`);
  }
}
