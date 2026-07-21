import * as appInsights from 'applicationinsights';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import Joi from 'joi';

import { logger } from '../../utils/logger';
import { cache } from '../../utils/redis';

/**
 * Component from Erkul.games loadout
 */
export interface ErkulComponent {
  slot: string;
  name: string;
  type: string;
  size?: number;
  manufacturer?: string;
  grade?: string;
}

/**
 * Parsed Erkul.games loadout data
 */
export interface ErkulLoadout {
  shipName: string;
  shipManufacturer?: string;
  gameVersion?: string;
  components: ErkulComponent[];
  statistics?: {
    dps?: number;
    burstDps?: number;
    sustainedDps?: number;
    shieldHp?: number;
    hullHp?: number;
    quantumSpeed?: number;
    quantumRange?: number;
    cargoCapacity?: number;
    hydrogenFuel?: number;
    quantumFuel?: number;
  };
  url: string;
  parsedAt: Date;
}

/**
 * Result of importing from Erkul.games
 */
export interface ErkulImportResult {
  success: boolean;
  loadout?: ErkulLoadout;
  error?: string;
}

/**
 * Ship data from Erkul.games
 */
export interface ErkulShipData {
  name: string;
  manufacturer: string;
  manufacturerCode?: string;
  size?: string;
  role?: string;
  roles?: string[];
  crew?: number;
  minCrew?: number;
  maxCrew?: number;
  length?: number;
  beam?: number;
  height?: number;
  mass?: number;
  cargo?: number;
  price?: number;
  speed?: number;
  afterburnerSpeed?: number;
  quantumSpeed?: number;
  quantumFuelCapacity?: number;
  hydrogenFuelCapacity?: number;
  shields?: number;
  armor?: number;
  status?: string;
  isVehicle?: boolean;
  [key: string]: unknown; // Allow additional fields
}

/**
 * Result of fetching ship list from Erkul.games
 */
export interface ErkulShipListResult {
  success: boolean;
  ships?: ErkulShipData[];
  error?: string;
  fetchedAt?: Date;
}

/**
 * Service for integrating with Erkul.games (erkul.games/live/calculator)
 *
 * Erkul.games is a popular Star Citizen ship loadout calculator.
 * This service provides functionality to parse and import loadout data
 * from Erkul.games URLs.
 *
 * Note: This uses URL parsing since Erkul.games doesn't have a public API.
 * The URL structure encodes the ship and component configuration.
 */
export class ErkulGamesService {
  private readonly baseUrl = 'https://www.erkul.games';
  private readonly serverBaseUrl = 'https://server.erkul.games';
  /** Browser-like User-Agent required by Erkul server to avoid bot-detection blocks */
  private readonly browserUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

  /**
   * Erkul rate limit is 40 req / 60s. We voluntarily throttle to >=1.5s
   * between any two outbound requests to stay well under the cap and to
   * be a polite citizen of an unofficial API.
   */
  private static readonly MIN_REQUEST_INTERVAL_MS = 1500;
  private static readonly MAX_RETRY_ATTEMPTS = 3;
  private static readonly MAX_BACKOFF_MS = 8000;
  private static readonly SESSION_TOKEN_CACHE_KEY = 'erkul:session-token';
  /** Token TTL: Erkul tokens are typically valid for ~1h; we cache for 50m */
  private static readonly SESSION_TOKEN_TTL_SECONDS = 3000;

  /**
   * Joi schema used to detect breaking changes in the Erkul ship payload.
   * We only assert on the two fields ShipDataFetcher cannot function
   * without (`name`, `manufacturer`); everything else is allowed and any
   * unknown keys are tolerated so additive Erkul changes do not break us.
   *
   * Erkul ships entries in two shapes that we have to accept:
   *   1. Flat: `{ name, manufacturer, ... }` — used by the legacy
   *      `/ships` endpoint and by tests/fixtures.
   *   2. Wrapped: `{ data: { name, manufacturerData: { data: { name } } } }`
   *      — used by the live `/live/ships` endpoint. We can only assert
   *      `data.name` here because the manufacturer name is two levels deep
   *      and the upstream shape has changed before; `parseShipEntry` does
   *      the deeper unwrap and tolerates a missing manufacturer.
   */
  private static readonly shipSchemaGuard = Joi.alternatives()
    .try(
      Joi.object({
        name: Joi.string().min(1).required(),
        manufacturer: Joi.string().min(1).required(),
      }).unknown(true),
      Joi.object({
        data: Joi.object({
          name: Joi.string().min(1).required(),
        })
          .unknown(true)
          .required(),
      }).unknown(true)
    )
    .required();

  private lastRequestAt = 0;

  constructor() {
    // No setup needed — HTTP requests use bare axios with per-request config
  }

  /**
   * Validate an Erkul.games URL
   */
  isValidErkulUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'erkul.games' || parsed.hostname === 'www.erkul.games';
    } catch {
      return false;
    }
  }

  /**
   * Extract ship name from Erkul.games URL
   *
   * Erkul.games URL format examples:
   * - https://www.erkul.games/live/calculator?ship=CUTLASS_BLACK
   * - https://www.erkul.games/loadout/ABC123
   */
  extractShipName(url: string): string | null {
    try {
      const parsed = new URL(url);

      // Check for ship parameter in calculator URL
      const shipParam = parsed.searchParams.get('ship');
      if (shipParam) {
        // Convert CUTLASS_BLACK -> Cutlass Black
        return shipParam
          .replaceAll(/_/g, ' ')
          .replace(/\b\w/g, char => char.toUpperCase())
          .replace(/\B\w/g, char => char.toLowerCase());
      }

      // For loadout share URLs, ship name requires fetching from server
      return null;
    } catch (error: unknown) {
      logger.error('Error extracting ship name from Erkul URL:', error);
      return null;
    }
  }

  /**
   * Extract loadout ID from an Erkul.games share URL.
   * Returns null if the URL is not a loadout share URL.
   *
   * Example: https://www.erkul.games/loadout/RanfKkrz → 'RanfKkrz'
   */
  extractLoadoutId(url: string): string | null {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/^(?:\/live)?\/loadout\/([a-zA-Z0-9_-]+)$/);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  }

  /**
   * Parse Erkul.games URL to extract loadout information
   *
   * This method parses the URL parameters to extract component data.
   * Note: Full component data may require fetching the actual page.
   */
  async parseErkulUrl(url: string): Promise<ErkulImportResult> {
    if (!this.isValidErkulUrl(url)) {
      return {
        success: false,
        error: 'Invalid Erkul.games URL',
      };
    }

    try {
      // Check if this is a loadout share URL (e.g., /loadout/ABC123)
      const loadoutId = this.extractLoadoutId(url);
      if (loadoutId) {
        return await this.fetchSharedLoadout(loadoutId, url);
      }

      const parsed = new URL(url);
      const components: ErkulComponent[] = [];

      // Extract ship name from calculator URL query params
      const shipName = this.extractShipName(url);
      if (!shipName) {
        return {
          success: false,
          error:
            'Could not determine ship name from URL. Use a calculator URL (https://www.erkul.games/live/calculator?ship=SHIP_NAME) or a loadout share URL (https://www.erkul.games/loadout/ID).',
        };
      }

      // Parse component parameters from URL
      // Erkul.games encodes components in URL params like:
      // power1=PowerPlant_Name&cooler1=Cooler_Name
      const componentPrefixes = [
        'power',
        'cooler',
        'shield',
        'qd',
        'weapon',
        'turret',
        'missile',
        'emp',
        'utility',
      ];

      // Convert searchParams to array to avoid TypeScript iterator compatibility issues
      // URLSearchParams.entries() returns an iterator that requires --downlevelIteration
      // or --target es2015+, so we convert to array first for broader compatibility
      const searchParamsArray = Array.from(parsed.searchParams.entries());
      for (const [key, value] of searchParamsArray) {
        for (const prefix of componentPrefixes) {
          if (key.startsWith(prefix) && value) {
            components.push({
              slot: key,
              name: value.replaceAll(/_/g, ' '),
              type: prefix,
            });
          }
        }
      }

      const loadout: ErkulLoadout = {
        shipName,
        components,
        url,
        parsedAt: new Date(),
      };

      logger.info('Parsed Erkul.games loadout', {
        shipName,
        componentCount: components.length,
      });

      return {
        success: true,
        loadout,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error parsing Erkul.games URL:', error);
      return {
        success: false,
        error: `Failed to parse Erkul URL: ${errorMessage}`,
      };
    }
  }

  /**
   * Fetch a shared loadout from the Erkul server API.
   * Attempts to retrieve loadout data using the Erkul server's loadout endpoint.
   */
  private async fetchSharedLoadout(
    loadoutId: string,
    originalUrl: string
  ): Promise<ErkulImportResult> {
    try {
      const sessionToken = await this.getSessionToken();

      const response = await this.fetchWithRetry(
        `${this.serverBaseUrl}/live/loadout/${loadoutId}`,
        {
          timeout: 15000,
          headers: {
            Accept: 'application/json',
            'User-Agent': this.browserUserAgent,
            Origin: 'https://www.erkul.games',
            Referer: 'https://www.erkul.games/',
            Authorization: `Bearer ${sessionToken}`,
          },
        }
      );

      const data = response.data as Record<string, unknown>;
      return this.parseSharedLoadoutResponse(data, originalUrl);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Failed to fetch shared loadout from Erkul server', {
        loadoutId,
        error: errorMessage,
      });

      return {
        success: false,
        error: `Could not fetch shared loadout "${loadoutId}". The loadout may have expired or been deleted. You can also try the calculator URL format: https://www.erkul.games/live/calculator?ship=SHIP_NAME`,
      };
    }
  }

  /**
   * Parse the response from the Erkul server's shared loadout endpoint.
   */
  private parseSharedLoadoutResponse(
    data: Record<string, unknown>,
    originalUrl: string
  ): ErkulImportResult {
    try {
      // The Erkul server returns loadout data with ship info and components
      const shipName = (data.shipName as string) ?? (data.ship as string) ?? (data.name as string);

      // Try nested data structure (consistent with Erkul server format)
      const nestedData = data.data as Record<string, unknown> | undefined;
      const resolvedShipName =
        shipName ?? (nestedData?.name as string) ?? (nestedData?.shipName as string);

      if (!resolvedShipName) {
        return {
          success: false,
          error:
            'Loadout data does not contain a ship name. The loadout may be invalid or the format is unsupported.',
        };
      }

      // Extract components from the loadout data
      const components: ErkulComponent[] = [];
      const rawComponents =
        (data.components as unknown[]) ??
        (nestedData?.components as unknown[]) ??
        (data.loadout as unknown[]);

      if (Array.isArray(rawComponents)) {
        for (const comp of rawComponents) {
          if (comp && typeof comp === 'object') {
            const c = comp as Record<string, unknown>;
            const slot =
              (c.slot as string) ?? (c.portName as string) ?? (c.itemPortName as string) ?? '';
            const name = (c.name as string) ?? (c.itemName as string) ?? '';
            const type = (c.type as string) ?? (c.category as string) ?? '';
            if (name) {
              components.push({ slot, name, type });
            }
          }
        }
      }

      // Format ship name: CUTLASS_BLACK → Cutlass Black
      const formattedName = resolvedShipName.includes('_')
        ? resolvedShipName
            .replaceAll(/_/g, ' ')
            .replace(/\b\w/g, char => char.toUpperCase())
            .replace(/\B\w/g, char => char.toLowerCase())
        : resolvedShipName;

      const loadout: ErkulLoadout = {
        shipName: formattedName,
        components,
        url: originalUrl,
        parsedAt: new Date(),
      };

      logger.info('Parsed shared Erkul.games loadout', {
        shipName: formattedName,
        componentCount: components.length,
      });

      return { success: true, loadout };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error parsing shared loadout response:', error);
      return {
        success: false,
        error: `Failed to parse shared loadout data: ${errorMessage}`,
      };
    }
  }

  /**
   * Generate an Erkul.games calculator URL for a ship.
   * Accepts optional localName (e.g., "drak_cutlass_black") for accurate URLs.
   */
  generateErkulUrl(shipName: string, components?: ErkulComponent[], localName?: string): string {
    const params = new URLSearchParams();

    // Prefer localName (exact Erkul identifier) over name-based conversion
    const erkulShipName = localName
      ? localName.toUpperCase()
      : shipName.toUpperCase().replaceAll(/\s+/g, '_');

    params.append('ship', erkulShipName);

    // Add component parameters
    if (components) {
      components.forEach(component => {
        const erkulComponentName = component.name.toUpperCase().replaceAll(/\s+/g, '_');
        params.append(component.slot, erkulComponentName);
      });
    }

    return `${this.baseUrl}/live/calculator?${params.toString()}`;
  }

  /**
   * Generate an SPViewer.eu performance URL for a ship.
   * Uses localName (e.g., "drak_cutlass_black") as the ship identifier.
   */
  static generateSpviewerUrl(localName: string): string {
    return `https://www.spviewer.eu/performance?ship=${localName}`;
  }

  /**
   * Validate loadout URL and return parsed data if valid
   */
  async validateAndParse(url: string): Promise<ErkulImportResult> {
    // First validate the URL format
    if (!this.isValidErkulUrl(url)) {
      return {
        success: false,
        error: 'URL is not a valid Erkul.games URL',
      };
    }

    // Try to parse the URL
    return this.parseErkulUrl(url);
  }

  /**
   * Get common component types used in Erkul.games
   */
  getComponentTypes(): string[] {
    return [
      'power_plant',
      'cooler',
      'shield_generator',
      'quantum_drive',
      'weapon',
      'turret',
      'missile_rack',
      'utility',
      'armor',
      'scanner',
      'radar',
      'mining_laser',
      'tractor_beam',
    ];
  }

  /**
   * Obtain a session token from the Erkul server API.
   * The /informations endpoint returns a JWT required for subsequent data requests.
   *
   * Tokens are cached in Redis for ~50 minutes to avoid hammering /informations
   * on every fetch and to share the token across processes/replicas. Cache
   * failures fall through to a live fetch — Redis is treated as a best-effort
   * accelerator, never a hard dependency.
   */
  private async getSessionToken(): Promise<string> {
    try {
      const cached = await cache.get<string>(ErkulGamesService.SESSION_TOKEN_CACHE_KEY);
      if (cached && typeof cached === 'string' && cached.length > 0) {
        return cached;
      }
    } catch (error: unknown) {
      logger.debug('Erkul session token cache lookup failed, fetching fresh token', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const response = await this.fetchWithRetry(`${this.serverBaseUrl}/informations`, {
      timeout: 15000,
      headers: {
        Accept: 'application/json',
        'User-Agent': this.browserUserAgent,
        Origin: 'https://www.erkul.games',
        Referer: 'https://www.erkul.games/',
      },
    });

    const token = this.extractSessionToken(response.data);
    if (!token) {
      logger.warn('Unexpected Erkul /informations response format', {
        type: typeof response.data,
        isArray: Array.isArray(response.data),
        keys:
          response.data && typeof response.data === 'object'
            ? Object.keys(response.data as Record<string, unknown>)
            : [],
      });
      throw new Error(
        'No session token returned from Erkul server — API response format may have changed'
      );
    }

    try {
      await cache.set(
        ErkulGamesService.SESSION_TOKEN_CACHE_KEY,
        token,
        ErkulGamesService.SESSION_TOKEN_TTL_SECONDS
      );
    } catch (error: unknown) {
      logger.debug('Failed to cache Erkul session token', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return token;
  }

  /**
   * Pull a session token out of the various shapes Erkul has returned over time.
   */
  private extractSessionToken(data: unknown): string | null {
    if (Array.isArray(data)) {
      for (const entry of data) {
        if (
          entry &&
          typeof entry === 'object' &&
          typeof (entry as { sessionToken?: unknown }).sessionToken === 'string'
        ) {
          return (entry as { sessionToken: string }).sessionToken;
        }
      }
    }

    if (
      data &&
      typeof data === 'object' &&
      typeof (data as { sessionToken?: unknown }).sessionToken === 'string'
    ) {
      return (data as { sessionToken: string }).sessionToken;
    }

    if (
      data &&
      typeof data === 'object' &&
      (data as { data?: unknown }).data &&
      typeof (data as { data: { sessionToken?: unknown } }).data.sessionToken === 'string'
    ) {
      return (data as { data: { sessionToken: string } }).data.sessionToken;
    }

    return null;
  }

  /**
   * Voluntarily throttle outbound Erkul requests to stay well under the
   * documented 40 req / 60s rate limit and avoid bursting after retries.
   */
  private async throttle(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt;
    const wait = ErkulGamesService.MIN_REQUEST_INTERVAL_MS - elapsed;
    if (wait > 0) {
      await new Promise<void>(resolve => {
        setTimeout(resolve, wait);
      });
    }
    this.lastRequestAt = Date.now();
  }

  /**
   * axios.get wrapper with throttling and exponential backoff.
   *
   * Retries on transient HTTP failures (429 Too Many Requests, 503 Service
   * Unavailable) up to {@link ErkulGamesService.MAX_RETRY_ATTEMPTS} times,
   * sleeping `min(2^attempt * 1000, 8000)` ms between attempts. All other
   * errors propagate to the caller unchanged.
   */
  private async fetchWithRetry(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse> {
    let lastError: unknown;

    for (let attempt = 0; attempt < ErkulGamesService.MAX_RETRY_ATTEMPTS; attempt++) {
      await this.throttle();
      try {
        return await axios.get(url, config);
      } catch (error: unknown) {
        lastError = error;
        const status = error instanceof AxiosError ? error.response?.status : undefined;
        const isRetryable = status === 429 || status === 503;
        const isFinalAttempt = attempt === ErkulGamesService.MAX_RETRY_ATTEMPTS - 1;

        if (!isRetryable || isFinalAttempt) {
          throw error;
        }

        const backoffMs = Math.min(2 ** attempt * 1000, ErkulGamesService.MAX_BACKOFF_MS);
        logger.warn('Erkul request failed with retryable status, backing off', {
          url,
          status,
          attempt: attempt + 1,
          backoffMs,
        });
        await new Promise<void>(resolve => {
          setTimeout(resolve, backoffMs);
        });
      }
    }

    // Unreachable: loop either returns or throws.
    throw lastError instanceof Error ? lastError : new Error('Erkul request failed after retries');
  }

  /**
   * Fetch ship list data from Erkul.games server API.
   *
   * Uses the server.erkul.games backend:
   * 1. GET /informations → obtain a session JWT
   * 2. GET /live/ships with Bearer token → 208 ships (16 MB JSON)
   *
   * Rate limit: 40 requests per 60 seconds.
   */
  async fetchShipList(): Promise<ErkulShipListResult> {
    try {
      logger.info('Fetching ship list from Erkul.games server API...');

      // Step 1: Obtain session token
      const sessionToken = await this.getSessionToken();
      logger.debug('Erkul session token obtained');

      // Step 2: Fetch ships with Bearer auth
      const response = await this.fetchWithRetry(`${this.serverBaseUrl}/live/ships`, {
        timeout: 60000, // 60s — response is ~16 MB
        headers: {
          Accept: 'application/json',
          'User-Agent': this.browserUserAgent,
          Origin: 'https://www.erkul.games',
          Referer: 'https://www.erkul.games/live/ships',
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      // Check if response is JSON
      const rawContentType = response.headers['content-type'];
      const contentType =
        typeof rawContentType === 'string'
          ? rawContentType
          : Array.isArray(rawContentType)
            ? rawContentType.join(',')
            : '';
      if (!contentType.includes('application/json')) {
        logger.warn('Erkul server returned non-JSON response', {
          contentType,
          statusCode: response.status,
        });
        return {
          success: false,
          error: `Expected JSON response but got ${contentType}`,
        };
      }

      // Parse ship data from the Erkul server format
      const ships = this.parseShipData(response.data);

      if (ships.length === 0) {
        logger.warn('No ships found in Erkul server response');
        return {
          success: false,
          error: 'No ships found in response data',
        };
      }

      logger.info(`Successfully fetched ${ships.length} ships from Erkul.games server API`);

      return {
        success: true,
        ships,
        fetchedAt: new Date(),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error fetching ship list from Erkul.games server API:', error);

      return {
        success: false,
        error: `Failed to fetch ship list: ${errorMessage}`,
      };
    }
  }

  /**
   * Parse ship data from Erkul.games response
   * Handles various possible data structures
   *
   * @param data - Raw response data from Erkul.games
   * @returns Array of parsed ship data
   */
  private parseShipData(data: unknown): ErkulShipData[] {
    const ships: ErkulShipData[] = [];

    try {
      // Handle different possible data structures
      let shipArray: unknown[] = [];

      if (Array.isArray(data)) {
        // Data is directly an array
        shipArray = data;
      } else if (
        data &&
        typeof data === 'object' &&
        'ships' in data &&
        Array.isArray((data as Record<string, unknown>).ships)
      ) {
        // Data has a 'ships' property
        shipArray = (data as Record<string, unknown>).ships as unknown[];
      } else if (
        data &&
        typeof data === 'object' &&
        'data' in data &&
        Array.isArray((data as Record<string, unknown>).data)
      ) {
        // Data has a 'data' property
        shipArray = (data as Record<string, unknown>).data as unknown[];
      } else if (data && typeof data === 'object' && data !== null) {
        // Data might be an object with ship entries
        shipArray = Object.values(data as Record<string, unknown>);
      }

      // Schema-change guard: validate the first few entries against the
      // minimal contract ShipDataFetcher relies on. If Erkul ships a
      // breaking change (e.g. renames `name`), we abort the whole fetch
      // before mass-corrupting our catalogue and surface a telemetry event
      // so the on-call engineer is paged.
      this.validateShipPayloadShape(shipArray);

      // Parse each ship entry
      for (const shipData of shipArray) {
        try {
          const parsedShip = this.parseShipEntry(shipData);
          if (parsedShip) {
            ships.push(parsedShip);
          }
        } catch (error: unknown) {
          logger.warn('Failed to parse ship entry', { shipData, error });
        }
      }
    } catch (error: unknown) {
      logger.error('Error parsing ship data structure:', error);
    }

    return ships;
  }

  /**
   * Validate that the first batch of ship entries still match the minimal
   * shape ShipDataFetcher requires (`name` and `manufacturer`). Any failure
   * is treated as a schema-change incident: log + AppInsights event + throw,
   * which causes ShipDataFetcher to abort the run with no DB writes.
   *
   * Only the first 5 entries are checked to keep the cost negligible while
   * still catching wholesale renames or response wrappers.
   */
  private validateShipPayloadShape(shipArray: unknown[]): void {
    if (shipArray.length === 0) {
      // Empty payload is handled elsewhere (treated as a fetch failure).
      return;
    }

    const sampleSize = Math.min(5, shipArray.length);
    for (let i = 0; i < sampleSize; i++) {
      const { error } = ErkulGamesService.shipSchemaGuard.validate(shipArray[i], {
        abortEarly: true,
        allowUnknown: true,
      });
      if (error) {
        const message = `Erkul ship payload failed schema guard at index ${i}: ${error.message}`;
        logger.error(message, {
          index: i,
          sampleKeys:
            shipArray[i] && typeof shipArray[i] === 'object'
              ? Object.keys(shipArray[i] as Record<string, unknown>)
              : [],
        });
        try {
          appInsights.defaultClient?.trackEvent({
            name: 'ErkulSchemaValidationFailed',
            properties: {
              index: String(i),
              error: error.message,
            },
          });
        } catch {
          // Telemetry must never break the job; ignore.
        }
        throw new Error(message);
      }
    }
  }

  /**
   * Fields that are mapped to the Ship model
   * Used to identify extra fields that should be stored in metadata
   */
  private static readonly MAPPED_SHIP_FIELDS = new Set([
    'name',
    'manufacturer',
    'manufacturerCode',
    'description',
    'role',
    'roles',
    'size',
    'status',
    'crew',
    'minCrew',
    'maxCrew',
    'length',
    'beam',
    'height',
    'mass',
    'cargo',
    'vehicleCargo',
    'price',
    'pledgePrice',
    'speed',
    'afterburnerSpeed',
    'quantumSpeed',
    'quantumFuelCapacity',
    'hydrogenFuelCapacity',
    'shields',
    'armor',
    'hangarSize',
    'loanerShip',
    'variants',
    'isVehicle',
    'type',
    'shipName',
    'Name',
    'make',
    'Manufacturer',
    'manufacturer_name',
    'manufacturerName',
    'manufacturer_code',
    'code',
    'Size',
    'Role',
    'focus',
    'Roles',
    'Crew',
    'max_crew',
    'MaxCrew',
    'min_crew',
    'MinCrew',
    'Length',
    'Beam',
    'width',
    'Width',
    'Height',
    'Mass',
    'weight',
    'Cargo',
    'cargoCapacity',
    'cargo_capacity',
    'Price',
    'inGamePrice',
    'in_game_price',
    'Speed',
    'scmSpeed',
    'scm_speed',
    'maxSpeed',
    'max_speed',
    'afterburner_speed',
    'quantum_speed',
    'quantum_fuel_capacity',
    'quantumFuel',
    'hydrogen_fuel_capacity',
    'hydrogenFuel',
    'Shields',
    'shieldHp',
    'shield_hp',
    'Armor',
    'hullHp',
    'hull_hp',
    'Status',
    'production_status',
    'is_vehicle',
  ]);

  /**
   * Parse a single ship entry from the Erkul server API.
   *
   * Erkul server format:
   * ```json
   * {
   *   "calculatorType": "ship",
   *   "localName": "aegs_avenger_titan",
   *   "data": {
   *     "name": "Avenger Titan",
   *     "description": "...",
   *     "size": 2,
   *     "cargo": 8,
   *     "fuelCapacity": 9,
   *     "qtFuelCapacity": 1.1,
   *     "hull": { "mass": 48986 },
   *     "ifcs": { "scmSpeed": 262, "maxSpeed": 1425 },
   *     "vehicle": { "career": "Transporter", "role": "Light Freight", "crewSize": 1 },
   *     "manufacturerData": { "data": { "name": "Aegis Dynamics" } }
   *   }
   * }
   * ```
   */
  private parseShipEntry(entry: unknown): ErkulShipData | null {
    if (!entry || typeof entry !== 'object') {
      return null;
    }

    const record = entry as Record<string, unknown>;

    // Erkul server API format: { calculatorType, localName, data: { ... } }
    if (record.calculatorType === 'ship' && record.data && typeof record.data === 'object') {
      return this.parseErkulServerEntry(record);
    }

    // Legacy flat format fallback (CSV/other sources)
    return this.parseFlatShipEntry(record);
  }

  /**
   * Parse a ship entry in the Erkul server API nested format.
   */
  private parseErkulServerEntry(record: Record<string, unknown>): ErkulShipData | null {
    const data = record.data as Record<string, unknown>;
    const name = data.name as string | undefined;
    if (!name) {
      return null;
    }

    // Extract manufacturer from nested manufacturerData
    const mfData = data.manufacturerData as
      | { data?: { name?: string; shortName?: string } }
      | undefined;
    const manufacturer = mfData?.data?.name || 'Unknown';

    // Extract vehicle metadata
    const vehicle = data.vehicle as
      | {
          career?: string;
          role?: string;
          crewSize?: number;
          size?: unknown;
        }
      | undefined;

    // Extract flight/speed data
    const ifcs = data.ifcs as
      | {
          scmSpeed?: number;
          maxSpeed?: number;
          boostSpeedForward?: number;
        }
      | undefined;

    // Extract hull data
    const hull = data.hull as { mass?: number; totalHp?: number } | undefined;

    // Map Erkul numeric size to text size
    const numericSize = data.size as number | undefined;
    let sizeStr: string | undefined;
    if (numericSize !== undefined) {
      switch (numericSize) {
        case 1:
          sizeStr = 'snub';
          break;
        case 2:
          sizeStr = 'small';
          break;
        case 3:
          sizeStr = 'medium';
          break;
        case 4:
          sizeStr = 'large';
          break;
        case 5:
          sizeStr = 'sub_capital';
          break;
        case 6:
          sizeStr = 'capital';
          break;
        default:
          sizeStr = numericSize <= 1 ? 'snub' : 'capital';
          break;
      }
    }

    // Determine if vehicle
    const subType = data.subType as string | undefined;
    const isVehicle = subType === 'Vehicle_GroundVehicle';
    if (isVehicle && sizeStr) {
      sizeStr = 'vehicle';
    }

    // Extract hardpoints from loadout slots
    const loadout = data.loadout as Record<string, Record<string, unknown>> | undefined;
    const hardpoints: Array<{ type: string; size: number; location: string }> = [];
    const weapons: Array<{ type: string; size: number; count: number }> = [];

    if (loadout) {
      const weaponCounts = new Map<string, { type: string; size: number; count: number }>();

      for (const val of Object.values(loadout)) {
        const editable = Boolean(val?.editable);
        if (!editable) {
          continue;
        }

        const itemTypes = val?.itemTypes as Array<{ type: string }> | undefined;
        const type = itemTypes?.[0]?.type;
        const portName = String(val?.itemPortName || '');
        const maxSize = Number(val?.maxSize || 0);

        if (!type || type === 'Paints' || type === 'Flair_Cockpit' || type === 'SeatAccess') {
          continue;
        }

        hardpoints.push({ type, size: maxSize, location: portName });

        // Aggregate weapons (turrets + missile launchers)
        if (type === 'Turret' || type === 'MissileLauncher' || type === 'WeaponGun') {
          const key = `${type}-S${maxSize}`;
          const existing = weaponCounts.get(key);
          if (existing) {
            existing.count++;
          } else {
            weaponCounts.set(key, { type, size: maxSize, count: 1 });
          }
        }
      }

      weapons.push(...weaponCounts.values());
    }

    const localName = record.localName as string;

    const shipData: ErkulShipData = {
      name: String(name).trim(),
      manufacturer: String(manufacturer).trim(),
      manufacturerCode: mfData?.data?.shortName,
      description: data.description,
      role: vehicle?.role,
      size: sizeStr,
      crew: vehicle?.crewSize,
      mass: hull?.mass,
      cargo: data.cargo as number | undefined,
      speed: ifcs?.scmSpeed,
      afterburnerSpeed: ifcs?.maxSpeed,
      hydrogenFuelCapacity: data.fuelCapacity as number | undefined,
      quantumFuelCapacity: data.qtFuelCapacity as number | undefined,
      isVehicle,
      // Enriched fields from Erkul
      localName,
      career: vehicle?.career,
      hardpoints: hardpoints.length > 0 ? hardpoints : undefined,
      weapons: weapons.length > 0 ? weapons : undefined,
    };

    return shipData;
  }

  /**
   * Parse a flat ship entry (legacy CSV / other source format).
   */
  private parseFlatShipEntry(entryRecord: Record<string, unknown>): ErkulShipData | null {
    const name =
      entryRecord.name || entryRecord.shipName || entryRecord.Name || entryRecord.ship_name;
    if (!name) {
      return null;
    }

    const manufacturer =
      entryRecord.manufacturer ||
      entryRecord.make ||
      entryRecord.Manufacturer ||
      entryRecord.manufacturerName ||
      entryRecord.manufacturer_name;
    if (!manufacturer) {
      return null;
    }

    const shipData: ErkulShipData = {
      name: String(name).trim(),
      manufacturer: String(manufacturer).trim(),
    };

    if (entryRecord.manufacturerCode || entryRecord.manufacturer_code || entryRecord.code) {
      shipData.manufacturerCode = String(
        entryRecord.manufacturerCode || entryRecord.manufacturer_code || entryRecord.code
      ).trim();
    }

    if (entryRecord.size || entryRecord.Size) {
      shipData.size = String(entryRecord.size || entryRecord.Size)
        .toLowerCase()
        .trim();
    }

    if (entryRecord.role || entryRecord.Role || entryRecord.focus) {
      shipData.role = String(entryRecord.role || entryRecord.Role || entryRecord.focus).trim();
    }

    const numericFields: Array<[keyof ErkulShipData, string[]]> = [
      ['crew', ['crew', 'Crew', 'maxCrew', 'max_crew']],
      ['minCrew', ['minCrew', 'min_crew', 'MinCrew']],
      ['maxCrew', ['maxCrew', 'max_crew', 'MaxCrew']],
      ['mass', ['mass', 'Mass', 'weight']],
      ['cargo', ['cargo', 'Cargo', 'cargoCapacity', 'cargo_capacity']],
      ['speed', ['speed', 'Speed', 'scmSpeed', 'scm_speed']],
      ['afterburnerSpeed', ['afterburnerSpeed', 'afterburner_speed', 'maxSpeed', 'max_speed']],
      ['quantumFuelCapacity', ['quantumFuelCapacity', 'quantum_fuel_capacity', 'quantumFuel']],
      ['hydrogenFuelCapacity', ['hydrogenFuelCapacity', 'hydrogen_fuel_capacity', 'hydrogenFuel']],
    ];

    for (const [field, possibleKeys] of numericFields) {
      for (const key of possibleKeys) {
        if (
          entryRecord[key] !== undefined &&
          entryRecord[key] !== null &&
          entryRecord[key] !== ''
        ) {
          const value =
            typeof entryRecord[key] === 'number'
              ? entryRecord[key]
              : Number.parseFloat(String(entryRecord[key]).replaceAll(/[^0-9.-]/g, ''));
          if (!Number.isNaN(value)) {
            (shipData as Record<string, unknown>)[field as string] = value;
            break;
          }
        }
      }
    }

    if (entryRecord.isVehicle !== undefined) {
      shipData.isVehicle = Boolean(entryRecord.isVehicle);
    } else if (entryRecord.type) {
      shipData.isVehicle = String(entryRecord.type).toLowerCase().includes('vehicle');
    }

    return shipData;
  }
}

// Export singleton instance
export const erkulGamesService = new ErkulGamesService();

