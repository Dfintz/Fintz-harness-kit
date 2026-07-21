import { ChannelType, Client, GatewayIntentBits, Partials } from 'discord.js';

import { BotClientManager } from '../../bot/BotClientManager';
import { getErrorMessage } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import {
  createDistributedCache,
  DistributedCacheService,
} from '../caching/DistributedCacheService';

/**
 * Discord Token Response
 */
export interface DiscordTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

/**
 * Discord User Info
 */
export interface DiscordUserInfo {
  id: string;
  username: string;
  discriminator: string;
  avatar: string | null;
  email?: string;
  verified?: boolean;
}

/**
 * Discord Role Info
 */
export interface DiscordRole {
  id: string;
  name: string;
}

/**
 * Unified Discord Service
 * Consolidates Discord bot operations, SSO authentication, and role management
 *
 * Features:
 * - OAuth2 authentication (SSO)
 * - Bot messaging and commands
 * - Role management with distributed caching (Redis)
 * - Uses BotClientManager singleton for the shared Discord.js client (Wave 1.9)
 * - Horizontal scalability with shared cache
 */
export class DiscordService {
  private readonly client: Client;
  private readonly roleCache: DistributedCacheService;
  private readonly botToken: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;

  constructor(
    botToken: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    externalClient?: Client
  ) {
    // Validate required parameters
    if (!botToken) {
      throw new Error('Discord bot token is required');
    }
    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Discord SSO requires clientId, clientSecret, and redirectUri');
    }

    this.botToken = botToken;
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;

    // Wave 1.9: Use external client from BotClientManager if provided,
    // otherwise try BotClientManager singleton, falling back to creating
    // a standalone client for backward compatibility.
    if (externalClient) {
      this.client = externalClient;
      logger.info('DiscordService: Using externally provided Client instance');
    } else {
      try {
        const manager = BotClientManager.getInstance();
        this.client = manager.getClient();
        logger.info('DiscordService: Using BotClientManager shared Client instance');
      } catch (error: unknown) {
        logger.debug('DiscordService: BotClientManager not available, creating standalone client', {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fallback: create own client (e.g., in tests or standalone usage)
        this.client = new Client({
          intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
          ],
          partials: [Partials.Message, Partials.Channel, Partials.Reaction],
        });

        // Set up client event handlers only for standalone client
        this.setupEventHandlers();

        // Login to Discord only for standalone client.
        // NOTE: In the BotClientManager path, login happens externally via
        // `clientManager.login()` in botApp.ts. In this fallback path, we
        // auto-login immediately to preserve backward compatibility with the
        // pre-Wave-1.9 behavior where DiscordService was self-contained.
        // Errors are logged but not re-thrown since constructors cannot
        // propagate async rejections — callers use getDiscordService() which
        // will fail on subsequent API calls if login failed.
        void this.client.login(botToken).catch((error: unknown) => {
          logger.error('Failed to login to Discord:', error);
        });

        logger.info('DiscordService: Created standalone Client (fallback)');
      }
    }

    // Initialize distributed role cache (Redis with memory fallback)
    this.roleCache = createDistributedCache({
      keyPrefix: 'discord:roles',
      defaultTTL: Number.parseInt(process.env.DISCORD_CACHE_TTL ?? '300', 10),
    });
  }

  // ========================================
  // CLIENT INITIALIZATION
  // ========================================

  /**
   * Setup Discord client event handlers
   */
  private setupEventHandlers(): void {
    this.client.once('clientReady', () => {
      logger.info(`Discord bot logged in as ${this.client.user?.tag}`);
    });

    this.client.on('error', error => {
      logger.error('Discord client error:', error);
    });
  }

  /**
   * Check if bot is ready
   */
  public isReady(): boolean {
    return this.client.isReady();
  }

  // ========================================
  // SSO AUTHENTICATION
  // ========================================

  /**
   * Generate Discord OAuth2 authorization URL
   * @param state - Random state parameter for CSRF protection
   * @param codeChallenge - Optional PKCE code challenge (S256). When provided,
   *   the matching `code_verifier` must be supplied to {@link authenticateUser}.
   * @returns Authorization URL
   */
  public generateAuthUrl(state: string, codeChallenge?: string): string {
    if (!state) {
      throw new Error('State parameter is required for CSRF protection');
    }

    const baseUrl = 'https://discord.com/api/oauth2/authorize';
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: 'identify email',
      state,
    });
    if (codeChallenge) {
      params.set('code_challenge', codeChallenge);
      params.set('code_challenge_method', 'S256');
    }
    return `${baseUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param code - Authorization code from Discord
   * @param redirectUri - Optional redirect URI (must match the one used in authorization URL). If not provided, uses the configured redirectUri.
   * @param codeVerifier - Optional PKCE code verifier matching the `code_challenge`
   *   sent to {@link generateAuthUrl}. Required by Discord when a challenge was sent.
   * @returns Token response with access_token, refresh_token, etc.
   */
  public async authenticateUser(
    code: string,
    redirectUri?: string,
    codeVerifier?: string
  ): Promise<DiscordTokenResponse> {
    if (!code) {
      throw new Error('Authorization code is required');
    }

    // Use provided redirectUri or fall back to configured one
    const effectiveRedirectUri = redirectUri || this.redirectUri;
    logger.debug('Discord OAuth token exchange starting', {
      redirectUri: effectiveRedirectUri,
      pkce: !!codeVerifier,
    });

    try {
      const body = new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: effectiveRedirectUri,
      });
      if (codeVerifier) {
        body.set('code_verifier', codeVerifier);
      }
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      if (!tokenResponse.ok) {
        // Capture error details for diagnostics
        const raw = await tokenResponse.text();
        let errorData: Record<string, unknown> = {};
        try {
          errorData = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch (_parseError: unknown) {
          // JSON parse failed — preserve raw response text for diagnostics
          logger.debug('Failed to parse Discord error response as JSON', {
            raw: raw.slice(0, 200),
          });
          errorData = { rawError: raw };
        }

        const errorDescription =
          errorData.error_description || errorData.error || tokenResponse.statusText;

        logger.error('Discord authentication failed', {
          status: tokenResponse.status,
          error: errorData.error,
          errorDescription,
          redirectUri: effectiveRedirectUri,
        });

        throw new Error(
          `Discord authentication failed: ${tokenResponse.status} - ${errorDescription}`
        );
      }

      return (await tokenResponse.json()) as DiscordTokenResponse;
    } catch (error: unknown) {
      // Re-throw errors that we've already formatted
      if (error instanceof Error && error.message.startsWith('Discord authentication failed')) {
        throw error;
      }
      logger.error('Discord authentication error:', error);
      throw new Error(`Failed to authenticate user: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Fetch user information from Discord API
   * @param accessToken - Discord access token
   * @returns User information
   */
  public async getUserInfo(accessToken: string): Promise<DiscordUserInfo> {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      const userResponse = await fetch('https://discord.com/api/users/@me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!userResponse.ok) {
        const errorData = (await userResponse.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          `Failed to fetch user info: ${userResponse.status} - ${
            errorData.message || userResponse.statusText
          }`
        );
      }

      return (await userResponse.json()) as DiscordUserInfo;
    } catch (error: unknown) {
      // Re-throw errors that we've already formatted
      if (error instanceof Error && error.message.startsWith('Failed to fetch user info')) {
        throw error;
      }
      logger.error('Failed to fetch Discord user info:', error);
      throw new Error(`Failed to fetch user info: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Refresh Discord access token using refresh token
   * @param refreshToken - Discord refresh token
   * @returns New token response
   */
  public async refreshAccessToken(refreshToken: string): Promise<DiscordTokenResponse> {
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }

    try {
      const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = (await tokenResponse.json().catch(() => ({}))) as Record<string, unknown>;
        throw new Error(
          `Token refresh failed: ${tokenResponse.status} - ${errorData.error || tokenResponse.statusText}`
        );
      }

      return (await tokenResponse.json()) as DiscordTokenResponse;
    } catch (error: unknown) {
      // Re-throw errors that we've already formatted
      if (error instanceof Error && error.message.startsWith('Token refresh failed')) {
        throw error;
      }
      logger.error('Failed to refresh Discord token:', error);
      throw new Error(`Failed to refresh access token: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Check if token should be refreshed (within 24 hours of expiration)
   * @param expiresAt - Token expiration date
   * @returns True if token should be refreshed
   */
  public shouldRefreshToken(expiresAt: Date): boolean {
    const now = new Date();
    const expirationTime = new Date(expiresAt).getTime();
    const currentTime = now.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;

    return expirationTime - currentTime <= twentyFourHours;
  }

  /**
   * Revoke Discord access token
   * @param accessToken - Discord access token to revoke
   */
  public async revokeToken(accessToken: string): Promise<void> {
    if (!accessToken) {
      throw new Error('Access token is required');
    }

    try {
      const response = await fetch('https://discord.com/api/oauth2/token/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientSecret,
          token: accessToken,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to revoke token: ${response.status}`);
      }

      logger.info('Discord token revoked successfully');
    } catch (error: unknown) {
      // Re-throw errors that we've already formatted
      if (error instanceof Error && error.message.startsWith('Failed to revoke token')) {
        throw error;
      }
      logger.error('Failed to revoke Discord token:', error);
      throw new Error(`Failed to revoke token: ${getErrorMessage(error)}`);
    }
  }

  // ========================================
  // BOT OPERATIONS
  // ========================================

  /**
   * Send a message to a Discord channel
   * @param channelId - Discord channel ID to send the message to
   * @param message - Message content to send
   */
  public async sendMessage(channelId: string, message: string): Promise<void> {
    try {
      if (this.client.isReady()) {
        const channel = this.client.channels.cache.get(channelId);
        if (channel?.type === ChannelType.GuildText) {
          await channel.send(message);
          logger.debug(`Message sent to channel ${channelId}`);
          return;
        }
      }

      // REST fallback when gateway client is not connected
      const response = await this.discordRestRequest(
        'POST',
        `/channels/${encodeURIComponent(channelId)}/messages`,
        { content: message }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(
          `Discord REST API error sending message to channel ${channelId}: ${response.status}`,
          { body: errorBody }
        );
        throw new Error(`Failed to send message: Discord API returned ${response.status}`);
      }

      logger.debug(`Message sent to channel ${channelId} via REST API`);
    } catch (error: unknown) {
      logger.error(`Failed to send message to channel ${channelId}:`, error);
      throw error;
    }
  }

  /**
   * Listen for and handle Discord commands
   * @param commandPrefix - Prefix for commands (e.g., '!')
   * @param commandHandler - Callback function to handle parsed commands
   */
  public listenForCommands(
    commandPrefix: string,
    commandHandler: (command: string, args: string[]) => void
  ): void {
    this.client.on('messageCreate', message => {
      if (!message.content.startsWith(commandPrefix) || message.author.bot) {
        return;
      }

      const args = message.content.slice(commandPrefix.length).trim().split(/ +/);
      const command = args.shift()?.toLowerCase();
      if (command) {
        commandHandler(command, args);
      }
    });

    logger.info(`Listening for commands with prefix: ${commandPrefix}`);
  }

  // ========================================
  // ROLE MANAGEMENT
  // ========================================

  /**
   * Get user roles with caching
   * @param guildId - Discord guild (server) ID
   * @param userId - Discord user ID
   * @returns Array of user roles
   */
  public async getUserRoles(guildId: string, userId: string): Promise<DiscordRole[]> {
    const cacheKey = `${guildId}:${userId}`;

    // Check cache first
    const cached = await this.roleCache.get<DiscordRole[]>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for user roles: ${userId}`);
      return cached;
    }

    let roles: DiscordRole[];

    if (this.client.isReady()) {
      try {
        const guild = await this.client.guilds.fetch(guildId);
        const member = await guild.members.fetch(userId);
        roles = Array.from(member.roles.cache.values()).map(role => ({
          id: role.id,
          name: role.name,
        }));
      } catch (error: unknown) {
        logger.error(`Failed to fetch roles for user ${userId} via gateway:`, error);
        throw error;
      }
    } else {
      // REST API fallback
      try {
        const response = await this.discordRestRequest(
          'GET',
          `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`
        );

        if (!response.ok) {
          const errorBody = await response.text();
          logger.error(
            `Discord REST API error fetching member ${userId} in guild ${guildId}: ${response.status}`,
            { body: errorBody }
          );
          throw new Error(`Discord API returned ${response.status} when fetching member ${userId}`);
        }

        const memberData = (await response.json()) as {
          roles: string[];
        };

        // Member endpoint returns only role IDs — fetch full role list to resolve names
        const allRoles = await this.getGuildRoles(guildId);
        const roleIdSet = new Set(memberData.roles);
        roles = allRoles.filter(role => roleIdSet.has(role.id));
      } catch (error: unknown) {
        logger.error(`Failed to fetch roles for user ${userId} via REST:`, error);
        throw error;
      }
    }

    // Cache the result
    await this.roleCache.set(cacheKey, roles);
    logger.debug(`Fetched and cached roles for user ${userId}`);

    return roles;
  }

  /**
   * Get all roles in a guild (not user-specific)
   * @param guildId - Discord guild (server) ID
   * @returns Array of all guild roles sorted by position descending
   */
  public async getGuildRoles(guildId: string): Promise<DiscordRole[]> {
    const cacheKey = `guild-roles:${guildId}`;

    const cached = await this.roleCache.get<DiscordRole[]>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for guild roles: ${guildId}`);
      return cached;
    }

    if (!this.client.isReady()) {
      return this.getGuildRolesViaRest(guildId, cacheKey);
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      // Use fetch() to ensure roles are loaded from the API, not just cache
      const fetchedRoles = await guild.roles.fetch();
      const roles = Array.from(fetchedRoles.values())
        .filter(role => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => ({
          id: role.id,
          name: role.name,
        }));

      await this.roleCache.set(cacheKey, roles);
      logger.debug(`Fetched and cached ${roles.length} roles for guild ${guildId}`);

      return roles;
    } catch (error: unknown) {
      logger.error(`Failed to fetch guild roles for ${guildId}:`, error);

      const errorCode = (error as Record<string, unknown>)?.code;
      if (errorCode === 50001) {
        throw new Error(
          `Bot does not have access to guild ${guildId}. Ensure the bot is a member of the Discord server.`
        );
      }
      if (errorCode === 50013) {
        throw new Error(
          `Bot lacks permissions to list roles in guild ${guildId}. Grant the bot "View Server" permission.`
        );
      }

      throw error;
    }
  }

  /**
   * Get the display name of a Discord guild by its ID.
   * Returns undefined if the bot cannot access the guild.
   */
  public async getGuildName(guildId: string): Promise<string | undefined> {
    const cacheKey = `guild-name:${guildId}`;
    const cached = await this.roleCache.get<string>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      if (!this.client.isReady()) {
        return await this.getGuildNameViaRest(guildId, cacheKey);
      }
      const guild = await this.client.guilds.fetch(guildId);
      await this.roleCache.set(cacheKey, guild.name);
      return guild.name;
    } catch {
      logger.debug(`Could not fetch guild name for ${guildId}`);
      return undefined;
    }
  }

  /**
   * Fetch guild name via the Discord REST API directly.
   * Used when the gateway client is not connected.
   */
  private async getGuildNameViaRest(
    guildId: string,
    cacheKey: string
  ): Promise<string | undefined> {
    try {
      const response = await this.discordRestRequest(
        'GET',
        `/guilds/${encodeURIComponent(guildId)}`
      );
      if (!response.ok) {
        logger.debug(`Discord REST API error fetching guild ${guildId}: ${response.status}`);
        return undefined;
      }
      const guild = (await response.json()) as { name?: string };
      if (guild.name) {
        await this.roleCache.set(cacheKey, guild.name);
      }
      return guild.name;
    } catch {
      logger.debug(`Could not fetch guild name via REST for ${guildId}`);
      return undefined;
    }
  }

  /**
   * Get all channels for a Discord guild, sorted by position.
   * Returns text and voice channels with type info for UI dropdowns.
   * Falls back to REST API when gateway client is not connected.
   */
  public async getGuildChannels(
    guildId: string
  ): Promise<{ id: string; name: string; type: number; parentId?: string }[]> {
    const cacheKey = `guild-channels:${guildId}`;

    const cached =
      await this.roleCache.get<{ id: string; name: string; type: number; parentId?: string }[]>(
        cacheKey
      );
    if (cached) {
      logger.debug(`Cache hit for guild channels: ${guildId}`);
      return cached;
    }

    if (!this.client.isReady()) {
      return this.getGuildChannelsViaRest(guildId, cacheKey);
    }

    try {
      const guild = await this.client.guilds.fetch(guildId);
      const fetchedChannels = await guild.channels.fetch();
      const channels = Array.from(fetchedChannels.values())
        .filter((ch): ch is NonNullable<typeof ch> => ch !== null)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(ch => ({
          id: ch.id,
          name: ch.name,
          type: ch.type,
          parentId: (ch as unknown as { parentId?: string }).parentId ?? undefined,
        }));

      await this.roleCache.set(cacheKey, channels);
      logger.debug(`Fetched and cached ${channels.length} channels for guild ${guildId}`);

      return channels;
    } catch (error: unknown) {
      logger.error(`Failed to fetch guild channels for ${guildId}:`, error);

      const errorCode = (error as Record<string, unknown>)?.code;
      if (errorCode === 50001) {
        throw new Error(
          `Bot does not have access to guild ${guildId}. Ensure the bot is a member of the Discord server.`
        );
      }
      if (errorCode === 50013) {
        throw new Error(
          `Bot lacks permissions to list channels in guild ${guildId}. Grant the bot "View Server" permission.`
        );
      }

      throw error;
    }
  }

  /**
   * Fetch guild channels via the Discord REST API directly.
   * Used when the gateway client is not connected (e.g. DISABLE_BOT=true,
   * bot running in a separate container).
   */
  private async getGuildChannelsViaRest(
    guildId: string,
    cacheKey: string
  ): Promise<{ id: string; name: string; type: number; parentId?: string }[]> {
    try {
      const response = await this.discordRestRequest(
        'GET',
        `/guilds/${encodeURIComponent(guildId)}/channels`
      );

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(
          `Discord REST API error fetching channels for guild ${guildId}: ${response.status}`,
          { body: errorBody }
        );
        throw this.createRestError(
          response.status,
          errorBody,
          `fetch channels for guild ${guildId}`
        );
      }

      const rawChannels = (await response.json()) as Array<{
        id: string;
        name: string;
        type: number;
        position: number;
        parent_id?: string | null;
      }>;

      const sortedChannels = [...rawChannels].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const channels = sortedChannels.map(ch => ({
        id: ch.id,
        name: ch.name,
        type: ch.type,
        parentId: ch.parent_id ?? undefined,
      }));

      await this.roleCache.set(cacheKey, channels);
      logger.debug(
        `Fetched and cached ${channels.length} channels for guild ${guildId} via REST API`
      );

      return channels;
    } catch (error: unknown) {
      logger.error(`Failed to fetch guild channels via REST for ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Make a request to the Discord REST API.
   * Used as a fallback when the gateway client is not connected
   * (e.g. DISABLE_BOT=true, bot running in a separate container).
   */
  private async discordRestRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    body?: unknown,
    _retryCount: number = 0
  ): Promise<Response> {
    const response = await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: {
        Authorization: `Bot ${this.botToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });

    // Handle Discord rate limits with Retry-After
    if (response.status === 429 && _retryCount < 3) {
      const retryAfter = response.headers.get('retry-after');
      const delay = retryAfter ? Math.min(Number(retryAfter) * 1000, 10_000) : 1000;
      logger.warn(
        `Discord REST rate limited on ${method} ${path}, retrying after ${delay}ms (attempt ${_retryCount + 1}/3)`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.discordRestRequest(method, path, body, _retryCount + 1);
    }

    return response;
  }

  /**
   * Fetch guild roles via the Discord REST API directly.
   * Used when the gateway client is not connected (e.g. DISABLE_BOT=true,
   * bot running in a separate container).
   */
  private async getGuildRolesViaRest(guildId: string, cacheKey: string): Promise<DiscordRole[]> {
    try {
      const response = await this.discordRestRequest(
        'GET',
        `/guilds/${encodeURIComponent(guildId)}/roles`
      );

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error(
          `Discord REST API error fetching roles for guild ${guildId}: ${response.status}`,
          { body: errorBody }
        );
        throw this.createRestError(response.status, errorBody, `fetch roles for guild ${guildId}`);
      }

      const rawRoles = (await response.json()) as Array<{
        id: string;
        name: string;
        position: number;
      }>;

      const roles: DiscordRole[] = rawRoles
        .filter(role => role.name !== '@everyone')
        .sort((a, b) => b.position - a.position)
        .map(role => ({ id: role.id, name: role.name }));

      await this.roleCache.set(cacheKey, roles);
      logger.debug(`Fetched and cached ${roles.length} roles for guild ${guildId} via REST API`);

      return roles;
    } catch (error: unknown) {
      logger.error(`Failed to fetch guild roles via REST for ${guildId}:`, error);
      throw error;
    }
  }

  /**
   * Assign a role to a user
   * @param guildId - Discord guild (server) ID
   * @param userId - Discord user ID
   * @param roleId - Discord role ID to assign
   * @param enqueueOnFailure - Whether to add to retry queue on failure (default: true)
   */
  public async assignRole(
    guildId: string,
    userId: string,
    roleId: string,
    enqueueOnFailure: boolean = true
  ): Promise<string> {
    try {
      if (this.client.isReady()) {
        await this.assignRoleViaGateway(guildId, userId, roleId);
      } else {
        await this.modifyMemberRoleViaRest('PUT', guildId, userId, roleId, 'assign');
      }

      // Invalidate cache for this user
      const cacheKey = `${guildId}:${userId}`;
      await this.roleCache.del(cacheKey);

      logger.info(`Role ${roleId} assigned to user ${userId}`);
      return `Role assigned to user ${userId}`;
    } catch (error: unknown) {
      // Enhance error message with context
      const enhancedError = this.enhanceRoleError(error, 'assign', guildId, userId, roleId);
      logger.error(`Failed to assign role ${roleId} to user ${userId}:`, enhancedError);

      // Add to retry queue for automatic retry with exponential backoff
      if (enqueueOnFailure) {
        try {
          const { getRoleSyncRetryService } = await import('./RoleSyncRetryService');
          const { RoleSyncOperationType } = await import('../../models/RoleSyncRetryQueue');
          const retryService = getRoleSyncRetryService();
          await retryService.enqueue({
            guildId,
            userId,
            roleId,
            operation: RoleSyncOperationType.ASSIGN,
          });
          logger.info(`Added failed role assignment to retry queue: ${roleId} for user ${userId}`);
        } catch (enqueueError: unknown) {
          logger.error('Failed to enqueue role assignment for retry:', enqueueError);
        }
      }

      throw enhancedError;
    }
  }

  /**
   * Remove a role from a user
   * @param guildId - Discord guild (server) ID
   * @param userId - Discord user ID
   * @param roleId - Discord role ID to remove
   * @param enqueueOnFailure - Whether to add to retry queue on failure (default: true)
   */
  public async removeRole(
    guildId: string,
    userId: string,
    roleId: string,
    enqueueOnFailure: boolean = true
  ): Promise<string> {
    try {
      if (this.client.isReady()) {
        await this.removeRoleViaGateway(guildId, userId, roleId);
      } else {
        await this.modifyMemberRoleViaRest('DELETE', guildId, userId, roleId, 'remove');
      }

      // Invalidate cache for this user
      const cacheKey = `${guildId}:${userId}`;
      await this.roleCache.del(cacheKey);

      logger.info(`Role ${roleId} removed from user ${userId}`);
      return `Role removed from user ${userId}`;
    } catch (error: unknown) {
      // Enhance error message with context
      const enhancedError = this.enhanceRoleError(error, 'remove', guildId, userId, roleId);
      logger.error(`Failed to remove role ${roleId} from user ${userId}:`, enhancedError);

      // Add to retry queue for automatic retry with exponential backoff
      if (enqueueOnFailure) {
        try {
          const { getRoleSyncRetryService } = await import('./RoleSyncRetryService');
          const { RoleSyncOperationType } = await import('../../models/RoleSyncRetryQueue');
          const retryService = getRoleSyncRetryService();
          await retryService.enqueue({
            guildId,
            userId,
            roleId,
            operation: RoleSyncOperationType.REMOVE,
          });
          logger.info(`Added failed role removal to retry queue: ${roleId} for user ${userId}`);
        } catch (enqueueError: unknown) {
          logger.error('Failed to enqueue role removal for retry:', enqueueError);
        }
      }

      throw enhancedError;
    }
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  /**
   * Clear the role cache
   * @param guildId - Optional guild ID to clear cache for specific guild/user
   * @param userId - Optional user ID to clear cache for specific user (requires guildId)
   */
  public async clearRoleCache(guildId?: string, userId?: string): Promise<void> {
    if (guildId && userId) {
      const cacheKey = `${guildId}:${userId}`;
      await this.roleCache.del(cacheKey);
      logger.info(`Discord role cache cleared for user ${userId} in guild ${guildId}`);
    } else if (guildId) {
      // Clear all cache entries for this guild
      await this.roleCache.delPattern(`${guildId}:*`);
      logger.info(`Discord role cache cleared for guild ${guildId}`);
    } else {
      await this.roleCache.flushAll();
      logger.info('Discord role cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  public async getRoleCacheStats() {
    return this.roleCache.getStats();
  }

  // ========================================
  // GATEWAY HELPERS (used when client.isReady())
  // ========================================

  /**
   * Assign a role via the Discord.js gateway client (pre-flight checks included).
   */
  private async assignRoleViaGateway(
    guildId: string,
    userId: string,
    roleId: string
  ): Promise<void> {
    const guild = await this.client.guilds.fetch(guildId);
    const botMember = guild.members.me;

    if (botMember && !botMember.permissions.has('ManageRoles')) {
      throw new Error(`Bot lacks MANAGE_ROLES permission in guild ${guild.name} (${guildId})`);
    }

    const targetRole = guild.roles.cache.get(roleId);
    if (targetRole && botMember && botMember.roles.highest.position <= targetRole.position) {
      throw new Error(
        `Cannot assign role "${targetRole.name}" — it is at or above bot's highest role in hierarchy`
      );
    }

    const member = await guild.members.fetch(userId);
    await member.roles.add(roleId);
  }

  /**
   * Remove a role via the Discord.js gateway client (pre-flight checks included).
   */
  private async removeRoleViaGateway(
    guildId: string,
    userId: string,
    roleId: string
  ): Promise<void> {
    const guild = await this.client.guilds.fetch(guildId);
    const botMember = guild.members.me;

    if (botMember && !botMember.permissions.has('ManageRoles')) {
      throw new Error(`Bot lacks MANAGE_ROLES permission in guild ${guild.name} (${guildId})`);
    }

    const member = await guild.members.fetch(userId);
    await member.roles.remove(roleId);
  }

  /**
   * Add or remove a member role via the Discord REST API.
   * Used when the gateway client is not connected.
   */
  private async modifyMemberRoleViaRest(
    method: 'PUT' | 'DELETE',
    guildId: string,
    userId: string,
    roleId: string,
    operation: string
  ): Promise<void> {
    const response = await this.discordRestRequest(
      method,
      `/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleId)}`
    );
    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(
        `Discord REST API error (${operation} role ${roleId} for user ${userId} in guild ${guildId}): ${response.status}`,
        { body: errorBody }
      );
      throw this.createRestError(response.status, errorBody, `${operation} role ${roleId}`);
    }
  }

  /**
   * Create a user-safe error from a Discord REST API error response.
   * Parses the Discord error JSON for known codes and returns actionable messages
   * without leaking raw response bodies.
   */
  private createRestError(status: number, rawBody: string, context: string): Error {
    let discordCode: number | undefined;
    let discordMessage: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as { code?: number; message?: string };
      discordCode = parsed.code;
      discordMessage = parsed.message;
    } catch {
      // Not JSON — fall through to generic message
    }

    if (discordCode === 50001 || status === 403) {
      return new Error(
        `Bot does not have access to ${context}. Ensure the bot is a member and has the required permissions.`
      );
    }
    if (discordCode === 50013) {
      return new Error(
        `Bot lacks permissions to ${context}. Check the bot's role hierarchy and permissions.`
      );
    }
    if (discordCode === 10007) {
      return new Error(
        `Member not found when trying to ${context}. The user may have left the server.`
      );
    }
    if (discordCode === 10011) {
      return new Error(`Role not found when trying to ${context}. The role may have been deleted.`);
    }

    const suffix = discordMessage ? `: ${discordMessage}` : '';
    return new Error(`Discord API returned ${status} when trying to ${context}${suffix}`);
  }

  // ========================================
  // ERROR ENHANCEMENT
  // ========================================

  /**
   * Enhance Discord API role errors with actionable messages
   */
  private enhanceRoleError(
    error: unknown,
    operation: 'assign' | 'remove',
    guildId: string,
    userId: string,
    roleId: string
  ): Error {
    if (!(error instanceof Error)) {
      return new Error(`Failed to ${operation} role: Unknown error`);
    }

    const errorMessage = error.message.toLowerCase();
    const errorCode = (error as unknown as Record<string, unknown>).code;

    // Discord API Error Codes
    // 50013 = Missing Permissions
    // 50001 = Missing Access
    // 10011 = Unknown Role
    // 10007 = Unknown Member

    if (errorCode === 50013 || errorMessage.includes('missing permissions')) {
      return new Error(
        `Cannot ${operation} role: Bot lacks "Manage Roles" permission or the target role is higher in the hierarchy than the bot's highest role. ` +
          `Solution: Move the bot's role above the target role in Discord Server Settings > Roles, or grant additional permissions.`
      );
    }

    if (errorCode === 50001 || errorMessage.includes('missing access')) {
      return new Error(
        `Cannot ${operation} role: Bot does not have access to this guild or the member. ` +
          `Solution: Ensure the bot is a member of the server and has proper permissions.`
      );
    }

    if (errorCode === 10011 || errorMessage.includes('unknown role')) {
      return new Error(
        `Cannot ${operation} role: Role ${roleId} not found in guild ${guildId}. ` +
          `The role may have been deleted. Solution: Recreate the role or update the role mapping.`
      );
    }

    if (errorCode === 10007 || errorMessage.includes('unknown member')) {
      return new Error(
        `Cannot ${operation} role: User ${userId} is not a member of guild ${guildId}. ` +
          `The user may have left the server. Solution: Verify the user is still in the Discord server.`
      );
    }

    if (errorMessage.includes('rate limit')) {
      return new Error(
        `Cannot ${operation} role: Discord rate limit exceeded. ` +
          `This operation will be automatically retried. Solution: Reduce the frequency of role operations or wait a moment before trying again.`
      );
    }

    if (errorMessage.includes('hierarchy')) {
      return new Error(
        `Cannot ${operation} role: Role hierarchy issue - the target role is higher than or equal to the bot's highest role. ` +
          `Solution: In Discord Server Settings > Roles, drag the bot's role above all roles it needs to manage.`
      );
    }

    // Return enhanced generic error with context
    return new Error(
      `Failed to ${operation} role ${roleId} for user ${userId} in guild ${guildId}: ${error.message}. ` +
        `Common causes: Missing permissions, role hierarchy issues, or the user/role no longer exists.`
    );
  }

  // ========================================
  // LIFECYCLE
  // ========================================

  /**
   * Disconnect from Discord
   */
  public disconnect(): void {
    void this.client.destroy();
    logger.info('Discord client disconnected');
  }
}

// ========================================
// SINGLETON INSTANCE (for backwards compatibility)
// ========================================

let discordServiceInstance: DiscordService | null = null;

/**
 * Initialize the Discord service singleton
 * @param botToken - Discord bot token
 * @param clientId - Discord OAuth2 client ID
 * @param clientSecret - Discord OAuth2 client secret
 * @param redirectUri - OAuth2 redirect URI
 */
export const initializeDiscordService = (
  botToken: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): DiscordService => {
  discordServiceInstance ??= new DiscordService(botToken, clientId, clientSecret, redirectUri);
  return discordServiceInstance;
};

/**
 * Check if Discord service is initialized
 * @returns True if service is initialized and ready to use
 */
export const isDiscordServiceInitialized = (): boolean => discordServiceInstance !== null;

/**
 * Get the Discord service instance
 * @throws Error if service hasn't been initialized
 */
export const getDiscordService = (): DiscordService => {
  if (!discordServiceInstance) {
    throw new Error('Discord service not initialized. Call initializeDiscordService first.');
  }
  return discordServiceInstance;
};

