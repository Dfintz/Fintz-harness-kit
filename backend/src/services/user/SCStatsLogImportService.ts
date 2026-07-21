import { ValidationError } from '../../utils/apiErrors';

interface UploadedLogFile {
  name: string;
  content: string;
}

interface ParsedSession {
  firstTs: Date;
  lastTs: Date;
  envSession: string | null;
}

interface ParsedShipAggregate {
  ship: string;
  totalMs: number;
  sessions: number;
  longestMs: number;
  firstFlown: Date;
  lastFlown: Date;
}

interface ParsedLoadoutAggregate {
  port: string;
  item: string;
  sessions: number;
  wornMs: number;
}

interface ParsedPurchaseAggregate {
  item: string;
  qty: number;
  spentAuec: number;
  topShop: string;
}

interface FileParseQuality {
  fileName: string;
  sessionDetected: boolean;
  shipEvents: number;
  loadoutEvents: number;
  purchaseEvents: number;
  extractedCategories: string[];
  warnings: string[];
}

interface ParsedFileResult {
  session: ParsedSession | null;
  ships: ParsedShipAggregate[];
  loadouts: ParsedLoadoutAggregate[];
  purchases: ParsedPurchaseAggregate[];
  shipSessionsParsed: number;
  loadoutEventsParsed: number;
  purchaseEventsParsed: number;
  quality: FileParseQuality;
}

interface LogCsvBuildResult {
  csvFiles: {
    playtime?: string;
    loadoutTop?: string;
    loadoutDetail?: string;
    purchases?: string;
    ships?: string;
  };
  meta: {
    filesProcessed: number;
    sessionsParsed: number;
    shipSessionsParsed: number;
    loadoutEventsParsed: number;
    purchaseEventsParsed: number;
    shipsAggregated: number;
    loadoutsAggregated: number;
    purchasesAggregated: number;
    categoriesExtracted: Array<'playtime' | 'loadoutTop' | 'loadoutDetail' | 'purchases' | 'ships'>;
    parseQuality: FileParseQuality[];
  };
}

const TIMESTAMP_REGEX = /<(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)>/;
const ENV_SESSION_REGEX = /@env_session:\s*'([^']+)'/;
const SHIP_GRANT_REGEX = /granted control token for '([^']+)' \[(\d+)\]/i;
const SHIP_RELEASE_REGEX = /releasing control token for '([^']+)' \[(\d+)\]/i;
const LOADOUT_KEYWORD_REGEX = /\b(equipped|equip|loadout|attached)\b/i;
const PURCHASE_KEYWORD_REGEX = /\b(purchase|purchased|buy|bought)\b/i;
const QUOTED_ITEM_REGEX = /'([^']{2,80})'/;
const LOADOUT_PORT_REGEX = /\b(?:port|slot)\b\s*[:=]?\s*([\w -]{2,40})/i;
const PURCHASE_AMOUNT_REGEX = /\b(?:for|cost|spent)\b\s*(\d[\d,]*(?:\.\d+)?)/i;
const SHIP_UNDERSCORE_SUFFIX_REGEX = /^(.*?)(?:_(\d+))$/;
const SHIP_DASH_SUFFIX_REGEX = /^(.*?)(?:-(\d+))$/;
const LOADOUT_EVENT_DEFAULT_MS = 5 * 60 * 1000;

interface LogParseState {
  firstTs: Date | null;
  lastTs: Date | null;
  envSession: string | null;
  activeShips: Map<string, { ship: string; startedAt: Date }>;
  ships: Map<string, ParsedShipAggregate>;
  loadouts: Map<string, ParsedLoadoutAggregate>;
  purchases: Map<string, ParsedPurchaseAggregate>;
  shipSessionsParsed: number;
  loadoutEventsParsed: number;
  purchaseEventsParsed: number;
}

interface VersionParts {
  versionLabel: string;
  buildLabel: string | null;
}

export class SCStatsLogImportService {
  buildCsvImports(logFiles: UploadedLogFile[]): LogCsvBuildResult {
    if (logFiles.length === 0) {
      throw new ValidationError('At least one log file is required');
    }

    const sessions: ParsedSession[] = [];
    const ships = new Map<string, ParsedShipAggregate>();
    const loadouts = new Map<string, ParsedLoadoutAggregate>();
    const purchases = new Map<string, ParsedPurchaseAggregate>();
    const parseQuality: FileParseQuality[] = [];
    let shipSessionsParsed = 0;
    let loadoutEventsParsed = 0;
    let purchaseEventsParsed = 0;

    for (const file of logFiles) {
      const parsed = this.parseLogFile(file);
      parseQuality.push(parsed.quality);
      if (!parsed.session) {
        continue;
      }

      sessions.push(parsed.session);
      shipSessionsParsed += parsed.shipSessionsParsed;
      loadoutEventsParsed += parsed.loadoutEventsParsed;
      purchaseEventsParsed += parsed.purchaseEventsParsed;
      this.mergeShipAggregates(ships, parsed.ships);
      this.mergeLoadoutAggregates(loadouts, parsed.loadouts);
      this.mergePurchaseAggregates(purchases, parsed.purchases);
    }

    if (sessions.length === 0) {
      throw new ValidationError('No valid sessions found in uploaded logs');
    }

    const playtimeCsv = this.buildPlaytimeCsv(sessions);
    const loadoutCsv = this.buildLoadoutCsv([...loadouts.values()]);
    const purchasesCsv = this.buildPurchasesCsv([...purchases.values()]);
    const shipsCsv = this.buildShipsCsv([...ships.values()]);

    const categoriesExtracted: Array<
      'playtime' | 'loadoutTop' | 'loadoutDetail' | 'purchases' | 'ships'
    > = ['playtime'];
    const csvFiles: LogCsvBuildResult['csvFiles'] = {
      playtime: playtimeCsv,
      ships: shipsCsv,
    };

    if (loadoutCsv.top) {
      csvFiles.loadoutTop = loadoutCsv.top;
      categoriesExtracted.push('loadoutTop');
    }
    if (loadoutCsv.detail) {
      csvFiles.loadoutDetail = loadoutCsv.detail;
      categoriesExtracted.push('loadoutDetail');
    }
    if (purchasesCsv) {
      csvFiles.purchases = purchasesCsv;
      categoriesExtracted.push('purchases');
    }
    categoriesExtracted.push('ships');

    return {
      csvFiles,
      meta: {
        filesProcessed: logFiles.length,
        sessionsParsed: sessions.length,
        shipSessionsParsed,
        loadoutEventsParsed,
        purchaseEventsParsed,
        shipsAggregated: ships.size,
        loadoutsAggregated: loadouts.size,
        purchasesAggregated: purchases.size,
        categoriesExtracted,
        parseQuality,
      },
    };
  }

  private parseLogFile(file: UploadedLogFile): ParsedFileResult {
    const state: LogParseState = {
      firstTs: null,
      lastTs: null,
      envSession: null,
      activeShips: new Map<string, { ship: string; startedAt: Date }>(),
      ships: new Map<string, ParsedShipAggregate>(),
      loadouts: new Map<string, ParsedLoadoutAggregate>(),
      purchases: new Map<string, ParsedPurchaseAggregate>(),
      shipSessionsParsed: 0,
      loadoutEventsParsed: 0,
      purchaseEventsParsed: 0,
    };

    for (const line of file.content.split(/\r?\n/)) {
      this.consumeLogLine(line, state);
    }

    const sessionDetected = !!state.firstTs && !!state.lastTs && state.lastTs >= state.firstTs;

    if (sessionDetected) {
      for (const active of state.activeShips.values()) {
        const durationMs = state.lastTs!.getTime() - active.startedAt.getTime();
        if (durationMs > 0) {
          this.accumulateShip(
            state.ships,
            active.ship,
            durationMs,
            active.startedAt,
            state.lastTs!
          );
          state.shipSessionsParsed += 1;
        }
      }
    }
    const quality = this.buildParseQuality(file.name, state, sessionDetected);

    return {
      session: sessionDetected
        ? {
            firstTs: state.firstTs!,
            lastTs: state.lastTs!,
            envSession: state.envSession,
          }
        : null,
      ships: [...state.ships.values()],
      loadouts: [...state.loadouts.values()],
      purchases: [...state.purchases.values()],
      shipSessionsParsed: state.shipSessionsParsed,
      loadoutEventsParsed: state.loadoutEventsParsed,
      purchaseEventsParsed: state.purchaseEventsParsed,
      quality,
    };
  }

  private buildParseQuality(
    fileName: string,
    state: LogParseState,
    sessionDetected: boolean
  ): FileParseQuality {
    const warnings: string[] = [];
    if (!sessionDetected) {
      warnings.push('No valid timestamp bounds were detected in this file.');
    }
    if (state.loadoutEventsParsed > 0) {
      warnings.push('Loadout worn time is estimated from event counts (5 minutes per event).');
    }
    if (state.purchaseEventsParsed > 0) {
      warnings.push('Purchase parsing is best-effort and depends on log line wording.');
    }

    const extractedCategories: string[] = [];
    if (sessionDetected) {extractedCategories.push('playtime');}
    if (state.ships.size > 0) {extractedCategories.push('ships');}
    if (state.loadouts.size > 0) {extractedCategories.push('loadout');}
    if (state.purchases.size > 0) {extractedCategories.push('purchases');}

    return {
      fileName,
      sessionDetected,
      shipEvents: state.shipSessionsParsed,
      loadoutEvents: state.loadoutEventsParsed,
      purchaseEvents: state.purchaseEventsParsed,
      extractedCategories,
      warnings,
    };
  }

  private consumeLogLine(line: string, state: LogParseState): void {
    const ts = this.extractTimestamp(line);
    this.updateSessionBounds(state, ts);
    this.captureEnvSession(line, state);

    if (!ts) {
      return;
    }

    if (this.captureShipGrant(line, ts, state)) {
      return;
    }

    if (this.captureShipRelease(line, ts, state)) {
      return;
    }

    if (this.captureLoadoutEvent(line, state)) {
      return;
    }

    this.capturePurchaseEvent(line, state);
  }

  private updateSessionBounds(state: LogParseState, ts: Date | null): void {
    if (!ts) {
      return;
    }

    if (!state.firstTs || ts < state.firstTs) {
      state.firstTs = ts;
    }
    if (!state.lastTs || ts > state.lastTs) {
      state.lastTs = ts;
    }
  }

  private captureEnvSession(line: string, state: LogParseState): void {
    if (state.envSession) {
      return;
    }

    const envMatch = ENV_SESSION_REGEX.exec(line);
    if (envMatch) {
      state.envSession = envMatch[1];
    }
  }

  private captureShipGrant(line: string, ts: Date, state: LogParseState): boolean {
    const grantMatch = SHIP_GRANT_REGEX.exec(line);
    if (!grantMatch) {
      return false;
    }

    const ship = this.normalizeShipName(grantMatch[1]);
    const shipId = grantMatch[2];
    state.activeShips.set(`${ship}##${shipId}`, { ship, startedAt: ts });
    return true;
  }

  private captureShipRelease(line: string, ts: Date, state: LogParseState): boolean {
    const releaseMatch = SHIP_RELEASE_REGEX.exec(line);
    if (!releaseMatch) {
      return false;
    }

    const ship = this.normalizeShipName(releaseMatch[1]);
    const shipId = releaseMatch[2];
    const key = `${ship}##${shipId}`;
    const active = state.activeShips.get(key);
    if (!active) {
      return false;
    }

    state.activeShips.delete(key);
    const durationMs = ts.getTime() - active.startedAt.getTime();
    if (durationMs <= 0) {
      return true;
    }

    this.accumulateShip(state.ships, active.ship, durationMs, active.startedAt, ts);
    state.shipSessionsParsed += 1;
    return true;
  }

  private captureLoadoutEvent(line: string, state: LogParseState): boolean {
    if (!LOADOUT_KEYWORD_REGEX.exec(line)) {
      return false;
    }

    const itemMatch = QUOTED_ITEM_REGEX.exec(line);
    if (!itemMatch) {
      return false;
    }

    const item = itemMatch[1].trim();
    const portMatch = LOADOUT_PORT_REGEX.exec(line);
    const port = (portMatch?.[1] ?? 'Unknown').trim();
    if (!item) {
      return false;
    }

    const key = `${port}##${item}`;
    const existing = state.loadouts.get(key);
    if (existing) {
      existing.sessions += 1;
      existing.wornMs += LOADOUT_EVENT_DEFAULT_MS;
    } else {
      state.loadouts.set(key, {
        port,
        item,
        sessions: 1,
        wornMs: LOADOUT_EVENT_DEFAULT_MS,
      });
    }

    state.loadoutEventsParsed += 1;
    return true;
  }

  private capturePurchaseEvent(line: string, state: LogParseState): void {
    if (!PURCHASE_KEYWORD_REGEX.exec(line)) {
      return;
    }

    const itemMatch = QUOTED_ITEM_REGEX.exec(line);
    if (!itemMatch) {
      return;
    }

    const item = itemMatch[1].trim();
    if (!item) {
      return;
    }

    const amountMatch = PURCHASE_AMOUNT_REGEX.exec(line);
    const spentAuec = this.parseNumeric(amountMatch?.[1]);
    const key = item.toLowerCase();
    const existing = state.purchases.get(key);
    if (existing) {
      existing.qty += 1;
      existing.spentAuec += spentAuec;
    } else {
      state.purchases.set(key, {
        item,
        qty: 1,
        spentAuec,
        topShop: 'Unknown',
      });
    }

    state.purchaseEventsParsed += 1;
  }

  private accumulateShip(
    ships: Map<string, ParsedShipAggregate>,
    shipName: string,
    durationMs: number,
    startedAt: Date,
    endedAt: Date
  ): void {
    const existing = ships.get(shipName);
    if (!existing) {
      ships.set(shipName, {
        ship: shipName,
        totalMs: durationMs,
        sessions: 1,
        longestMs: durationMs,
        firstFlown: startedAt,
        lastFlown: endedAt,
      });
      return;
    }

    existing.totalMs += durationMs;
    existing.sessions += 1;
    existing.longestMs = Math.max(existing.longestMs, durationMs);
    if (startedAt < existing.firstFlown) {
      existing.firstFlown = startedAt;
    }
    if (endedAt > existing.lastFlown) {
      existing.lastFlown = endedAt;
    }
  }

  private mergeShipAggregates(
    target: Map<string, ParsedShipAggregate>,
    source: ParsedShipAggregate[]
  ): void {
    for (const ship of source) {
      const existing = target.get(ship.ship);
      if (!existing) {
        target.set(ship.ship, ship);
        continue;
      }

      existing.totalMs += ship.totalMs;
      existing.sessions += ship.sessions;
      existing.longestMs = Math.max(existing.longestMs, ship.longestMs);
      if (ship.firstFlown < existing.firstFlown) {
        existing.firstFlown = ship.firstFlown;
      }
      if (ship.lastFlown > existing.lastFlown) {
        existing.lastFlown = ship.lastFlown;
      }
    }
  }

  private mergeLoadoutAggregates(
    target: Map<string, ParsedLoadoutAggregate>,
    source: ParsedLoadoutAggregate[]
  ): void {
    for (const row of source) {
      const key = `${row.port}##${row.item}`;
      const existing = target.get(key);
      if (existing) {
        existing.sessions += row.sessions;
        existing.wornMs += row.wornMs;
      } else {
        target.set(key, { ...row });
      }
    }
  }

  private mergePurchaseAggregates(
    target: Map<string, ParsedPurchaseAggregate>,
    source: ParsedPurchaseAggregate[]
  ): void {
    for (const row of source) {
      const key = row.item.toLowerCase();
      const existing = target.get(key);
      if (existing) {
        existing.qty += row.qty;
        existing.spentAuec += row.spentAuec;
      } else {
        target.set(key, { ...row });
      }
    }
  }

  private buildPlaytimeCsv(sessions: ParsedSession[]): string {
    const byVersion = new Map<string, { hours: number; builds: Set<string> }>();

    for (const session of sessions) {
      const durationHours = (session.lastTs.getTime() - session.firstTs.getTime()) / 3_600_000;
      const versionParts = this.parseVersionParts(session.envSession);
      const row = byVersion.get(versionParts.versionLabel);
      if (!row) {
        byVersion.set(versionParts.versionLabel, {
          hours: durationHours,
          builds: new Set(versionParts.buildLabel ? [versionParts.buildLabel] : []),
        });
        continue;
      }

      row.hours += durationHours;
      if (versionParts.buildLabel) {
        row.builds.add(versionParts.buildLabel);
      }
    }

    const rows = ['Version,Hours,Builds'];
    for (const [version, data] of byVersion.entries()) {
      const sortedBuilds = [...data.builds].sort((a, b) => a.localeCompare(b));
      rows.push(
        [
          this.escapeCsv(version),
          data.hours.toFixed(2),
          this.escapeCsv(sortedBuilds.join('; ')),
        ].join(',')
      );
    }

    return rows.join('\n');
  }

  private buildShipsCsv(ships: ParsedShipAggregate[]): string {
    const rows = [
      'Ship,Total Time,Sessions,Longest Flight,First Flown,Last Flown',
    ];

    const sorted = [...ships];
    sorted.sort((a, b) => b.totalMs - a.totalMs);

    for (const ship of sorted) {
      rows.push(
        [
          this.escapeCsv(ship.ship),
          this.escapeCsv(this.formatHours(ship.totalMs)),
          String(ship.sessions),
          this.escapeCsv(this.formatHours(ship.longestMs)),
          this.escapeCsv(ship.firstFlown.toISOString().slice(0, 19).replace('T', ' ')),
          this.escapeCsv(ship.lastFlown.toISOString().slice(0, 19).replace('T', ' ')),
        ].join(',')
      );
    }

    return rows.join('\n');
  }

  private buildLoadoutCsv(loadouts: ParsedLoadoutAggregate[]): { top?: string; detail?: string } {
    if (loadouts.length === 0) {
      return {};
    }

    const sorted = [...loadouts].sort((a, b) => b.sessions - a.sessions);
    const top = sorted.slice(0, 25);
    const detail = sorted.slice(25);

    const topRows = ['Port,Most Worn Item,Sessions,Worn Time'];
    for (const row of top) {
      topRows.push(
        [
          this.escapeCsv(row.port),
          this.escapeCsv(row.item),
          String(row.sessions),
          this.escapeCsv(this.formatHours(row.wornMs)),
        ].join(',')
      );
    }

    if (detail.length === 0) {
      return { top: topRows.join('\n') };
    }

    const detailRows = ['Port,Item,Sessions,Worn Time'];
    for (const row of detail) {
      detailRows.push(
        [
          this.escapeCsv(row.port),
          this.escapeCsv(row.item),
          String(row.sessions),
          this.escapeCsv(this.formatHours(row.wornMs)),
        ].join(',')
      );
    }

    return {
      top: topRows.join('\n'),
      detail: detailRows.join('\n'),
    };
  }

  private buildPurchasesCsv(purchases: ParsedPurchaseAggregate[]): string | undefined {
    if (purchases.length === 0) {
      return undefined;
    }

    const rows = ['Item,Qty,Spent,Top Shop'];
    const sorted = [...purchases].sort((a, b) => b.qty - a.qty);
    for (const row of sorted) {
      rows.push(
        [
          this.escapeCsv(row.item),
          String(row.qty),
          this.escapeCsv(`${Math.round(row.spentAuec)} aUEC`),
          this.escapeCsv(row.topShop),
        ].join(',')
      );
    }

    return rows.join('\n');
  }

  private parseVersionParts(envSession: string | null): VersionParts {
    if (!envSession) {
      return { versionLabel: 'Unknown', buildLabel: null };
    }

    const parts = envSession.split('-');
    if (parts.length < 4) {
      return { versionLabel: 'Unknown', buildLabel: null };
    }

    const envCode = parts[0].toLowerCase();
    const channel = parts[2];
    const versionDigits = parts[3];
    const build = parts.length > 4 ? parts[4] : null;

    const envLabel = envCode === 'pub' ? 'LIVE' : envCode.toUpperCase();
    const channelLabel = this.capitalize(channel);
    const version = this.formatVersionDigits(versionDigits);

    return {
      versionLabel: `${channelLabel} ${version} ${envLabel}`,
      buildLabel: build ? `build ${build}` : null,
    };
  }

  private formatVersionDigits(digits: string): string {
    if (!digits) {
      return '0.0.0';
    }
    if (digits.length === 1) {
      return `${digits}.0.0`;
    }
    if (digits.length === 2) {
      return `${digits[0]}.${digits[1]}.0`;
    }

    const major = digits[0];
    const minor = digits[1];
    const patchRaw = digits.slice(2);
    const patch = /^\d+$/.test(patchRaw) ? String(Number.parseInt(patchRaw, 10)) : patchRaw;

    return `${major}.${minor}.${patch}`;
  }

  private extractTimestamp(line: string): Date | null {
    const match = TIMESTAMP_REGEX.exec(line);
    if (!match) {
      return null;
    }

    const parsed = new Date(match[1]);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private normalizeShipName(rawName: string): string {
    const trimmed = rawName.trim();
    const underscoreMatch = SHIP_UNDERSCORE_SUFFIX_REGEX.exec(trimmed);
    if (underscoreMatch) {
      return underscoreMatch[1];
    }

    const dashMatch = SHIP_DASH_SUFFIX_REGEX.exec(trimmed);
    if (dashMatch) {
      return dashMatch[1];
    }

    return trimmed;
  }

  private parseNumeric(value: string | undefined): number {
    if (!value) {
      return 0;
    }
    const normalized = value.replaceAll(',', '');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private formatHours(ms: number): string {
    const hours = ms / 3_600_000;
    return `${hours.toFixed(2)}h`;
  }

  private capitalize(value: string): string {
    if (!value) {
      return value;
    }
    return value[0].toUpperCase() + value.slice(1).toLowerCase();
  }

  private escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replaceAll('"', '""')}"`;
    }
    return value;
  }
}

export const scstatsLogImportService = new SCStatsLogImportService();

