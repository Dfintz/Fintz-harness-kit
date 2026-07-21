import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import NodeCache from 'node-cache';

import { logger } from '../../utils/logger';
import { validateRsiIdentifier } from '../../utils/rsiValidation';

/**
 * RSI Organization data structure
 */
export interface RsiOrgData {
  sid: string;
  name: string;
  description?: string;
  history?: string;
  manifesto?: string;
  charter?: string;
  banner?: string;
  logo?: string;
  archetype?: string;
  commitment?: string;
  roleplay?: string;
  memberCount: number;
  affiliateCount: number;
  focus?: {
    primary?: string;
    secondary?: string;
  };
  recruiting?: string;
  language?: string;
  exclusive?: string;
  links?: {
    website?: string;
    discord?: string;
    youtube?: string;
    twitch?: string;
  };
}

/**
 * RSI Member data structure
 */
export interface RsiMemberData {
  handle: string;
  displayName?: string;
  rank?: string;
  stars: number;
  rankNumber?: number;
  isMain: boolean;
  isAffiliate: boolean;
  isHidden: boolean;
  avatar?: string;
  enlisted?: string;
  roles?: string[];
}

/**
 * RSI Citizen profile data (full profile from /citizens/{handle})
 * Matches the subset of fields available through SENTRY v1 API
 */
export interface RsiCitizenData {
  handle: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  citizenRecord?: string;
  title?: string;
  enlisted?: string;
  fluency?: string;
  location?: string;
  website?: string;
}

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

/**
 * Rate limiter using token bucket algorithm
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(maxTokens: number = 5, refillRate: number = 1) {
    this.maxTokens = maxTokens;
    this.tokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  public tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }

  public getWaitTime(): number {
    if (this.tokens >= 1) {
      return 0;
    }
    return Math.max(0, Math.ceil(((1 - this.tokens) / this.refillRate) * 1000));
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;
    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

/**
 * RSI Web Crawler Service — primary data source
 * Fetches organization and member data directly from RSI website.
 * The SENTRY v1 API (RSIApiService) serves as the backup when the
 * crawler is unavailable.
 */
export class RsiCrawlerService {
  private baseUrl: string;
  private timeout: number;
  private cache: NodeCache;
  private axiosInstance: AxiosInstance;
  private rateLimiter: RateLimiter;

  // Circuit breaker state
  private circuitState: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number = 5;
  private readonly openDuration: number = 60000; // 60 seconds

  constructor() {
    this.baseUrl = 'https://robertsspaceindustries.com';
    this.timeout = parseInt(process.env.RSI_CRAWLER_TIMEOUT ?? '30000');

    // Cache for 1 hour by default (3600 seconds)
    this.cache = new NodeCache({
      stdTTL: parseInt(process.env.RSI_CRAWLER_CACHE_TTL ?? '3600'),
      checkperiod: 120,
    });

    const defaultUserAgent =
      process.env.RSI_CRAWLER_USER_AGENT ??
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

    this.axiosInstance = axios.create({
      timeout: this.timeout,
      headers: {
        'User-Agent': defaultUserAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    // Rate limiter: burst of 5 requests, refills at 1 token/second
    const maxRequests = parseInt(process.env.RSI_CRAWLER_RATE_LIMIT ?? '5');
    const refillRate = parseFloat(process.env.RSI_CRAWLER_RATE_REFILL ?? '1');
    this.rateLimiter = new RateLimiter(maxRequests, refillRate);

    logger.info('RSI Crawler Service initialized with rate limiting and circuit breaker');
  }

  /**
   * Check if circuit breaker allows request
   */
  private checkCircuitBreaker(): void {
    const now = Date.now();

    if (this.circuitState === CircuitState.OPEN) {
      if (now - this.lastFailureTime >= this.openDuration) {
        logger.info('RSI Crawler circuit breaker transitioning to half-open');
        this.circuitState = CircuitState.HALF_OPEN;
      } else {
        const waitTime = this.openDuration - (now - this.lastFailureTime);
        throw new Error(
          `RSI Crawler circuit breaker is OPEN. Try again in ${Math.ceil(waitTime / 1000)} seconds`
        );
      }
    }
  }

  /**
   * Record a successful request
   */
  private recordSuccess(): void {
    if (this.circuitState === CircuitState.HALF_OPEN) {
      logger.info('RSI Crawler circuit breaker closing after successful recovery');
      this.circuitState = CircuitState.CLOSED;
      this.failures = 0;
    } else if (this.circuitState === CircuitState.CLOSED) {
      this.failures = 0;
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.circuitState === CircuitState.HALF_OPEN) {
      logger.warn('RSI Crawler circuit breaker reopening after half-open failure');
      this.circuitState = CircuitState.OPEN;
    } else if (this.failures >= this.failureThreshold) {
      logger.warn(`RSI Crawler circuit breaker opening after ${this.failures} failures`);
      this.circuitState = CircuitState.OPEN;
    }
  }

  /**
   * Check rate limit before making request
   */
  private async checkRateLimit(): Promise<void> {
    if (!this.rateLimiter.tryConsume()) {
      const waitTime = this.rateLimiter.getWaitTime();
      logger.debug(`RSI Crawler rate limit hit, waiting ${waitTime}ms`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      // Try again after waiting
      if (!this.rateLimiter.tryConsume()) {
        throw new Error('RSI Crawler rate limit exceeded');
      }
    }
  }

  /**
   * Crawl organization data from RSI website
   * @param sid - Organization SID (e.g., "TEST")
   * @returns Promise resolving to organization data
   */
  public async crawlOrganization(sid: string): Promise<RsiOrgData> {
    validateRsiIdentifier(sid, 'organization SID');
    const cacheKey = `org:${sid}`;

    // Check cache first
    const cached = this.cache.get<RsiOrgData>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for organization: ${sid}`);
      return cached;
    }

    try {
      this.checkCircuitBreaker();
      await this.checkRateLimit();

      const url = `${this.baseUrl}/orgs/${sid}`;
      logger.debug(`Crawling organization from RSI: ${url}`);

      const response = await this.axiosInstance.get<string>(url);
      const $ = cheerio.load(response.data);

      // Parse organization data from HTML
      // The h1 contains "Full Name / <span class="symbol">TAG</span>"
      // Extract just the full name portion before the " / TAG" suffix
      const rawName = this.extractText($, '.heading h1');
      const orgName = rawName
        ? rawName.replace(/\s*\/\s*\S+\s*$/, '').trim() || sid.toUpperCase()
        : sid.toUpperCase();
      const parsedMemberCount =
        this.extractNumber($, '.count .value', 0) ?? this.extractCountFromPageText($, 'members');
      const parsedAffiliateCount =
        this.extractNumber($, '.count .value', 1) ?? this.extractCountFromPageText($, 'affiliates');

      const orgData: RsiOrgData = {
        sid: sid.toUpperCase(),
        name: orgName,
        memberCount: parsedMemberCount ?? 0,
        affiliateCount: parsedAffiliateCount ?? 0,
        description: this.extractText($, '.info .entry'),
        history: this.extractOrgTabContent($, 'history'),
        manifesto: this.extractOrgTabContent($, 'manifesto'),
        charter: this.extractOrgTabContent($, 'charter'),
        banner: this.extractImageUrl($, '.banner img'),
        logo: this.extractImageUrl($, '.logo img'),
        focus: {
          primary: this.extractText($, '.focus .primary'),
          secondary: this.extractText($, '.focus .secondary'),
        },
        recruiting: this.extractText($, '.recruiting'),
        language: this.extractText($, '.language'),
        exclusive: this.extractText($, '.exclusive'),
      };

      // Extract social links
      const links: Record<string, string> = {};
      $('.links a').each((_, elem) => {
        const href = $(elem).attr('href');
        const text = $(elem).text().toLowerCase();
        if (href) {
          if (text.includes('website') || text.includes('web')) {
            links.website = href;
          } else if (text.includes('discord')) {
            links.discord = href;
          } else if (text.includes('youtube')) {
            links.youtube = href;
          } else if (text.includes('twitch')) {
            links.twitch = href;
          }
        }
      });
      if (Object.keys(links).length > 0) {
        orgData.links = links;
      }

      this.recordSuccess();
      this.cache.set(cacheKey, orgData);

      logger.info(`Successfully crawled organization: ${sid}`);
      return orgData;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        !error.message.includes('circuit breaker') &&
        !error.message.includes('rate limit')
      ) {
        this.recordFailure();
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const logPayload = {
          status,
          message: error.message,
        };

        if (this.isControlPathErrorMessage(error.message, status)) {
          logger.warn(`Failed to crawl organization ${sid} (degraded control path):`, logPayload);
        } else {
          logger.error(`Failed to crawl organization ${sid}:`, logPayload);
        }

        throw new Error(`Failed to crawl organization: ${status ?? error.message}`);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.isControlPathErrorMessage(errorMessage)) {
        logger.warn(`Failed to crawl organization ${sid}: ${errorMessage}`);
      } else {
        logger.error(`Failed to crawl organization ${sid}: ${errorMessage}`);
      }

      throw new Error(`Failed to crawl organization: ${errorMessage}`);
    }
  }

  /**
   * Crawl organization members from RSI website
   * @param sid - Organization SID
   * @param page - Page number (1-indexed)
   * @returns Promise resolving to array of member data
   */
  public async crawlOrganizationMembers(sid: string, page: number = 1): Promise<RsiMemberData[]> {
    validateRsiIdentifier(sid, 'organization SID');
    const cacheKey = `members:${sid}:${page}`;

    // Check cache first
    const cached = this.cache.get<RsiMemberData[]>(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for organization members: ${sid} page ${page}`);
      return cached;
    }

    try {
      this.checkCircuitBreaker();
      await this.checkRateLimit();

      const url = `${this.baseUrl}/orgs/${sid}/members`;
      logger.debug(`Crawling organization members from RSI: ${url}?page=${page}`);

      const response = await this.axiosInstance.get<string>(url, {
        params: { page },
      });
      const $ = cheerio.load(response.data);

      const members: RsiMemberData[] = [];

      // Parse member data from HTML
      // RSI member card structure (as of 2026):
      //   li.member-item > a.membercard[href="/citizens/{handle}"]
      //     span.thumb > img (avatar)
      //     span.right >
      //       span.roles > span.title ("Affiliate" or role text)
      //       span.frontinfo >
      //         span.name-wrap >
      //           span.name.data4 (display name)
      //           span.nick.data2 (handle)
      //         span.ranking-stars > span.stars[style="width: N%"]
      //         span.rank (rank title)
      $('.member-item').each((_, elem) => {
        const $elem = $(elem);

        // Handle: prefer .nick, fall back to parsing the citizen link href
        let handle = this.extractText($elem, '.nick') ?? '';
        if (!handle) {
          const href = $elem.find('a.membercard').attr('href') ?? '';
          const citizenMatch = href.match(/\/citizens\/([^/]+)/);
          if (citizenMatch) {
            handle = citizenMatch[1];
          }
        }

        // Affiliate detection: RSI puts "Affiliate" in .roles .title
        const overlayTitle = (this.extractText($elem, '.roles .title') ?? '').toLowerCase();
        const isAffiliate = overlayTitle.includes('affiliate');

        // Role extraction: RSI puts role names in .roles .role elements
        // e.g., <span class="role">CEO</span>
        const memberRoles: string[] = [];
        $elem.find('.roles .role, .roles span:not(.title)').each((_, roleElem) => {
          const roleText = $(roleElem).text().trim();
          if (roleText && !['roles', 'affiliate'].includes(roleText.toLowerCase())) {
            memberRoles.push(roleText);
          }
        });

        const member: RsiMemberData = {
          handle,
          displayName: this.extractText($elem, '.name'),
          rank: this.extractText($elem, '.rank'),
          stars: this.extractStars($elem),
          rankNumber: this.extractStars($elem) || undefined,
          isMain: !isAffiliate,
          isAffiliate,
          isHidden: $elem.hasClass('hidden') || $elem.find('.hidden').length > 0,
          avatar: this.extractImageUrl($elem, '.thumb img'),
          enlisted: this.extractText($elem, '.enlisted'),
          roles: memberRoles.length > 0 ? memberRoles : undefined,
        };

        if (member.handle) {
          members.push(member);
        }
      });

      this.recordSuccess();
      this.cache.set(cacheKey, members);

      logger.info(
        `Successfully crawled ${members.length} members from organization: ${sid} page ${page}`
      );
      return members;
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        !error.message.includes('circuit breaker') &&
        !error.message.includes('rate limit')
      ) {
        this.recordFailure();
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const logPayload = {
          status,
          message: error.message,
        };

        if (this.isControlPathErrorMessage(error.message, status)) {
          logger.warn(`Failed to crawl members for ${sid} (degraded control path):`, logPayload);
        } else {
          logger.error(`Failed to crawl members for ${sid}:`, logPayload);
        }

        throw new Error(`Failed to crawl members: ${status ?? error.message}`);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (this.isControlPathErrorMessage(errorMessage)) {
        logger.warn(`Failed to crawl members for ${sid}: ${errorMessage}`);
      } else {
        logger.error(`Failed to crawl members for ${sid}: ${errorMessage}`);
      }

      throw new Error(`Failed to crawl members: ${errorMessage}`);
    }
  }

  /**
   * Crawl user's organization memberships
   * @param handle - User handle
   * @returns Promise resolving to array of organization memberships
   */
  public async crawlUserMemberships(
    handle: string
  ): Promise<Array<{ sid: string; name: string; rank?: string; stars: number; isMain: boolean }>> {
    validateRsiIdentifier(handle, 'citizen handle');
    const cacheKey = `user:${handle}:orgs`;

    // Check cache first
    const cached =
      this.cache.get<
        Array<{ sid: string; name: string; rank?: string; stars: number; isMain: boolean }>
      >(cacheKey);
    if (cached) {
      logger.debug(`Cache hit for user memberships: ${handle}`);
      return cached;
    }

    try {
      this.checkCircuitBreaker();
      await this.checkRateLimit();

      const citizenUrl = `${this.baseUrl}/citizens/${handle}`;
      const orgsUrl = `${this.baseUrl}/citizens/${handle}/organizations`;
      logger.debug(`Crawling user memberships from RSI: ${citizenUrl} + ${orgsUrl}`);

      // Fetch both pages (citizen page for main org, organizations page for affiliates)
      const [citizenResponse, orgsResponse] = await Promise.all([
        this.axiosInstance.get<string>(citizenUrl),
        this.axiosInstance.get<string>(orgsUrl).catch(() => null), // Optional — may 404
      ]);

      const $ = cheerio.load(citizenResponse.data);

      const memberships: Array<{
        sid: string;
        name: string;
        rank?: string;
        stars: number;
        isMain: boolean;
      }> = [];

      // ── 1. Parse main org from citizen profile page (.main-org) ──
      // NOT .org-item which doesn't exist on citizen pages.
      let mainOrgRedacted = false;

      const parseOrgSection = (selector: string, isMain: boolean): void => {
        $(selector).each((_, elem) => {
          const $elem = $(elem);

          // Check if this is an empty section ("NO MAIN ORG FOUND IN PUBLIC RECORDS")
          if ($elem.find('.empty').length > 0) {
            if (isMain) {
              mainOrgRedacted = true; // Mark that main org exists but is hidden
            }
            return;
          }

          // Extract SID from the link to the org page: <a href="/orgs/FRINAUTS">
          let sid = '';
          const orgLink = $elem.find('a[href*="/orgs/"]').first().attr('href');
          if (orgLink) {
            const match = orgLink.match(/\/orgs\/([A-Za-z0-9_-]+)/);
            if (match) {
              sid = match[1];
            }
          }

          // Extract name from the first <a> with class "value" inside .info
          const name =
            $elem.find('.info a.value').first().text().trim() ||
            $elem.find('a[href*="/orgs/"]').first().text().trim();

          // Extract rank from the <strong class="value"> after "Organization rank" label
          let rank: string | undefined;
          $elem.find('.entry').each((__, entryElem) => {
            const $entry = $(entryElem);
            const label = $entry.find('.label').text().trim();
            if (label.includes('Organization rank')) {
              rank = $entry.find('.value').text().trim() || undefined;
            }
          });

          // Extract SID from the explicit "Spectrum Identification (SID)" field if not from URL
          if (!sid) {
            $elem.find('.entry').each((__, entryElem) => {
              const $entry = $(entryElem);
              const label = $entry.find('.label').text().trim();
              if (label.includes('Spectrum Identification') || label.includes('SID')) {
                sid = $entry.find('.value').text().trim();
              }
            });
          }

          const stars = this.extractStars($elem);

          if (sid && name) {
            memberships.push({ sid, name, rank, stars, isMain });
          }
        });
      };

      // Parse main organization from citizen profile page
      parseOrgSection('.main-org', true);

      // If main org was redacted but we found no visible main, add a "hidden" marker
      if (mainOrgRedacted && !memberships.some(m => m.isMain)) {
        memberships.push({
          sid: 'REDACTED',
          name: '[Hidden Organization]',
          rank: undefined,
          stars: 0,
          isMain: true,
        });
      }

      // ── 2. Parse affiliate orgs from the /organizations sub-page ──
      // This page uses div.box-content.org.affiliation containers
      if (orgsResponse?.data) {
        const $orgs = cheerio.load(orgsResponse.data);
        $orgs('.box-content.org').each((_, elem) => {
          const $elem = $orgs(elem);

          // Extract SID from org link
          let sid = '';
          const orgLink = $elem.find('a[href*="/orgs/"]').first().attr('href');
          if (orgLink) {
            const match = orgLink.match(/\/orgs\/([A-Za-z0-9_-]+)/);
            if (match) {
              sid = match[1];
            }
          }

          // Extract name
          const name =
            $elem.find('.orgtitle a.value').first().text().trim() ||
            $elem.find('a[href*="/orgs/"]').first().text().trim();

          // Extract rank
          let rank: string | undefined;
          $elem.find('.entry').each((__, entryElem) => {
            const $entry = $orgs(entryElem);
            const label = $entry.find('.label').text().trim();
            if (label.includes('Organization rank')) {
              rank = $entry.find('.value').text().trim() || undefined;
            }
          });

          // Extract SID from label if not from URL
          if (!sid) {
            $elem.find('.entry').each((__, entryElem) => {
              const $entry = $orgs(entryElem);
              const label = $entry.find('.label').text().trim();
              if (label.includes('Spectrum Identification') || label.includes('SID')) {
                sid = $entry.find('.value').text().trim();
              }
            });
          }

          // Stars from .ranking .active spans
          const stars = $elem.find('.ranking .active').length;

          // Determine if this is an affiliation or main
          const title = $elem.find('.title').text().trim().toLowerCase();
          const isMain = title.includes('main') && !title.includes('affiliation');

          if (sid && name) {
            // Avoid duplicates (main org already parsed from citizen page)
            if (!memberships.some(m => m.sid === sid)) {
              memberships.push({ sid, name, rank, stars, isMain });
            }
          }
        });
      }

      this.recordSuccess();
      this.cache.set(cacheKey, memberships);

      logger.info(`Successfully crawled ${memberships.length} memberships for user: ${handle}`);
      return memberships;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const isControlPathError = this.isControlPathErrorMessage(errorMessage);

      if (
        error instanceof Error &&
        !error.message.includes('circuit breaker') &&
        !error.message.includes('rate limit')
      ) {
        this.recordFailure();
      }

      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const logPayload = {
          status,
          message: error.message,
        };

        if (this.isControlPathErrorMessage(error.message, status)) {
          logger.warn(
            `Failed to crawl memberships for ${handle} (degraded control path):`,
            logPayload
          );
        } else {
          logger.error(`Failed to crawl memberships for ${handle}:`, logPayload);
        }

        throw new Error(`Failed to crawl memberships: ${error.response?.status ?? error.message}`);
      }

      if (isControlPathError) {
        logger.warn(`Failed to crawl memberships for ${handle}: ${errorMessage}`);
      } else {
        logger.error(`Failed to crawl memberships for ${handle}: ${errorMessage}`);
      }
      throw new Error(`Failed to crawl memberships: ${errorMessage}`);
    }
  }

  private isControlPathErrorMessage(message: string, status?: number): boolean {
    if (status === 503) {
      return true;
    }

    const lowered = message.toLowerCase();
    return (
      lowered.includes('circuit breaker') ||
      lowered.includes('rate limit') ||
      lowered.includes('status code 503') ||
      lowered.includes('service unavailable')
    );
  }

  /**
   * Crawl citizen profile data from RSI website
   * Extracts the full citizen profile including bio, title, citizen record,
   * location, website, and fluency to match SENTRY v1 API parity.
   * @param handle - RSI handle
   * @returns Citizen data or null if not found
   */
  public async crawlCitizen(handle: string): Promise<RsiCitizenData | null> {
    validateRsiIdentifier(handle, 'citizen handle');
    try {
      this.checkCircuitBreaker();
      await this.checkRateLimit();

      const url = `${this.baseUrl}/citizens/${handle}`;
      const response = await this.axiosInstance.get<string>(url);

      if (response.status === 404) {
        return null;
      }

      const $ = cheerio.load(response.data);

      const displayName =
        this.extractText($, '.profile .info .entry:first-child') ??
        this.extractText($, '.profile .info p:first') ??
        this.extractText($, 'h1') ??
        handle;

      // Bio is in the profile entry section
      const bio =
        this.extractText($, '.bio .value') ??
        this.extractText($, '.bio') ??
        this.extractText($, '[class*="bio"]') ??
        '';

      // Also try extracting from the raw HTML — RSI pages embed bio in various formats
      let bioText = bio;
      if (!bioText) {
        // Fallback: search the full page text for the verification code pattern
        bioText = $('body').text();
      }

      // Extract citizen record number (e.g., "#295799")
      const citizenRecord =
        this.extractText($, '.citizen-record .value') ??
        this.extractText($, '.left-col .entry:contains("Citizen Record") .value') ??
        this.extractText($, '[class*="citizen"] .value');

      // Extract title (e.g., "Lt. Colonel")
      const title = this.extractText($, '.info .title') ?? this.extractText($, '.profile .title');

      const enlisted = this.extractText($, '.left-col .entry:contains("Enlisted") .value');

      // Extract fluency/language
      const fluency =
        this.extractText($, '.left-col .entry:contains("Fluency") .value') ??
        this.extractText($, '.left-col .entry:contains("Language") .value');

      // Extract location
      const location = this.extractText($, '.left-col .entry:contains("Location") .value');

      // Extract website
      const website =
        this.extractText($, '.bio .entry:contains("Website") a') ??
        this.extractText($, '.left-col .entry:contains("Website") .value');

      // Extract avatar
      const avatarUrl = this.extractImageUrl($, '.profile .thumb img');

      this.recordSuccess();

      return {
        handle,
        displayName: displayName !== handle ? displayName : undefined,
        bio: bioText || undefined,
        avatarUrl,
        citizenRecord,
        title,
        enlisted,
        fluency,
        location,
        website,
      };
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null; // Handle not found
      }
      throw error;
    }
  }

  /**
   * Invalidate cached data for a specific citizen.
   * Used during verification to ensure the latest page content is fetched.
   */
  public invalidateCitizenCache(handle: string): void {
    this.cache.del(`user:${handle}:orgs`);
    logger.debug(`RSI Crawler cache invalidated for citizen: ${handle}`);
  }

  /**
   * Invalidate cached data for a specific organization.
   * Used during verification to ensure the latest page content is fetched.
   */
  public invalidateOrgCache(sid: string): void {
    const cacheKey = `org:${sid.toUpperCase()}`;
    this.cache.del(cacheKey);
    logger.debug(`RSI Crawler cache invalidated for organization: ${sid}`);
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.cache.flushAll();
    logger.info('RSI Crawler cache cleared');
  }

  /**
   * Get circuit breaker status
   */
  public getCircuitStatus(): { state: string; failures: number; lastFailure: Date | null } {
    return {
      state: this.circuitState,
      failures: this.failures,
      lastFailure: this.lastFailureTime ? new Date(this.lastFailureTime) : null,
    };
  }

  /**
   * Helper: Extract text content from element
   */
  private extractText(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cheerio generic types
    $: cheerio.CheerioAPI | cheerio.Cheerio<any>,
    selector: string,
    index?: number
  ): string | undefined {
    try {
      const elem = typeof $ === 'function' ? $(selector) : $.find(selector);
      if (elem.length === 0) {
        return undefined;
      }

      const target = index !== undefined ? elem.eq(index) : elem.first();
      const text = target.text().trim();
      return text || undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Helper: Extract text from an RSI org page tab section (history, manifesto, charter).
   * Tries multiple selector strategies to handle RSI page structure variations.
   */
  private extractOrgTabContent($: cheerio.CheerioAPI, tabName: string): string | undefined {
    const selectors = [
      `#tab-${tabName} .body`,
      `#tab-${tabName} .markitup-text`,
      `#tab-${tabName} .entry-body`,
      `#tab-${tabName}`,
      `#${tabName} .body`,
      `#${tabName} .markitup-text`,
      `#${tabName}`,
      `.tab-pane#${tabName}`,
      `.tab-pane#tab-${tabName}`,
    ];

    for (const selector of selectors) {
      try {
        const elem = $(selector);
        if (elem.length > 0) {
          const text = elem.text().trim();
          if (text) {
            return text;
          }
        }
      } catch {
        // Try next selector
      }
    }

    return undefined;
  }

  /**
   * Helper: Extract image URL from element
   */
  private extractImageUrl(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cheerio generic types
    $: cheerio.CheerioAPI | cheerio.Cheerio<any>,
    selector: string
  ): string | undefined {
    try {
      const elem = typeof $ === 'function' ? $(selector) : $.find(selector);
      if (elem.length === 0) {
        return undefined;
      }

      const src = elem.first().attr('src');
      if (!src) {
        return undefined;
      }

      // Make absolute URL if relative
      if (src.startsWith('//')) {
        return `https:${src}`;
      } else if (src.startsWith('/')) {
        return this.baseUrl + src;
      }
      return src;
    } catch {
      return undefined;
    }
  }

  /**
   * Helper: Extract number from element
   */
  private extractNumber(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cheerio generic types
    $: cheerio.CheerioAPI | cheerio.Cheerio<any>,
    selector: string,
    index?: number
  ): number | undefined {
    try {
      const text = this.extractText($, selector, index);
      if (!text) {
        return undefined;
      }

      const num = parseInt(text.replace(/[^0-9]/g, ''), 10);
      return isNaN(num) ? undefined : num;
    } catch {
      return undefined;
    }
  }

  /**
   * Helper: Extract labeled counts from plain page text.
   * RSI occasionally renders count blocks without structured selector wrappers.
   */
  private extractCountFromPageText(
    $: cheerio.CheerioAPI,
    label: 'members' | 'affiliates'
  ): number | undefined {
    try {
      const normalizedText = $('body').text().replace(/\s+/g, ' ').trim();
      if (!normalizedText) {
        return undefined;
      }

      const regex = new RegExp(`(\\d[\\d,]*)\\s+${label.slice(0, -1)}(?:s)?`, 'i');
      const match = normalizedText.match(regex);
      if (!match) {
        return undefined;
      }

      const num = parseInt(match[1].replace(/,/g, ''), 10);
      return Number.isNaN(num) ? undefined : num;
    } catch {
      return undefined;
    }
  }

  /**
   * Helper: Extract star rating from element
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cheerio generic types
  private extractStars($elem: cheerio.Cheerio<any>): number {
    try {
      // Method 1: RSI uses a single .stars span with a width percentage (20% per star)
      const starsStyle = $elem.find('.stars').attr('style') ?? '';
      const widthMatch = starsStyle.match(/width:\s*([\d.]+)%/);
      if (widthMatch) {
        const pct = parseFloat(widthMatch[1]);
        return Math.min(Math.max(Math.round(pct / 20), 0), 5);
      }
      // Method 2: Count .ranking .active elements (used on /organizations sub-page)
      const activeCount = $elem.find('.ranking .active').length;
      if (activeCount > 0) {
        return Math.min(Math.max(activeCount, 0), 5);
      }
      // Method 3: Count individual .star elements (legacy layout)
      const count = $elem.find('.star').length;
      return Math.min(Math.max(count, 0), 5);
    } catch {
      return 0;
    }
  }
}

// Export singleton instance
export const rsiCrawlerService = new RsiCrawlerService();

