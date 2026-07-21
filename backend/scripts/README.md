# Ship Database Seeding

This directory contains scripts for seeding the ship database with Star Citizen ship data.

## Overview

The `seed-ships.ts` script reads the merged ship/vehicle CSV data and populates the `ships` table.
Features:

- CSV parsing with proper field quoting and escaping
- Status mapping (Released → FLIGHT_READY, Concept → IN_CONCEPT)
- Ship size detection from hangar size
- Vehicle vs Ship classification
- Global reference catalog seeding (organizationId = null)
- Transactional batch inserts with error handling

## CSV Data Source

The script expects the merged CSV file at: `scripts/merged-ships-vehicles.csv`

**CSV Format:**

```csv
Name,Manufacturer,Type,Career,Role,Subtype,Crew Size,SCU,Hangar Size,QT Fuel Capacity,Claim Time,Expedite Time,Status
100i,Origin,Ship,Exploration,Starter / Pathfinder,Ship,1,2,Small,1.3,0:03:21,0:01:07,Released
```

**Fields Mapped to Ship Entity:**

| CSV Field                 | Ship Entity         | Notes                                         |
| ------------------------- | ------------------- | --------------------------------------------- |
| Name                      | name                | Required                                      |
| Manufacturer              | manufacturer        | Required                                      |
| Hangar Size               | size (enum)         | Mapped to ShipSize enum                       |
| Status                    | status (enum)       | Released → FLIGHT_READY, Concept → IN_CONCEPT |
| Crew Size                 | crew                | Numeric                                       |
| SCU                       | cargo/vehicleCargo  | cargo for ships, vehicleCargo for vehicles    |
| QT Fuel Capacity          | quantumFuelCapacity | Numeric                                       |
| Career                    | roles[]             | Stored as array                               |
| Role                      | role                | String                                        |
| Subtype                   | description         | Text description                              |
| Claim Time, Expedite Time | metadata            | Stored in metadata JSON                       |

## Setup

1. **Ensure database is running:**

```bash
cd backend
npm install
npm run migration:run  # Apply any pending migrations
```

2. **Verify merged CSV exists:**

```bash
ls scripts/merged-ships-vehicles.csv
```

## Running the Seeding Script

### Option 1: NPM Script (Recommended)

```bash
cd backend
npm run seed:ships
```

### Option 2: Direct TypeScript Execution

```bash
cd backend
npx ts-node scripts/seed-ships.ts
```

### Option 3: After Building

```bash
cd backend
npm run build
node build/scripts/seed-ships.js
```

## Output

The script provides detailed logging:

```bash
🚀 Starting ship database seeding...
📂 Reading CSV from: /path/to/scripts/merged-ships-vehicles.csv
📊 Found 260 ship records to import
✅ Created ship: 100i (Origin)
✅ Created ship: 125a (Origin)
...
ℹ️  Ship already exists: Polaris (RSI)
...
✨ Seeding Summary:
   ✅ Success: 258
   ❌ Errors:  0

🎉 Ship database seeding completed!
```

## Key Features

### Duplicate Prevention

- Ships are identified by unique ID generated from name + manufacturer
- If a ship already exists (globally), it's skipped and logged
- Existing ships are NOT updated (use database migrations for schema changes)

### Transaction Safety

- All inserts are wrapped in a database transaction
- If any error occurs, the entire batch is rolled back
- No partial data state

### Global Catalog

- All ships are seeded with `organizationId = null`
- This marks them as part of the global reference catalog
- Individual organizations can later add custom ships via the API

### Vehicle Support

- Vehicles are identified by Type = 'Vehicle'
- They get `isVehicle = true` flag
- Use vehicleCargo instead of cargo field

## Mapping Details

### Status Enum Conversion

```
CSV Status → Ship.status Enum
"Released" → ShipStatus.FLIGHT_READY
"Concept" → ShipStatus.IN_CONCEPT
"In Production" → ShipStatus.IN_PRODUCTION
"Announced" → ShipStatus.ANNOUNCED
```

### Ship Size Enum Conversion

```
Hangar Size → ShipSize Enum
"Vehicle" → ShipSize.VEHICLE
"Snub" → ShipSize.SNUB
"Small" → ShipSize.SMALL
"Medium" → ShipSize.MEDIUM
"Large" → ShipSize.LARGE
"Extra Large" → ShipSize.CAPITAL
"Docking" → ShipSize.CAPITAL
(empty) → ShipSize.SMALL (default)
```

### ID Generation

Ship IDs are generated from name + manufacturer:

- Lowercase
- Non-alphanumeric chars → hyphens
- Trim leading/trailing hyphens
- Examples: "100i-Origin" → "100i-origin", "Ares Inferno-Crusader" → "ares-inferno-crusader"

## Troubleshooting

### "CSV file not found"

- Verify the merged CSV exists at `scripts/merged-ships-vehicles.csv`
- Run the merge script first: `node scripts/merge-ship-vehicle-data.js`

### "Connection Error"

- Ensure database is running: Check Docker containers or database service
- Verify connection string in `src/config/database.ts`
- Check environment variables (.env file)

### "Transaction Rolled Back"

- Check the error log output for details on which ship failed
- Validate CSV data (check for invalid numeric fields, encoding issues)
- Review database constraints and foreign key errors

### Ships Not Appearing in UI

- Verify `isActive = true` (all ships seeded with this flag)
- Check if filters are hiding inactive ships
- Query database directly: `SELECT COUNT(*) FROM ships WHERE "organizationId" IS NULL`

## Database Queries

### Count Seeded Ships

```sql
SELECT COUNT(*) FROM ships WHERE "organizationId" IS NULL;
```

### List All Seeded Ships

```sql
SELECT id, name, manufacturer, status, "isVehicle", "isActive"
FROM ships
WHERE "organizationId" IS NULL
ORDER BY name ASC;
```

### Find Ships by Status

```sql
SELECT name, manufacturer, status, COUNT(*) as count
FROM ships
WHERE "organizationId" IS NULL
GROUP BY status
ORDER BY status;
```

### Find Vehicles

```sql
SELECT name, manufacturer, size, "isVehicle"
FROM ships
WHERE "organizationId" IS NULL AND "isVehicle" = true
ORDER BY name;
```

## Post-Seeding

After seeding completes successfully:

1. **Verify Data:**

   ```bash
   npm run migration:show  # Check database state
   ```

2. **Test API:**

   ```bash
   npm run test           # Run unit tests
   npm run test:openapi   # Validate OpenAPI contracts
   ```

3. **Frontend Integration:**
   - Restart frontend dev server if running
   - Ships should appear in ship selection dropdowns and catalogs
   - Verify images/thumbnails load correctly (if URLs are populated)

4. **Backup Database:**
   ```bash
   # PostgreSQL dump
   pg_dump -U postgres sc_fleet_manager > backup.sql
   ```

## Notes

- The script is idempotent: Running it multiple times won't create duplicates
- All ships are global reference data; user/organization ownership is tracked separately in
  UserShip/OrganizationShip entities
- Vehicle cargo capacity is stored in `vehicleCargo` field; ship cargo in `cargo` field
- Metadata JSON stores additional fields like claim time and expedite time for future use
