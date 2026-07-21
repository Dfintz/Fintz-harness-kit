import * as fs from 'node:fs';
import * as path from 'node:path';
import { In, IsNull } from 'typeorm';
import { AppDataSource } from '../src/config/database';
import { Ship, ShipSize, ShipStatus } from '../src/models/Ship';

interface ShipRecord {
  Name: string;
  Manufacturer: string;
  Type: string;
  Career?: string;
  Role?: string;
  Subtype?: string;
  'Crew Size'?: string | number;
  SCU?: string | number;
  'Hangar Size'?: string;
  'QT Fuel Capacity'?: string | number;
  'Claim Time'?: string;
  'Expedite Time'?: string;
  Status: string;
}

interface ShipDelta {
  added: ShipRecord[];
  updated: Array<{ old: ShipRecord; new: ShipRecord }>;
  deleted: ShipRecord[];
}

/**
 * Map CSV hangar size to ShipSize enum
 */
function mapHangarSizeToShipSize(hangarSize?: string): ShipSize | undefined {
  if (!hangarSize) return undefined;

  const sizeMap: Record<string, ShipSize> = {
    Vehicle: ShipSize.VEHICLE,
    Snub: ShipSize.SNUB,
    Small: ShipSize.SMALL,
    Medium: ShipSize.MEDIUM,
    Large: ShipSize.LARGE,
    'Extra Large': ShipSize.CAPITAL,
    Docking: ShipSize.CAPITAL,
  };

  return sizeMap[hangarSize] || ShipSize.SMALL;
}

/**
 * Map CSV status to ShipStatus enum
 */
function mapStatusToEnum(status: string): ShipStatus {
  const statusMap: Record<string, ShipStatus> = {
    Released: ShipStatus.FLIGHT_READY,
    Concept: ShipStatus.IN_CONCEPT,
    'In Production': ShipStatus.IN_PRODUCTION,
    Announced: ShipStatus.ANNOUNCED,
  };

  return statusMap[status] || ShipStatus.FLIGHT_READY;
}

/**
 * Parse CSV file with proper handling of quoted fields
 */
function parseCSV(filePath: string): ShipRecord[] {
  // CWE-22: Validate file path to prevent path traversal
  const resolvedPath = path.resolve(filePath);
  const projectRoot = path.resolve(__dirname, '..');
  if (!resolvedPath.startsWith(projectRoot)) {
    throw new Error(`Path traversal detected: ${filePath} is outside the project directory`);
  }
  if (!resolvedPath.endsWith('.csv')) {
    throw new Error('Only .csv files are allowed');
  }

  const content = fs.readFileSync(resolvedPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = parseCSVLine(lines[0]);
  const records: ShipRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const record: ShipRecord = {
      Name: '',
      Manufacturer: '',
      Type: '',
      Status: '',
    };
    headers.forEach((header, index) => {
      record[header as keyof ShipRecord] = values[index] || '';
    });

    records.push(record);
  }

  return records;
}

/**
 * Parse a single CSV line, handling quoted fields and escaped quotes
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Generate unique ship ID based on name and manufacturer
 */
function generateShipId(name: string, manufacturer: string): string {
  const cleaned = `${name}-${manufacturer}`
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');

  return cleaned;
}

/**
 * Create a normalized key for comparison (ignores spacing/casing)
 */
function normalizeKey(name: string, manufacturer: string): string {
  return `${name.toLowerCase().trim()}-${manufacturer.toLowerCase().trim()}`;
}

/**
 * Compare two records to detect changes
 */
function recordsChanged(old: ShipRecord, newRecord: ShipRecord): boolean {
  const fieldsToCompare: (keyof ShipRecord)[] = [
    'Career',
    'Role',
    'Subtype',
    'Crew Size',
    'SCU',
    'Hangar Size',
    'QT Fuel Capacity',
    'Status',
  ];

  return fieldsToCompare.some(field => {
    const oldVal = String(old[field] || '').trim();
    const newVal = String(newRecord[field] || '').trim();
    return oldVal !== newVal;
  });
}

/**
 * Calculate delta between old and new CSV files
 */
function calculateDelta(oldRecords: ShipRecord[], newRecords: ShipRecord[]): ShipDelta {
  const oldMap = new Map<string, ShipRecord>();
  const newMap = new Map<string, ShipRecord>();

  // Build maps
  oldRecords.forEach(record => {
    const key = normalizeKey(record.Name, record.Manufacturer);
    oldMap.set(key, record);
  });

  newRecords.forEach(record => {
    const key = normalizeKey(record.Name, record.Manufacturer);
    newMap.set(key, record);
  });

  const delta: ShipDelta = {
    added: [],
    updated: [],
    deleted: [],
  };

  // Find new and updated
  newMap.forEach((newRecord, key) => {
    const oldRecord = oldMap.get(key);
    if (!oldRecord) {
      delta.added.push(newRecord);
    } else if (recordsChanged(oldRecord, newRecord)) {
      delta.updated.push({ old: oldRecord, new: newRecord });
    }
  });

  // Find deleted
  oldMap.forEach((oldRecord, key) => {
    if (!newMap.has(key)) {
      delta.deleted.push(oldRecord);
    }
  });

  return delta;
}

/**
 * Convert ShipRecord to Ship entity properties
 */
function recordToShipProps(record: ShipRecord): Partial<Ship> {
  const crewSize = record['Crew Size']
    ? Number.parseInt(String(record['Crew Size']), 10)
    : undefined;
  const scu = record.SCU ? Number.parseInt(String(record.SCU), 10) : undefined;
  const qtFuelCapacity = record['QT Fuel Capacity']
    ? Number.parseFloat(String(record['QT Fuel Capacity']))
    : undefined;

  const isVehicle = record.Type === 'Vehicle';

  return {
    description: record.Subtype || undefined,
    role: record.Role || undefined,
    roles: record.Career ? [record.Career] : undefined,
    size: mapHangarSizeToShipSize(record['Hangar Size']),
    status: mapStatusToEnum(record.Status),
    crew: crewSize,
    cargo: isVehicle ? scu : scu,
    vehicleCargo: isVehicle ? scu : undefined,
    quantumFuelCapacity: qtFuelCapacity,
    hangarSize: record['Hangar Size'] || undefined,
    isVehicle: isVehicle,
    metadata: {
      claimTime: record['Claim Time'] || null,
      expediteTime: record['Expedite Time'] || null,
      subtype: record.Subtype || null,
    },
  };
}

/**
 * Apply delta to database
 */
async function applyDelta(delta: ShipDelta): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const shipRepository = AppDataSource.getRepository(Ship);
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.startTransaction();

  try {
    console.log('\n📊 Applying Delta:');

    // Handle deletions
    if (delta.deleted.length > 0) {
      console.log(`\n🗑️  Deleting ${delta.deleted.length} ships...`);
      const idsToDelete = delta.deleted.map(record =>
        generateShipId(record.Name, record.Manufacturer)
      );

      await queryRunner.manager.delete(Ship, {
        id: In(idsToDelete),
        organizationId: IsNull(),
      });

      delta.deleted.forEach(record => {
        console.log(`   ❌ Deleted: ${record.Name} (${record.Manufacturer})`);
      });
    }

    // Handle additions
    if (delta.added.length > 0) {
      console.log(`\n✨ Adding ${delta.added.length} ships...`);

      for (const record of delta.added) {
        const shipId = generateShipId(record.Name, record.Manufacturer);
        const ship = new Ship();
        ship.id = shipId;
        ship.name = record.Name;
        ship.manufacturer = record.Manufacturer;
        ship.isActive = true;
        ship.organizationId = null;

        Object.assign(ship, recordToShipProps(record));

        await queryRunner.manager.save(ship);
        console.log(`   ✅ Added: ${record.Name} (${record.Manufacturer})`);
      }
    }

    // Handle updates
    if (delta.updated.length > 0) {
      console.log(`\n🔄 Updating ${delta.updated.length} ships...`);

      for (const { old: oldRecord, new: newRecord } of delta.updated) {
        const shipId = generateShipId(oldRecord.Name, oldRecord.Manufacturer);

        const updates = recordToShipProps(newRecord);

        await queryRunner.manager.update(
          Ship,
          {
            id: shipId,
            organizationId: IsNull(),
          },
          updates
        );

        console.log(`   🔄 Updated: ${newRecord.Name} (${newRecord.Manufacturer})`);
      }
    }

    // Commit transaction
    await queryRunner.commitTransaction();

    console.log('\n✨ Delta Applied Successfully!');
  } catch (err) {
    await queryRunner.rollbackTransaction();
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

/**
 * Update ships from delta between old and new CSV files
 */
async function updateShipsFromDelta(): Promise<void> {
  console.log('🔄 Star Citizen Ship Database - Delta Update');
  console.log('==========================================\n');

  // Get file paths from command line or use defaults
  const args = process.argv.slice(2);
  const oldCsvPath =
    args[0] || path.join(__dirname, '../..', 'scripts', 'merged-ships-vehicles.csv.bak');
  const newCsvPath =
    args[1] || path.join(__dirname, '../..', 'scripts', 'merged-ships-vehicles.csv');

  // Validate files exist
  if (!fs.existsSync(oldCsvPath)) {
    throw new Error(`Old CSV file not found at ${oldCsvPath}`);
  }

  if (!fs.existsSync(newCsvPath)) {
    throw new Error(`New CSV file not found at ${newCsvPath}`);
  }

  console.log(`📂 Old CSV: ${oldCsvPath}`);
  console.log(`📂 New CSV: ${newCsvPath}\n`);

  // Parse CSV files
  console.log('📖 Parsing CSV files...');
  const oldRecords = parseCSV(oldCsvPath);
  const newRecords = parseCSV(newCsvPath);

  console.log(`   Old CSV: ${oldRecords.length} records`);
  console.log(`   New CSV: ${newRecords.length} records\n`);

  // Calculate delta
  console.log('🔍 Calculating delta...');
  const delta = calculateDelta(oldRecords, newRecords);

  console.log(`\n📋 Delta Summary:`);
  console.log(`   ✨ New:     ${delta.added.length}`);
  console.log(`   🔄 Updated: ${delta.updated.length}`);
  console.log(`   🗑️  Deleted: ${delta.deleted.length}`);
  console.log(`   📊 Total:   ${delta.added.length + delta.updated.length + delta.deleted.length}`);

  // Confirm before applying
  if (delta.added.length === 0 && delta.updated.length === 0 && delta.deleted.length === 0) {
    console.log('\n✅ No changes detected. Database is up-to-date.');
    process.exit(0);
  }

  // Apply delta to database
  await applyDelta(delta);

  console.log('\n✨ Ship database updated successfully!');
  process.exit(0);
}

// Run update
updateShipsFromDelta().catch(err => {
  console.error('💥 Update failed:', err);
  process.exit(1);
});
