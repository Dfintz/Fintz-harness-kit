import { Client } from 'discord.js';

import { rsiRoleMutationAuthorizationService } from '../services/external/RsiRoleMutationAuthorizationService';
import { logger } from '../utils/logger';

import { BotIPCService, IPCMessage, IPCResponse } from './BotIPCService';
import {
  consumeRoleIpcReplayToken,
  isRoleIpcSigningSecretConfigured,
  isSignedRoleIpcPayload,
  SignedRoleIpcPayload,
  verifySignedRoleIpcPayload,
} from './roleIpcAuth';

/** IPC action name for assigning a role */
export const ROLE_ASSIGN_ACTION = 'role:assign';

/** IPC action name for removing a role */
export const ROLE_REMOVE_ACTION = 'role:remove';

/**
 * Payload expected by the role:assign and role:remove IPC handlers.
 */
interface RoleModifyPayload {
  guildId: string;
  userId: string;
  roleId: string;
  organizationId: string;
  issuedAt: number;
  signature: string;
}

interface RoleMutationGuardResult {
  guildId: string;
  userId: string;
  roleId: string;
}

const INVALID_PAYLOAD_ERROR =
  'Invalid payload: missing guildId, userId, roleId, organizationId, issuedAt, or signature';

function isValidPayload(data: Record<string, unknown>): boolean {
  return isSignedRoleIpcPayload(data);
}

function handledError(message: IPCMessage, error: string): IPCResponse {
  return {
    correlationId: message.correlationId,
    success: false,
    status: 'handled',
    definitive: true,
    error,
  };
}

function notHandledOnThisShard(message: IPCMessage, guildId: string): IPCResponse {
  return {
    correlationId: message.correlationId,
    success: true,
    status: 'not_handled',
    definitive: false,
    data: { reason: 'guild_not_cached', guildId },
  };
}

function isRoleMutationGuardResult(
  value: RoleMutationGuardResult | IPCResponse
): value is RoleMutationGuardResult {
  return !('success' in value);
}

async function runRoleMutationGuards(
  message: IPCMessage,
  client: Client
): Promise<RoleMutationGuardResult | IPCResponse> {
  if (!isValidPayload(message.data)) {
    return handledError(message, INVALID_PAYLOAD_ERROR);
  }

  const payload = message.data as unknown as SignedRoleIpcPayload;
  const { guildId, userId, roleId } = payload as unknown as RoleModifyPayload;

  const signatureCheck = verifySignedRoleIpcPayload(message.action, payload);
  if (!signatureCheck.valid) {
    return handledError(message, signatureCheck.reason ?? 'Invalid IPC signature');
  }

  if (!client.guilds.cache.has(guildId)) {
    return notHandledOnThisShard(message, guildId);
  }

  const authorizationError = await rsiRoleMutationAuthorizationService.validateRoleMutation({
    organizationId: payload.organizationId,
    guildId,
    roleId,
    discordUserId: userId,
  });
  if (authorizationError) {
    return handledError(message, authorizationError);
  }

  const replayCheck = consumeRoleIpcReplayToken(message.action, payload);
  if (!replayCheck.valid) {
    return handledError(message, replayCheck.reason ?? 'IPC message replay detected');
  }

  return {
    guildId,
    userId,
    roleId,
  };
}

async function handleRoleMutation(
  message: IPCMessage,
  client: Client,
  operation: 'assign' | 'remove'
): Promise<IPCResponse> {
  const guardResult = await runRoleMutationGuards(message, client);
  if (!isRoleMutationGuardResult(guardResult)) {
    return guardResult;
  }

  const { guildId, userId, roleId } = guardResult;

  try {
    const { getDiscordService } = await import('../services/discord/DiscordService');
    const discordService = getDiscordService();
    const result =
      operation === 'assign'
        ? await discordService.assignRole(guildId, userId, roleId)
        : await discordService.removeRole(guildId, userId, roleId);

    return {
      correlationId: message.correlationId,
      success: true,
      status: 'handled',
      definitive: true,
      data: { message: result },
    };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(
      `RoleIPC: Failed to ${operation} role ${roleId} ${
        operation === 'assign' ? 'to' : 'from'
      } ${userId} in ${guildId}:`,
      error
    );
    return handledError(message, errorMsg);
  }
}

/**
 * Initialize role:assign and role:remove IPC handlers.
 *
 * When the worker container needs to manage Discord roles during RSI sync,
 * it sends IPC requests via Redis Pub/Sub. This handler processes them using
 * the bot's authenticated DiscordService instance.
 *
 * Flow:
 * 1. Worker rsiSyncScheduler detects role changes needed
 * 2. Sends IPC request: { action: 'role:assign', data: { guildId, userId, roleId } }
 * 3. This handler delegates to DiscordService.assignRole/removeRole
 * 4. Returns success/failure to the worker
 */
export function initializeRoleIpcHandler(ipcService: BotIPCService, _client: Client): void {
  if (!ipcService.isAvailable()) {
    logger.debug('RoleIPC: IPC not available, handlers not registered');
    return;
  }

  if (!isRoleIpcSigningSecretConfigured()) {
    logger.error(
      'RoleIPC: signing secret (BOT_IPC_ROLE_SIGNING_SECRET / INTERNAL_SERVICE_SECRET) is not configured — all role:assign/role:remove requests will be rejected'
    );
  }

  ipcService.registerHandler(
    ROLE_ASSIGN_ACTION,
    async (message: IPCMessage): Promise<IPCResponse> =>
      handleRoleMutation(message, _client, 'assign')
  );

  ipcService.registerHandler(
    ROLE_REMOVE_ACTION,
    async (message: IPCMessage): Promise<IPCResponse> =>
      handleRoleMutation(message, _client, 'remove')
  );

  logger.info('RoleIPC: role:assign and role:remove handlers registered');
}
