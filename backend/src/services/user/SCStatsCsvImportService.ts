import type {
  SCStatsCareerHours,
  SCStatsCsvCategoryStatus,
  SCStatsCsvData,
  SCStatsCsvSummary,
  SCStatsLoadoutRow,
  SCStatsPlaytimeRow,
  SCStatsPurchaseRow,
  SCStatsShipRow,
} from '@sc-fleet-manager/shared-types';
import { parse } from 'csv-parse/sync';
import { Repository } from 'typeorm';

import { AppDataSource } from '../../data-source';
import { SCStatsCsvImport } from '../../models/SCStatsCsvImport';
import { UserGameplayPreferences } from '../../models/UserGameplayPreferences';
import { ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import { ShipService } from '../ship/ShipService';

/**
 * SCStatsCsvImportService
 *
 * Handles parsing and importing CSV exports from the SCStats desktop app.
 * Supports 4 categories: Playtime, Loadouts, Purchases, Ships.
 * Each category is uploaded as a separate CSV file.
 */
export class SCStatsCsvImportService {
  private readonly repo: Repository<SCStatsCsvImport>;
  private readonly preferencesRepo: Repository<UserGameplayPreferences>;
  private readonly shipService: ShipService;

  constructor() {
    this.repo = AppDataSource.getRepository(SCStatsCsvImport);
    this.preferencesRepo = AppDataSource.getRepository(UserGameplayPreferences);
    this.shipService = new ShipService();
  }

  // ---------------------------------------------------------------------------
  // CSV Parsers
  // ---------------------------------------------------------------------------

  /**
   * Parse playtime CSV (Version, Hours, Builds)
   */
  parsePlaytimeCsv(content: string): SCStatsPlaytimeRow[] {
    const records = this.parseCsvContent(content);
    if (records.length === 0) {
      throw new ValidationError('Playtime CSV is empty');
    }

    // Validate header
    const firstRow = records[0];
    if (!('Version' in firstRow) || !('Hours' in firstRow)) {
      throw new ValidationError(
        'Invalid playtime CSV format. Expected columns: Version, Hours, Builds'
      );
    }

    return records.map((row: Record<string, string>) => ({
      version: String(row['Version'] || '').trim(),
      hours: Number.parseFloat(row['Hours'] || '0'),
      builds: String(row['Builds'] || '').trim(),
    }));
  }

  /**
   * Parse loadout CSV (Port, Item/Most Worn Item, Sessions, Worn Time)
   */
  parseLoadoutCsv(content: string, isTopItems: boolean): SCStatsLoadoutRow[] {
    const records = this.parseCsvContent(content);
    if (records.length === 0) {
      throw new ValidationError('Loadout CSV is empty');
    }

    const firstRow = records[0];
    const itemColumn = 'Most Worn Item' in firstRow ? 'Most Worn Item' : 'Item';

    if (!('Port' in firstRow) || !(itemColumn in firstRow)) {
      throw new ValidationError(
        'Invalid loadout CSV format. Expected columns: Port, Item (or Most Worn Item), Sessions, Worn Time'
      );
    }

    return records.map((row: Record<string, string>) => ({
      port: String(row['Port'] || '').trim(),
      item: String(row[itemColumn] || '').trim(),
      sessions: Number.parseInt(row['Sessions'] || '0', 10),
      wornTime: String(row['Worn Time'] || '').trim(),
      isTopItem: isTopItems,
    }));
  }

  /**
   * Parse purchases CSV (Item, Qty, Spent, Top Shop)
   */
  parsePurchasesCsv(content: string): SCStatsPurchaseRow[] {
    const records = this.parseCsvContent(content);
    if (records.length === 0) {
      throw new ValidationError('Purchases CSV is empty');
    }

    const firstRow = records[0];
    if (!('Item' in firstRow) || !('Qty' in firstRow)) {
      throw new ValidationError(
        'Invalid purchases CSV format. Expected columns: Item, Qty, Spent, Top Shop'
      );
    }

    return records.map((row: Record<string, string>) => ({
      item: String(row['Item'] || '').trim(),
      qty: Number.parseInt(row['Qty'] || '0', 10),
      spent: String(row['Spent'] || '').trim(),
      topShop: String(row['Top Shop'] || '').trim(),
    }));
  }

  /**
   * Parse ships CSV (Ship, Total Time, Sessions, Longest Flight, First Flown, Last Flown)
   */
  parseShipsCsv(content: string): SCStatsShipRow[] {
    const records = this.parseCsvContent(content);
    if (records.length === 0) {
      throw new ValidationError('Ships CSV is empty');
    }

    const firstRow = records[0];
    if (!('Ship' in firstRow) || !('Total Time' in firstRow)) {
      throw new ValidationError(
        'Invalid ships CSV format. Expected columns: Ship, Total Time, Sessions, Longest Flight, First Flown, Last Flown'
      );
    }

    return records.map((row: Record<string, string>) => ({
      ship: String(row['Ship'] || '').trim(),
      totalTime: String(row['Total Time'] || '').trim(),
      sessions: Number.parseInt(row['Sessions'] || '0', 10),
      longestFlight: String(row['Longest Flight'] || '').trim(),
      firstFlown: String(row['First Flown'] || '').trim(),
      lastFlown: String(row['Last Flown'] || '').trim(),
    }));
  }

  // ---------------------------------------------------------------------------
  // Import Logic
  // ---------------------------------------------------------------------------

  /**
   * Import CSV categories. At least one file is required.
   * Only provided categories are updated; previously imported categories are preserved.
   */
  async importCsvData(
    userId: string,
    files: {
      playtime?: string;
      loadoutTop?: string;
      loadoutDetail?: string;
      purchases?: string;
      ships?: string;
    },
    consentGranted: boolean
  ): Promise<{
    record: SCStatsCsvImport;
    summary: SCStatsCsvSummary;
    counts: Partial<SCStatsCsvData>;
  }> {
    if (!consentGranted) {
      throw new ValidationError('User consent required to import SCStats data');
    }

    // Parse only the provided CSV files
    const parsed = this.parseProvidedFiles(files);

    // Get or create record and merge parsed data
    let record = await this.repo.findOne({ where: { userId } });
    record ??= this.repo.create({ userId });

    const now = new Date();
    this.applyParsedDataToRecord(record, parsed, now);

    // Build effective data set for summary (merge imported + existing)
    const effectiveData = this.buildEffectiveData(record, parsed);

    // Look up careers from the ship catalog for all flown ships
    const careerMap = await this.fetchCareerMap(effectiveData.ships);

    // Recompute summary with all available data
    const summary = this.computeSummary(effectiveData, careerMap);

    record.summary = summary as unknown as Record<string, unknown>;
    record.consentGranted = true;
    record.consentDate = now;

    await this.repo.save(record);

    // Sync summary metrics to UserGameplayPreferences
    await this.syncToGameplayPreferences(userId, summary, now);

    const importedCounts = this.buildImportedCounts(parsed);

    logger.info('SCStats CSV data imported successfully', {
      userId,
      categories: Object.keys(importedCounts),
    });

    return { record, summary, counts: importedCounts };
  }

  /**
   * Parse only the CSV files that were provided in the request.
   */
  private parseProvidedFiles(files: {
    playtime?: string;
    loadoutTop?: string;
    loadoutDetail?: string;
    purchases?: string;
    ships?: string;
  }): {
    playtime?: SCStatsPlaytimeRow[];
    loadoutTop?: SCStatsLoadoutRow[];
    loadoutDetail?: SCStatsLoadoutRow[];
    purchases?: SCStatsPurchaseRow[];
    ships?: SCStatsShipRow[];
  } {
    return {
      playtime: files.playtime ? this.parsePlaytimeCsv(files.playtime) : undefined,
      loadoutTop: files.loadoutTop ? this.parseLoadoutCsv(files.loadoutTop, true) : undefined,
      loadoutDetail: files.loadoutDetail
        ? this.parseLoadoutCsv(files.loadoutDetail, false)
        : undefined,
      purchases: files.purchases ? this.parsePurchasesCsv(files.purchases) : undefined,
      ships: files.ships ? this.parseShipsCsv(files.ships) : undefined,
    };
  }

  /**
   * Apply parsed CSV data to the record, updating only provided categories.
   */
  private applyParsedDataToRecord(
    record: SCStatsCsvImport,
    parsed: {
      playtime?: SCStatsPlaytimeRow[];
      loadoutTop?: SCStatsLoadoutRow[];
      loadoutDetail?: SCStatsLoadoutRow[];
      purchases?: SCStatsPurchaseRow[];
      ships?: SCStatsShipRow[];
    },
    now: Date
  ): void {
    if (parsed.playtime !== undefined) {
      record.playtimeData = parsed.playtime as unknown as Record<string, unknown>[];
      record.playtimeImportedAt = now;
    }
    if (parsed.loadoutTop !== undefined) {
      record.loadoutTopData = parsed.loadoutTop as unknown as Record<string, unknown>[];
      record.loadoutImportedAt = now;
    }
    if (parsed.loadoutDetail !== undefined) {
      record.loadoutDetailData = parsed.loadoutDetail as unknown as Record<string, unknown>[];
      record.loadoutImportedAt = now;
    }
    if (parsed.purchases !== undefined) {
      record.purchasesData = parsed.purchases as unknown as Record<string, unknown>[];
      record.purchasesImportedAt = now;
    }
    if (parsed.ships !== undefined) {
      record.shipsData = parsed.ships as unknown as Record<string, unknown>[];
      record.shipsImportedAt = now;
    }
  }

  /**
   * Build effective data set by merging freshly parsed data with existing record data.
   */
  private buildEffectiveData(
    record: SCStatsCsvImport,
    parsed: {
      playtime?: SCStatsPlaytimeRow[];
      loadoutTop?: SCStatsLoadoutRow[];
      loadoutDetail?: SCStatsLoadoutRow[];
      purchases?: SCStatsPurchaseRow[];
      ships?: SCStatsShipRow[];
    }
  ): SCStatsCsvData {
    return {
      playtime: (parsed.playtime ?? (record.playtimeData as unknown as SCStatsPlaytimeRow[])) || [],
      loadoutTop:
        (parsed.loadoutTop ?? (record.loadoutTopData as unknown as SCStatsLoadoutRow[])) || [],
      loadoutDetail:
        (parsed.loadoutDetail ?? (record.loadoutDetailData as unknown as SCStatsLoadoutRow[])) ||
        [],
      purchases:
        (parsed.purchases ?? (record.purchasesData as unknown as SCStatsPurchaseRow[])) || [],
      ships: (parsed.ships ?? (record.shipsData as unknown as SCStatsShipRow[])) || [],
    };
  }

  /**
   * Fetch ship career mapping for summary aggregation.
   *
   * SCStats CSV uses names like "MISC_Prospector" while the DB catalog stores
   * human-readable names like "Prospector". This method normalizes the CSV names
   * before querying and returns a map keyed by the original raw CSV name
   * (lowercased) so that aggregateHoursByCareer can look up careers.
   */
  private async fetchCareerMap(ships: SCStatsShipRow[]): Promise<Map<string, string>> {
    if (ships.length === 0) {
      return new Map();
    }
    try {
      // Build normalized → raw name mapping
      const normalizedToRaw = new Map<string, string[]>();
      for (const s of ships) {
        const normalized = SCStatsCsvImportService.normalizeSCStatsShipName(s.ship);
        const existing = normalizedToRaw.get(normalized.toLowerCase());
        if (existing) {
          existing.push(s.ship.toLowerCase());
        } else {
          normalizedToRaw.set(normalized.toLowerCase(), [s.ship.toLowerCase()]);
        }
      }

      // Query the catalog with normalized names
      const normalizedNames = [...normalizedToRaw.keys()];
      const catalogMap = await this.shipService.batchGetShipCareersByNames(normalizedNames);

      // Re-key the result by the original raw CSV names
      const result = new Map<string, string>();
      for (const [normalizedKey, career] of catalogMap.entries()) {
        const rawNames = normalizedToRaw.get(normalizedKey);
        if (rawNames) {
          for (const raw of rawNames) {
            result.set(raw, career);
          }
        }
      }
      return result;
    } catch (err: unknown) {
      logger.warn('Failed to fetch ship careers for SCStats aggregation', {
        error: err instanceof Error ? err.message : String(err),
      });
      return new Map();
    }
  }

  /**
   * Build a counts object containing only the categories that were just imported.
   */
  private buildImportedCounts(parsed: {
    playtime?: SCStatsPlaytimeRow[];
    loadoutTop?: SCStatsLoadoutRow[];
    loadoutDetail?: SCStatsLoadoutRow[];
    purchases?: SCStatsPurchaseRow[];
    ships?: SCStatsShipRow[];
  }): Partial<SCStatsCsvData> {
    const counts: Partial<SCStatsCsvData> = {};
    if (parsed.playtime !== undefined) {
      counts.playtime = parsed.playtime;
    }
    if (parsed.loadoutTop !== undefined) {
      counts.loadoutTop = parsed.loadoutTop;
    }
    if (parsed.loadoutDetail !== undefined) {
      counts.loadoutDetail = parsed.loadoutDetail;
    }
    if (parsed.purchases !== undefined) {
      counts.purchases = parsed.purchases;
    }
    if (parsed.ships !== undefined) {
      counts.ships = parsed.ships;
    }
    return counts;
  }

  /**
   * Get CSV import data for a user
   */
  async getData(userId: string): Promise<{
    hasData: boolean;
    lastImport: Date | null;
    consentGranted: boolean;
    summary: SCStatsCsvSummary | null;
    data: SCStatsCsvData | null;
    categoryStatus: SCStatsCsvCategoryStatus | null;
  }> {
    const record = await this.repo.findOne({ where: { userId } });

    if (!record) {
      return {
        hasData: false,
        lastImport: null,
        consentGranted: false,
        summary: null,
        data: null,
        categoryStatus: null,
      };
    }

    const hasAnyData = !!(
      record.playtimeData ??
      record.loadoutTopData ??
      record.loadoutDetailData ??
      record.purchasesData ??
      record.shipsData
    );

    if (!hasAnyData) {
      return {
        hasData: false,
        lastImport: null,
        consentGranted: false,
        summary: null,
        data: null,
        categoryStatus: null,
      };
    }

    return {
      hasData: true,
      lastImport: record.updatedAt,
      consentGranted: record.consentGranted,
      summary: record.summary as unknown as SCStatsCsvSummary,
      data: {
        playtime: record.playtimeData as unknown as SCStatsPlaytimeRow[],
        loadoutTop: record.loadoutTopData as unknown as SCStatsLoadoutRow[],
        loadoutDetail: record.loadoutDetailData as unknown as SCStatsLoadoutRow[],
        purchases: record.purchasesData as unknown as SCStatsPurchaseRow[],
        ships: record.shipsData as unknown as SCStatsShipRow[],
      },
      categoryStatus: {
        playtimeImportedAt: record.playtimeImportedAt?.toISOString() ?? null,
        loadoutImportedAt: record.loadoutImportedAt?.toISOString() ?? null,
        purchasesImportedAt: record.purchasesImportedAt?.toISOString() ?? null,
        shipsImportedAt: record.shipsImportedAt?.toISOString() ?? null,
      },
    };
  }

  /**
   * Sync CSV summary metrics to UserGameplayPreferences so that:
   * - Org analytics dashboard can include this user
   * - Personal SCStats widget can display metrics
   */
  private async syncToGameplayPreferences(
    userId: string,
    summary: SCStatsCsvSummary,
    importDate: Date
  ): Promise<void> {
    let preferences = await this.preferencesRepo.findOne({ where: { userId } });
    preferences ??= this.preferencesRepo.create({
      userId,
      activityPreferences: {},
      playstyles: [],
      languages: ['english'],
    });

    preferences.scstatsLastImport = importDate;
    preferences.scstatsVerified = true;
    preferences.scstatsTotalHours = summary.totalPlaytimeHours ?? summary.totalFlightTimeHours ?? 0;
    preferences.scstatsFavoriteVehicle = summary.mostFlownShip ?? null;
    preferences.scstatsImportCount = (preferences.scstatsImportCount ?? 0) + 1;
    preferences.scstatsConsentGranted = true;
    preferences.scstatsConsentDate = importDate;

    // CSV exports don't contain K/D or mission counts — keep existing values
    // if they were set by a previous JSON import

    // Calibrate piloting skill from flight hours if available
    if (summary.totalFlightTimeHours > 0) {
      preferences.pilotingSkill = Math.min(
        100,
        Math.round(50 + summary.totalFlightTimeHours * 0.5)
      );
    }

    await this.preferencesRepo.save(preferences);

    logger.info('Synced CSV import metrics to gameplay preferences', {
      userId,
      totalHours: preferences.scstatsTotalHours,
      favoriteVehicle: preferences.scstatsFavoriteVehicle,
    });
  }

  /**
   * Delete CSV import data (GDPR compliance)
   */
  async deleteData(userId: string): Promise<void> {
    const record = await this.repo.findOne({ where: { userId } });
    if (record) {
      await this.repo.remove(record);
      logger.info('SCStats CSV data deleted', { userId });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary Computation
  // ---------------------------------------------------------------------------

  /**
   * Compute a derived summary from the parsed CSV data.
   * When a careerMap is provided (lowercased ship name → career string),
   * flight hours are aggregated per career into `hoursByCareer`.
   */
  computeSummary(
    data: SCStatsCsvData,
    careerMap: Map<string, string> = new Map()
  ): SCStatsCsvSummary {
    // Playtime
    const totalPlaytimeHours = data.playtime.reduce((sum, r) => sum + r.hours, 0);
    const versionsPlayed = data.playtime.length;
    const mostPlayedVersion = data.playtime.reduce(
      (best, r) => (r.hours > best.hours ? r : best),
      data.playtime[0] || { version: 'N/A', hours: 0 }
    ).version;

    // Ships
    const totalShipsFlown = data.ships.length;
    const totalFlightHours = data.ships.reduce(
      (sum, r) => sum + this.parseTimeToHours(r.totalTime),
      0
    );
    const mostFlownShip = data.ships.reduce(
      (best, r) =>
        this.parseTimeToHours(r.totalTime) > this.parseTimeToHours(best.totalTime) ? r : best,
      data.ships[0] ?? { ship: 'N/A', totalTime: '0' }
    ).ship;

    // Aggregate flight hours by career
    const hoursByCareer = this.aggregateHoursByCareer(data.ships, careerMap);

    // Purchases
    const totalAuecSpent = data.purchases.reduce((sum, r) => sum + this.parseAuec(r.spent), 0);
    const uniqueItemsPurchased = data.purchases.length;
    const shopCounts = new Map<string, number>();
    for (const p of data.purchases) {
      shopCounts.set(p.topShop, (shopCounts.get(p.topShop) ?? 0) + this.parseAuec(p.spent));
    }
    const favoriteShop = [...shopCounts.entries()].reduce(
      (best, [shop, total]) => (total > best[1] ? [shop, total] : best),
      ['N/A', 0] as [string, number]
    )[0];

    // Loadouts
    const allLoadout = [...data.loadoutTop, ...data.loadoutDetail];
    const weaponPorts = new Set(['Primary Carry']);
    const weapons = allLoadout.filter(
      l => weaponPorts.has(l.port) && l.item !== 'Default' && l.isTopItem
    );
    const primaryWeapon = weapons.length > 0 ? weapons[0].item : 'N/A';
    const totalLoadoutSessions = Math.max(...data.loadoutTop.map(l => l.sessions), 0);

    return {
      totalPlaytimeHours: Math.round(totalPlaytimeHours * 100) / 100,
      versionsPlayed,
      mostPlayedVersion,
      totalShipsFlown,
      totalFlightTimeHours: Math.round(totalFlightHours * 100) / 100,
      mostFlownShip,
      totalAuecSpent,
      uniqueItemsPurchased,
      favoriteShop,
      primaryWeapon,
      totalLoadoutSessions,
      hoursByCareer,
    };
  }

  /**
   * Match each flown ship to the catalog career and aggregate hours per career.
   * Ships without a catalog match are grouped under "Unknown".
   */
  private aggregateHoursByCareer(
    ships: SCStatsShipRow[],
    careerMap: Map<string, string>
  ): SCStatsCareerHours[] {
    const buckets = new Map<string, { hours: number; shipCount: number }>();

    for (const ship of ships) {
      const hours = this.parseTimeToHours(ship.totalTime);
      const career = careerMap.get(ship.ship.toLowerCase()) ?? 'Unknown';

      const existing = buckets.get(career);
      if (existing) {
        existing.hours += hours;
        existing.shipCount += 1;
      } else {
        buckets.set(career, { hours, shipCount: 1 });
      }
    }

    return [...buckets.entries()]
      .map(([career, { hours, shipCount }]) => ({
        career,
        hours: Math.round(hours * 100) / 100,
        shipCount,
      }))
      .sort((a, b) => b.hours - a.hours);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Parse CSV content using csv-parse/sync
   */
  private parseCsvContent(content: string): Record<string, string>[] {
    try {
      return parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
        relax_column_count: true,
      });
    } catch (err: unknown) {
      throw new ValidationError(
        `Failed to parse CSV: ${err instanceof Error ? err.message : 'Invalid CSV format'}`
      );
    }
  }

  /**
   * Parse a time string like "4.02h", "54.68m", "27.2s", "<1s" to hours
   */
  parseTimeToHours(timeStr: string): number {
    if (!timeStr || timeStr === '<1s') {
      return 0;
    }
    const str = timeStr.trim();

    const hoursMatch = /^([\d.]+)h$/.exec(str);
    if (hoursMatch) {
      return Number.parseFloat(hoursMatch[1]);
    }

    const minutesMatch = /^([\d.]+)m$/.exec(str);
    if (minutesMatch) {
      return Number.parseFloat(minutesMatch[1]) / 60;
    }

    const secondsMatch = /^([\d.]+)s$/.exec(str);
    if (secondsMatch) {
      return Number.parseFloat(secondsMatch[1]) / 3600;
    }

    return 0;
  }

  // ---------------------------------------------------------------------------
  // SCStats Ship Name Normalization
  // ---------------------------------------------------------------------------

  /**
   * Known aliases for SCStats ship names that cannot be algorithmically derived.
   * Maps the SCStats portion (after stripping the manufacturer prefix, with
   * underscores replaced by spaces) to the catalog DB name.
   */
  private static readonly SCSTATS_ALIASES: Record<string, string> = {
    // Crusader Hercules variants — SCStats uses "Starlifter" prefix
    'starlifter c2': 'C2 Hercules',
    'starlifter m2': 'M2 Hercules',
    'starlifter a2': 'A2 Hercules',
    // Crusader Ares variants — SCStats uses "Starfighter" prefix
    'starfighter inferno': 'Ares Inferno',
    'starfighter ion': 'Ares Ion',
    // Crusader Mercury — SCStats drops "Mercury"
    'star runner': 'Mercury Star Runner',
    // Anvil Lightning / Hornet — SCStats reorders designation vs name
    'lightning f8c': 'F8C Lightning',
    'lightning f8a': 'F8A Lightning',
    'hornet f7a mk2': 'F7A Hornet Mk II',
    'hornet f7a mk1': 'F7A Hornet Mk I',
    'hornet f7c mk2': 'F7C Hornet Mk II',
    'hornet f7c mk1': 'F7C Hornet Mk I',
    'hornet wildfire f7c mk1': 'F7C Hornet Wildfire Mk I',
    'super hornet f7cm mk1': 'F7C-M Super Hornet Mk I',
    'super hornet f7cm mk2': 'F7C-M Super Hornet Mk II',
    'hornet heartseeker f7cm mk1': 'F7C-M Hornet Heartseeker Mk I',
    'hornet heartseeker f7cm mk2': 'F7C-M Hornet Heartseeker Mk II',
    'hornet tracker f7cr mk1': 'F7C-R Hornet Tracker Mk I',
    'hornet tracker f7cr mk2': 'F7C-R Hornet Tracker Mk II',
    'hornet ghost f7cs mk1': 'F7C-S Hornet Ghost Mk I',
    'hornet ghost f7cs mk2': 'F7C-S Hornet Ghost Mk II',
    // RSI Zeus — SCStats omits "Mk II"
    'zeus cl': 'Zeus Mk II CL',
    'zeus es': 'Zeus Mk II ES',
    'zeus mr': 'Zeus Mk II MR',
    // RSI Aurora — SCStats omits "Mk I"
    'aurora cl': 'Aurora Mk I CL',
    'aurora es': 'Aurora Mk I ES',
    'aurora ln': 'Aurora Mk I LN',
    'aurora lx': 'Aurora Mk I LX',
    'aurora mr': 'Aurora Mk I MR',
    'aurora se': 'Aurora Mk I SE',
    // Kruger — SCStats removes hyphens and spaces
    'l22 alphawolf': 'L-22 Alpha Wolf',
    'l21 wolf': 'L-21 Wolf',
    // Aegis Idris — SCStats uses underscore where DB uses hyphen
    'idris p': 'Idris-P',
    'idris m': 'Idris-M',
    // Anvil Pisces — SCStats abbreviates "Rescue" suffix
    'c8r pisces': 'C8R Pisces Rescue',
    // Crusader Spirit — SCStats reorders prefix/suffix
    'spirit a1': 'A1 Spirit',
    'spirit c1': 'C1 Spirit',
    'spirit e1': 'E1 Spirit',
  };

  /**
   * Normalize an SCStats CSV ship name to match the DB catalog name.
   *
   * SCStats format: "MFRCODE_Ship_Name" (e.g. "MISC_Prospector", "CRUS_Starlifter_C2")
   * DB format: Human-readable name (e.g. "Prospector", "C2 Hercules")
   *
   * Algorithm:
   * 1. Strip the manufacturer prefix (first segment before underscore)
   * 2. Replace remaining underscores with spaces
   * 3. Check the alias table for known mismatches
   * 4. Return the normalized name
   */
  static normalizeSCStatsShipName(rawName: string): string {
    if (!rawName) {
      return rawName;
    }

    const parts = rawName.split('_');
    // Strip manufacturer prefix — first segment is always the 4-letter code
    const shipPart = parts.length > 1 ? parts.slice(1).join(' ') : rawName;

    // Check alias table (case-insensitive)
    const alias = SCStatsCsvImportService.SCSTATS_ALIASES[shipPart.toLowerCase()];
    if (alias) {
      return alias;
    }

    return shipPart;
  }

  /**
   * Parse aUEC string like "3342625 aUEC" to number
   */
  private parseAuec(spent: string): number {
    // Extract digits (and commas) before "aUEC" — use a simple approach
    // to avoid regex backtracking vulnerabilities
    const idx = spent.indexOf('aUEC');
    if (idx < 0) {
      return 0;
    }
    const prefix = spent.slice(0, idx).trim();
    const digits = prefix.replaceAll(',', '');
    const value = Number.parseInt(digits, 10);
    return Number.isNaN(value) ? 0 : value;
  }
}

