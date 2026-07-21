import fs from 'node:fs';
import path from 'node:path';

import { AppDataSource } from '../config/database';
import { Ship, ShipSize, ShipStatus } from '../models/Ship';
import { logger } from '../utils/logger';

type RawShip = Record<string, string>;

const toNumber = (val?: string | null): number | undefined => {
  if (!val) {
    return undefined;
  }
  const cleaned = String(val)
    .replace(/[,\s]/g, '')
    .replace(/[^0-9.-]/g, '');
  const num = Number.parseFloat(cleaned);
  return Number.isNaN(num) ? undefined : num;
};

const parseDimensions = (dim?: string | null) => {
  if (!dim) {
    return { length: undefined, beam: undefined, height: undefined };
  }
  const parts = String(dim)
    .split('x')
    .map(p => p.trim());
  const [length, beam, height] = [parts[0], parts[1], parts[2]].map(toNumber);
  return { length, beam, height };
};

const normalizeManufacturer = (m?: string | null): string | undefined => {
  if (!m) {
    return undefined;
  }
  // Strip codes in parentheses, e.g., "Origin Jumpworks (ORIG)" -> "Origin Jumpworks"
  return m.replace(/\s*\([^)]*\)\s*/g, '').trim();
};

const mapSize = (size?: string | null): ShipSize | undefined => {
  if (!size) {
    return undefined;
  }
  const n = String(size).trim().toLowerCase();
  // Many entries use numeric crew size; treat common values
  switch (n) {
    case 'vehicle':
      return ShipSize.VEHICLE;
    case 'snub':
      return ShipSize.SNUB;
    case 'small':
    case '1':
      return ShipSize.SMALL;
    case 'medium':
    case '2':
      return ShipSize.MEDIUM;
    case 'large':
    case '4':
      return ShipSize.LARGE;
    case 'capital':
    case '5':
      return ShipSize.CAPITAL;
    default:
      return undefined;
  }
};

const makeId = (name: string, manufacturer: string): string => {
  const slug = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$|(--)+/g, '');
  return `${slug(manufacturer)}:${slug(name)}`;
};

const main = async () => {
  const jsonPathArg = process.argv[2];
  if (!jsonPathArg) {
    logger.error('Usage: node dist/scripts/importShips.js <path-to-json>');
    process.exit(1);
  }

  // CWE-23: Validate path to prevent directory traversal
  const baseDir = process.cwd();
  const resolvedPath = path.resolve(jsonPathArg);

  // Ensure the resolved path is within the project directory
  if (!resolvedPath.startsWith(baseDir + path.sep) && resolvedPath !== baseDir) {
    logger.error(`Path traversal detected: path must be within ${baseDir}`);
    process.exit(1);
  }

  const jsonPath = resolvedPath;
  if (!fs.existsSync(jsonPath)) {
    logger.error(`File not found: ${jsonPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  let data: RawShip[];
  try {
    data = JSON.parse(raw);
  } catch (e) {
    logger.error('Invalid JSON file:', e);
    process.exit(1);
  }

  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Ship);

  let inserted = 0;
  let updated = 0;

  for (const row of data) {
    const name = (row['Name'] || '').trim();
    const manufacturerRaw = (row['Manufacturer'] || '').trim();
    if (!name || !manufacturerRaw) {
      continue;
    }
    const manufacturer = normalizeManufacturer(manufacturerRaw)!;
    const id = makeId(name, manufacturer);

    const existing = await repo.findOne({ where: { id } });

    const { length, beam, height } = parseDimensions(row['Dimensions']);

    const ship: Partial<Ship> = {
      id,
      name,
      manufacturer,
      role: (row['Role'] || '').trim() || undefined,
      size: mapSize(row['Size']),
      crew: toNumber(row['Crew size']),
      cargo: toNumber(row['Cargo']),
      mass: toNumber(row['Mass']),
      price: toNumber(row['Price']),
      length,
      beam,
      height,
      speed: toNumber(row['SCM speed']),
      afterburnerSpeed: toNumber(row['SCM boost speed forward']),
      hydrogenFuelCapacity: toNumber(row['Hydrogen capacity']),
      quantumFuelCapacity: toNumber(row['QT fuel capacity']),
      shields: toNumber(row['HP']),
      armor: toNumber(row['Armor']),
      isActive: true,
      status: ShipStatus.FLIGHT_READY,
      metadata: {
        career: row['Career'] || undefined,
        shieldFaceType: row['Shield face type'] || undefined,
        cmDecoy: row['CM decoy'] || undefined,
        cmNoise: row['CM noise'] || undefined,
      },
    };

    if (existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await repo.update({ id }, ship as any);
      updated++;
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await repo.insert(ship as any);
      inserted++;
    }
  }

  logger.info(`Import complete. Inserted: ${inserted}, Updated: ${updated}`);
  await AppDataSource.destroy();
};

main().catch(async err => {
  logger.error('Import failed:', err);
  try {
    await AppDataSource.destroy();
  } catch {
    /* ignore cleanup errors */
  }
  process.exit(1);
});
