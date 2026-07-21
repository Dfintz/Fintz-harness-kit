import dotenv from 'dotenv';
dotenv.config();

import * as fs from 'node:fs';
import * as path from 'node:path';

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

/**
 * Map CSV hangar size to ShipSize enum
 */
function mapHangarSizeToShipSize(hangarSize?: string): ShipSize | undefined {
  if (!hangarSize) {
    return undefined;
  }

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
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = parseCSVLine(lines[0]);
  const records: ShipRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) {
      continue;
    }

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
 * Seed the database with ship data from CSV
 */
async function seedShips(): Promise<void> {
  console.log('🚀 Starting ship database seeding...');

  // Initialize database connection
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  // Apply OptionalTenantEntity nullable columns
  // TypeORM synchronize doesn't ALTER existing columns — run migration or apply manually
  await AppDataSource.query('ALTER TABLE ships ALTER COLUMN "organizationId" DROP NOT NULL').catch(
    () => {
      /* already nullable */
    }
  );
  await AppDataSource.query(
    'ALTER TABLE activities ALTER COLUMN "organizationId" DROP NOT NULL'
  ).catch(() => {
    /* already nullable */
  });

  const shipRepository = AppDataSource.getRepository(Ship);

  const csvPath = path.join(__dirname, '../..', 'scripts', 'merged-ships-vehicles.csv');

  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  console.log(`📂 Reading CSV from: ${csvPath}`);

  const records = parseCSV(csvPath);
  console.log(`📊 Found ${records.length} ship records to import`);

  let successCount = 0;
  let errorCount = 0;
  const errors: Array<{ record: ShipRecord; error: string }> = [];

  // Process each ship independently (no wrapping transaction) so one failure
  // does not cascade to all subsequent inserts.
  for (const record of records) {
    try {
      // Skip empty records
      if (!record.Name || !record.Manufacturer) {
        console.warn(`⚠️  Skipping record with missing name or manufacturer`);
        continue;
      }

      const shipId = generateShipId(record.Name, record.Manufacturer);

      // Check if ship already exists
      const existingShip = await shipRepository.findOne({
        where: {
          id: shipId,
        },
      });

      if (existingShip) {
        console.log(`ℹ️  Ship already exists: ${record.Name} (${record.Manufacturer})`);
        successCount++;
        continue;
      }

      // Parse numeric fields (round to integer for int DB columns)
      const crewSize = record['Crew Size']
        ? Number.parseInt(String(record['Crew Size']), 10)
        : undefined;
      const scu = record.SCU ? Number.parseInt(String(record.SCU), 10) : undefined;
      const qtFuelCapacity = record['QT Fuel Capacity']
        ? Math.round(Number.parseFloat(String(record['QT Fuel Capacity'])))
        : undefined;

      // Determine if vehicle or ship
      const isVehicle = record.Type === 'Vehicle';

      // Create ship entity
      const ship = new Ship();
      ship.id = shipId;
      ship.name = record.Name;
      ship.manufacturer = record.Manufacturer;
      ship.description = record.Subtype || undefined;
      ship.role = record.Role || undefined;
      ship.roles = record.Career ? [record.Career] : undefined;
      ship.size = mapHangarSizeToShipSize(record['Hangar Size']);
      ship.status = mapStatusToEnum(record.Status);
      ship.crew = crewSize;
      ship.cargo = isVehicle ? scu : scu;
      ship.vehicleCargo = isVehicle ? scu : undefined;
      ship.quantumFuelCapacity = qtFuelCapacity;
      ship.hangarSize = record['Hangar Size'] || undefined;
      ship.isVehicle = isVehicle;
      ship.isActive = true;
      // Global catalog ships have no organization — organizationId is nullable
      ship.organizationId = null as unknown as string;
      ship.metadata = {
        claimTime: record['Claim Time'] || null,
        expediteTime: record['Expedite Time'] || null,
        subtype: record.Subtype || null,
      };

      // Save ship (each save uses its own implicit transaction)
      await shipRepository.save(ship);
      console.log(`✅ Created ship: ${record.Name} (${record.Manufacturer})`);
      successCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error processing ship: ${record.Name} - ${errorMsg}`);
      errors.push({ record, error: errorMsg });
      errorCount++;
    }
  }

  console.log('\n✨ Seeding Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors:  ${errorCount}`);

  if (errors.length > 0) {
    console.log('\n⚠️  Failed Records:');
    errors.forEach(({ record, error }) => {
      console.log(`   - ${record.Name} (${record.Manufacturer}): ${error}`);
    });
  }

  await AppDataSource.destroy();

  console.log('\n🎉 Ship database seeding completed!');
  process.exit(successCount > 0 ? 0 : 1);
}

// Run seeding
seedShips().catch(err => {
  console.error('💥 Seeding failed:', err);
  process.exit(1);
});
