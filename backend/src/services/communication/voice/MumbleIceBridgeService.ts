/**
 * MumbleIceBridgeService — Manages Mumble server via the CVP bridge (ICE proxy).
 *
 * Provides write operations: channel CRUD, ACL management, user actions.
 * All operations go through the CVP bridge HTTPS API on the Mumble VM,
 * which translates them to ICE calls against the local Mumble server.
 *
 * Read operations (status, channels) remain in VoiceServerService.
 */

import type { VoiceServerConfig } from '@sc-fleet-manager/shared-types';

import { logger } from '../../../utils/logger';
import { isPrivateHostResolved } from '../../../utils/ssrfProtection';

interface MumbleChannel {
  id: number;
  name: string;
  parentId: number | null;
}

interface MumbleACLGroup {
  name: string;
  members: string[]; // Mumble usernames or platform user IDs
}

export class MumbleIceBridgeService {
  private static instance: MumbleIceBridgeService;

  private constructor() {
    logger.info('MumbleIceBridgeService initialized');
  }

  public static getInstance(): MumbleIceBridgeService {
    if (!MumbleIceBridgeService.instance) {
      MumbleIceBridgeService.instance = new MumbleIceBridgeService();
    }
    return MumbleIceBridgeService.instance;
  }

  /**
   * Create a channel on the Mumble server for an activity/op.
   * Requires ICE write access via the CVP bridge.
   */
  async createChannel(
    config: VoiceServerConfig,
    name: string,
    parentId?: number
  ): Promise<MumbleChannel | null> {
    return this.callCvpBridge<MumbleChannel>(config, 'POST', '/channels', {
      name,
      parentId: parentId ?? 0,
    });
  }

  /**
   * Delete a channel from the Mumble server.
   */
  async deleteChannel(config: VoiceServerConfig, channelId: number): Promise<boolean> {
    const result = await this.callCvpBridge<{ success: boolean }>(
      config,
      'DELETE',
      `/channels/${channelId}`
    );
    return result?.success ?? false;
  }

  /**
   * Update ACL groups for a channel (role-based access control).
   */
  async setChannelACL(
    config: VoiceServerConfig,
    channelId: number,
    groups: MumbleACLGroup[]
  ): Promise<boolean> {
    const result = await this.callCvpBridge<{ success: boolean }>(
      config,
      'PUT',
      `/channels/${channelId}/acl`,
      { groups }
    );
    return result?.success ?? false;
  }

  /**
   * Mute a user on the Mumble server (cross-platform moderation).
   */
  async muteUser(config: VoiceServerConfig, username: string, mute: boolean): Promise<boolean> {
    const result = await this.callCvpBridge<{ success: boolean }>(config, 'POST', '/users/mute', {
      username,
      mute,
    });
    return result?.success ?? false;
  }

  /**
   * Kick a user from the Mumble server.
   */
  async kickUser(config: VoiceServerConfig, username: string, reason?: string): Promise<boolean> {
    const result = await this.callCvpBridge<{ success: boolean }>(config, 'POST', '/users/kick', {
      username,
      reason: reason ?? 'Kicked by platform moderation',
    });
    return result?.success ?? false;
  }

  /**
   * Ban a user from the Mumble server.
   */
  async banUser(
    config: VoiceServerConfig,
    username: string,
    reason?: string,
    durationSeconds?: number
  ): Promise<boolean> {
    const result = await this.callCvpBridge<{ success: boolean }>(config, 'POST', '/users/ban', {
      username,
      reason: reason ?? 'Banned by platform moderation',
      durationSeconds,
    });
    return result?.success ?? false;
  }

  /**
   * Send a generic request to the CVP bridge on the Mumble VM.
   */
  private async callCvpBridge<T>(
    config: VoiceServerConfig,
    method: string,
    path: string,
    body?: unknown
  ): Promise<T | null> {
    if (!config.iceHost) {
      logger.debug('No ICE host configured, skipping CVP bridge call');
      return null;
    }

    // SSRF protection — resolve DNS to prevent rebinding
    if (await isPrivateHostResolved(config.iceHost)) {
      logger.warn('Blocked CVP bridge call to private/internal host', { host: config.iceHost });
      return null;
    }

    const cvpPort = config.icePort ?? 8443;
    const url = `https://${config.iceHost}:${cvpPort}${path}`;

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        logger.warn('CVP bridge call failed', {
          method,
          path,
          status: response.status,
        });
        return null;
      }

      return (await response.json()) as T;
    } catch (error: unknown) {
      logger.warn('CVP bridge unreachable', {
        method,
        path,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}

