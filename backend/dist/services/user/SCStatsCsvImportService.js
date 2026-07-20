"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SCStatsCsvImportService = void 0;
const sync_1 = require("csv-parse/sync");
const data_source_1 = require("../../data-source");
const SCStatsCsvImport_1 = require("../../models/SCStatsCsvImport");
const UserGameplayPreferences_1 = require("../../models/UserGameplayPreferences");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const ShipService_1 = require("../ship/ShipService");
class SCStatsCsvImportService {
    repo;
    preferencesRepo;
    shipService;
    constructor() {
        this.repo = data_source_1.AppDataSource.getRepository(SCStatsCsvImport_1.SCStatsCsvImport);
        this.preferencesRepo = data_source_1.AppDataSource.getRepository(UserGameplayPreferences_1.UserGameplayPreferences);
        this.shipService = new ShipService_1.ShipService();
    }
    parsePlaytimeCsv(content) {
        const records = this.parseCsvContent(content);
        if (records.length === 0) {
            throw new apiErrors_1.ValidationError('Playtime CSV is empty');
        }
        const firstRow = records[0];
        if (!('Version' in firstRow) || !('Hours' in firstRow)) {
            throw new apiErrors_1.ValidationError('Invalid playtime CSV format. Expected columns: Version, Hours, Builds');
        }
        return records.map((row) => ({
            version: String(row['Version'] || '').trim(),
            hours: Number.parseFloat(row['Hours'] || '0'),
            builds: String(row['Builds'] || '').trim(),
        }));
    }
    parseLoadoutCsv(content, isTopItems) {
        const records = this.parseCsvContent(content);
        if (records.length === 0) {
            throw new apiErrors_1.ValidationError('Loadout CSV is empty');
        }
        const firstRow = records[0];
        const itemColumn = 'Most Worn Item' in firstRow ? 'Most Worn Item' : 'Item';
        if (!('Port' in firstRow) || !(itemColumn in firstRow)) {
            throw new apiErrors_1.ValidationError('Invalid loadout CSV format. Expected columns: Port, Item (or Most Worn Item), Sessions, Worn Time');
        }
        return records.map((row) => ({
            port: String(row['Port'] || '').trim(),
            item: String(row[itemColumn] || '').trim(),
            sessions: Number.parseInt(row['Sessions'] || '0', 10),
            wornTime: String(row['Worn Time'] || '').trim(),
            isTopItem: isTopItems,
        }));
    }
    parsePurchasesCsv(content) {
        const records = this.parseCsvContent(content);
        if (records.length === 0) {
            throw new apiErrors_1.ValidationError('Purchases CSV is empty');
        }
        const firstRow = records[0];
        if (!('Item' in firstRow) || !('Qty' in firstRow)) {
            throw new apiErrors_1.ValidationError('Invalid purchases CSV format. Expected columns: Item, Qty, Spent, Top Shop');
        }
        return records.map((row) => ({
            item: String(row['Item'] || '').trim(),
            qty: Number.parseInt(row['Qty'] || '0', 10),
            spent: String(row['Spent'] || '').trim(),
            topShop: String(row['Top Shop'] || '').trim(),
        }));
    }
    parseShipsCsv(content) {
        const records = this.parseCsvContent(content);
        if (records.length === 0) {
            throw new apiErrors_1.ValidationError('Ships CSV is empty');
        }
        const firstRow = records[0];
        if (!('Ship' in firstRow) || !('Total Time' in firstRow)) {
            throw new apiErrors_1.ValidationError('Invalid ships CSV format. Expected columns: Ship, Total Time, Sessions, Longest Flight, First Flown, Last Flown');
        }
        return records.map((row) => ({
            ship: String(row['Ship'] || '').trim(),
            totalTime: String(row['Total Time'] || '').trim(),
            sessions: Number.parseInt(row['Sessions'] || '0', 10),
            longestFlight: String(row['Longest Flight'] || '').trim(),
            firstFlown: String(row['First Flown'] || '').trim(),
            lastFlown: String(row['Last Flown'] || '').trim(),
        }));
    }
    async importCsvData(userId, files, consentGranted) {
        if (!consentGranted) {
            throw new apiErrors_1.ValidationError('User consent required to import SCStats data');
        }
        const parsed = this.parseProvidedFiles(files);
        let record = await this.repo.findOne({ where: { userId } });
        record ??= this.repo.create({ userId });
        const now = new Date();
        this.applyParsedDataToRecord(record, parsed, now);
        const effectiveData = this.buildEffectiveData(record, parsed);
        const careerMap = await this.fetchCareerMap(effectiveData.ships);
        const summary = this.computeSummary(effectiveData, careerMap);
        record.summary = summary;
        record.consentGranted = true;
        record.consentDate = now;
        await this.repo.save(record);
        await this.syncToGameplayPreferences(userId, summary, now);
        const importedCounts = this.buildImportedCounts(parsed);
        logger_1.logger.info('SCStats CSV data imported successfully', {
            userId,
            categories: Object.keys(importedCounts),
        });
        return { record, summary, counts: importedCounts };
    }
    parseProvidedFiles(files) {
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
    applyParsedDataToRecord(record, parsed, now) {
        if (parsed.playtime !== undefined) {
            record.playtimeData = parsed.playtime;
            record.playtimeImportedAt = now;
        }
        if (parsed.loadoutTop !== undefined) {
            record.loadoutTopData = parsed.loadoutTop;
            record.loadoutImportedAt = now;
        }
        if (parsed.loadoutDetail !== undefined) {
            record.loadoutDetailData = parsed.loadoutDetail;
            record.loadoutImportedAt = now;
        }
        if (parsed.purchases !== undefined) {
            record.purchasesData = parsed.purchases;
            record.purchasesImportedAt = now;
        }
        if (parsed.ships !== undefined) {
            record.shipsData = parsed.ships;
            record.shipsImportedAt = now;
        }
    }
    buildEffectiveData(record, parsed) {
        return {
            playtime: (parsed.playtime ?? record.playtimeData) || [],
            loadoutTop: (parsed.loadoutTop ?? record.loadoutTopData) || [],
            loadoutDetail: (parsed.loadoutDetail ?? record.loadoutDetailData) ||
                [],
            purchases: (parsed.purchases ?? record.purchasesData) || [],
            ships: (parsed.ships ?? record.shipsData) || [],
        };
    }
    async fetchCareerMap(ships) {
        if (ships.length === 0) {
            return new Map();
        }
        try {
            const normalizedToRaw = new Map();
            for (const s of ships) {
                const normalized = SCStatsCsvImportService.normalizeSCStatsShipName(s.ship);
                const existing = normalizedToRaw.get(normalized.toLowerCase());
                if (existing) {
                    existing.push(s.ship.toLowerCase());
                }
                else {
                    normalizedToRaw.set(normalized.toLowerCase(), [s.ship.toLowerCase()]);
                }
            }
            const normalizedNames = [...normalizedToRaw.keys()];
            const catalogMap = await this.shipService.batchGetShipCareersByNames(normalizedNames);
            const result = new Map();
            for (const [normalizedKey, career] of catalogMap.entries()) {
                const rawNames = normalizedToRaw.get(normalizedKey);
                if (rawNames) {
                    for (const raw of rawNames) {
                        result.set(raw, career);
                    }
                }
            }
            return result;
        }
        catch (err) {
            logger_1.logger.warn('Failed to fetch ship careers for SCStats aggregation', {
                error: err instanceof Error ? err.message : String(err),
            });
            return new Map();
        }
    }
    buildImportedCounts(parsed) {
        const counts = {};
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
    async getData(userId) {
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
        const hasAnyData = !!(record.playtimeData ??
            record.loadoutTopData ??
            record.loadoutDetailData ??
            record.purchasesData ??
            record.shipsData);
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
            summary: record.summary,
            data: {
                playtime: record.playtimeData,
                loadoutTop: record.loadoutTopData,
                loadoutDetail: record.loadoutDetailData,
                purchases: record.purchasesData,
                ships: record.shipsData,
            },
            categoryStatus: {
                playtimeImportedAt: record.playtimeImportedAt?.toISOString() ?? null,
                loadoutImportedAt: record.loadoutImportedAt?.toISOString() ?? null,
                purchasesImportedAt: record.purchasesImportedAt?.toISOString() ?? null,
                shipsImportedAt: record.shipsImportedAt?.toISOString() ?? null,
            },
        };
    }
    async syncToGameplayPreferences(userId, summary, importDate) {
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
        if (summary.totalFlightTimeHours > 0) {
            preferences.pilotingSkill = Math.min(100, Math.round(50 + summary.totalFlightTimeHours * 0.5));
        }
        await this.preferencesRepo.save(preferences);
        logger_1.logger.info('Synced CSV import metrics to gameplay preferences', {
            userId,
            totalHours: preferences.scstatsTotalHours,
            favoriteVehicle: preferences.scstatsFavoriteVehicle,
        });
    }
    async deleteData(userId) {
        const record = await this.repo.findOne({ where: { userId } });
        if (record) {
            await this.repo.remove(record);
            logger_1.logger.info('SCStats CSV data deleted', { userId });
        }
    }
    computeSummary(data, careerMap = new Map()) {
        const totalPlaytimeHours = data.playtime.reduce((sum, r) => sum + r.hours, 0);
        const versionsPlayed = data.playtime.length;
        const mostPlayedVersion = data.playtime.reduce((best, r) => (r.hours > best.hours ? r : best), data.playtime[0] || { version: 'N/A', hours: 0 }).version;
        const totalShipsFlown = data.ships.length;
        const totalFlightHours = data.ships.reduce((sum, r) => sum + this.parseTimeToHours(r.totalTime), 0);
        const mostFlownShip = data.ships.reduce((best, r) => this.parseTimeToHours(r.totalTime) > this.parseTimeToHours(best.totalTime) ? r : best, data.ships[0] ?? { ship: 'N/A', totalTime: '0' }).ship;
        const hoursByCareer = this.aggregateHoursByCareer(data.ships, careerMap);
        const totalAuecSpent = data.purchases.reduce((sum, r) => sum + this.parseAuec(r.spent), 0);
        const uniqueItemsPurchased = data.purchases.length;
        const shopCounts = new Map();
        for (const p of data.purchases) {
            shopCounts.set(p.topShop, (shopCounts.get(p.topShop) ?? 0) + this.parseAuec(p.spent));
        }
        const favoriteShop = [...shopCounts.entries()].reduce((best, [shop, total]) => (total > best[1] ? [shop, total] : best), ['N/A', 0])[0];
        const allLoadout = [...data.loadoutTop, ...data.loadoutDetail];
        const weaponPorts = new Set(['Primary Carry']);
        const weapons = allLoadout.filter(l => weaponPorts.has(l.port) && l.item !== 'Default' && l.isTopItem);
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
    aggregateHoursByCareer(ships, careerMap) {
        const buckets = new Map();
        for (const ship of ships) {
            const hours = this.parseTimeToHours(ship.totalTime);
            const career = careerMap.get(ship.ship.toLowerCase()) ?? 'Unknown';
            const existing = buckets.get(career);
            if (existing) {
                existing.hours += hours;
                existing.shipCount += 1;
            }
            else {
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
    parseCsvContent(content) {
        try {
            return (0, sync_1.parse)(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
                relax_quotes: true,
                relax_column_count: true,
            });
        }
        catch (err) {
            throw new apiErrors_1.ValidationError(`Failed to parse CSV: ${err instanceof Error ? err.message : 'Invalid CSV format'}`);
        }
    }
    parseTimeToHours(timeStr) {
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
    static SCSTATS_ALIASES = {
        'starlifter c2': 'C2 Hercules',
        'starlifter m2': 'M2 Hercules',
        'starlifter a2': 'A2 Hercules',
        'starfighter inferno': 'Ares Inferno',
        'starfighter ion': 'Ares Ion',
        'star runner': 'Mercury Star Runner',
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
        'zeus cl': 'Zeus Mk II CL',
        'zeus es': 'Zeus Mk II ES',
        'zeus mr': 'Zeus Mk II MR',
        'aurora cl': 'Aurora Mk I CL',
        'aurora es': 'Aurora Mk I ES',
        'aurora ln': 'Aurora Mk I LN',
        'aurora lx': 'Aurora Mk I LX',
        'aurora mr': 'Aurora Mk I MR',
        'aurora se': 'Aurora Mk I SE',
        'l22 alphawolf': 'L-22 Alpha Wolf',
        'l21 wolf': 'L-21 Wolf',
        'idris p': 'Idris-P',
        'idris m': 'Idris-M',
        'c8r pisces': 'C8R Pisces Rescue',
        'spirit a1': 'A1 Spirit',
        'spirit c1': 'C1 Spirit',
        'spirit e1': 'E1 Spirit',
    };
    static normalizeSCStatsShipName(rawName) {
        if (!rawName) {
            return rawName;
        }
        const parts = rawName.split('_');
        const shipPart = parts.length > 1 ? parts.slice(1).join(' ') : rawName;
        const alias = SCStatsCsvImportService.SCSTATS_ALIASES[shipPart.toLowerCase()];
        if (alias) {
            return alias;
        }
        return shipPart;
    }
    parseAuec(spent) {
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
exports.SCStatsCsvImportService = SCStatsCsvImportService;
//# sourceMappingURL=SCStatsCsvImportService.js.map