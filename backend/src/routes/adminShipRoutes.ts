import { Request, Response, Router } from 'express';
import multer from 'multer';
import { IsNull } from 'typeorm';

import { AppDataSource } from '../config/database';
import { logAdminMutation } from '../middleware/adminAuth';
import { validateSchema } from '../middleware/schemaValidation';
import { Ship } from '../models/Ship';
import { adminShipSchemas } from '../schemas/adminShipSchemas';
import { logger } from '../utils/logger';

// Configure multer for CSV uploads (5MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

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

interface DeltaItem {
  name: string;
  manufacturer: string;
  shipId: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
}

interface ShipDelta {
  added: DeltaItem[];
  updated: DeltaItem[];
  deleted: DeltaItem[];
  total: number;
}

/**
 * Parse CSV file with proper handling of quoted fields
 */
function parseCSV(content: string): ShipRecord[] {
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
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
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
 * Generate unique ship ID
 */
function generateShipId(name: string, manufacturer: string): string {
  return `${name}-${manufacturer}`
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

/**
 * Normalize key for comparison
 */
function normalizeKey(name: string, manufacturer: string): string {
  return `${name.toLowerCase().trim()}-${manufacturer.toLowerCase().trim()}`;
}

/**
 * POST /api/admin/ships/preview-delta
 * Upload CSV and preview delta without applying
 */
async function previewDelta(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No CSV file provided' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const newRecords = parseCSV(csvContent);

    // Get current ships from database
    const shipRepository = AppDataSource.getRepository(Ship);
    const currentShips = await shipRepository.find({
      where: { organizationId: IsNull() },
    });

    // Build maps
    const currentMap = new Map<string, Ship>();
    currentShips.forEach(ship => {
      const key = normalizeKey(ship.name, ship.manufacturer);
      currentMap.set(key, ship);
    });

    const newMap = new Map<string, ShipRecord>();
    newRecords.forEach(record => {
      const key = normalizeKey(record.Name, record.Manufacturer);
      newMap.set(key, record);
    });

    const delta: ShipDelta = {
      added: [],
      updated: [],
      deleted: [],
      total: 0,
    };

    // Find new ships
    newMap.forEach((newRecord, key) => {
      const currentShip = currentMap.get(key);

      if (!currentShip) {
        delta.added.push({
          name: newRecord.Name,
          manufacturer: newRecord.Manufacturer,
          shipId: generateShipId(newRecord.Name, newRecord.Manufacturer),
        });
      } else {
        // Check for changes
        const changes: Record<string, { old: unknown; new: unknown }> = {};
        const fieldsToCheck: (keyof ShipRecord)[] = [
          'Career',
          'Role',
          'Subtype',
          'Crew Size',
          'SCU',
          'Hangar Size',
          'QT Fuel Capacity',
          'Status',
        ];

        fieldsToCheck.forEach(field => {
          const oldVal = String(currentShip[field.toLowerCase() as keyof Ship] || '').trim();
          const newVal = String(newRecord[field] || '').trim();

          if (oldVal !== newVal) {
            changes[field] = { old: oldVal || null, new: newVal || null };
          }
        });

        if (Object.keys(changes).length > 0) {
          delta.updated.push({
            name: newRecord.Name,
            manufacturer: newRecord.Manufacturer,
            shipId: currentShip.id,
            changes,
          });
        }
      }
    });

    // Find deleted ships
    currentMap.forEach((currentShip, key) => {
      if (!newMap.has(key)) {
        delta.deleted.push({
          name: currentShip.name,
          manufacturer: currentShip.manufacturer,
          shipId: currentShip.id,
        });
      }
    });

    delta.total = delta.added.length + delta.updated.length + delta.deleted.length;

    res.json(delta);
  } catch (err: unknown) {
    logger.error('Error previewing delta', { error: err });
    res.status(500).json({ error: 'Failed to preview delta' });
  }
}

const CSV_FIELD_MAP: Record<string, keyof Ship> = {
  Role: 'role',
  'Crew Size': 'crew',
  SCU: 'cargo',
  'Hangar Size': 'hangarSize',
  'QT Fuel Capacity': 'quantumFuelCapacity',
  Status: 'status',
};
const NUMERIC_SHIP_FIELDS = new Set(['crew', 'cargo', 'quantumFuelCapacity']);

function applyCsvFieldUpdates(ship: Ship, record: ShipRecord): boolean {
  let hasChanges = false;
  for (const [csvField, entityField] of Object.entries(CSV_FIELD_MAP)) {
    const newVal = String(record[csvField as keyof ShipRecord] || '').trim();
    const oldVal = String(ship[entityField] ?? '').trim();
    if (newVal === '' || newVal === oldVal) {
      continue;
    }

    if (NUMERIC_SHIP_FIELDS.has(entityField)) {
      const num = Number(newVal);
      if (!Number.isNaN(num)) {
        (ship as unknown as Record<string, unknown>)[entityField] = num;
        hasChanges = true;
      }
    } else {
      (ship as unknown as Record<string, unknown>)[entityField] = newVal;
      hasChanges = true;
    }
  }
  return hasChanges;
}

/**
 * POST /api/admin/ships/apply-delta
 * Apply CSV delta to database
 */
function createShipFromRecord(record: ShipRecord): Ship {
  const ship = new Ship();
  ship.id = generateShipId(record.Name, record.Manufacturer);
  ship.name = record.Name;
  ship.manufacturer = record.Manufacturer;
  ship.isActive = true;
  ship.organizationId = null;
  if (record.Role) {
    ship.role = String(record.Role);
  }
  if (record['Crew Size']) {
    ship.crew = Number(record['Crew Size']) || undefined;
  }
  if (record.SCU) {
    ship.cargo = Number(record.SCU) || undefined;
  }
  if (record['Hangar Size']) {
    ship.hangarSize = String(record['Hangar Size']);
  }
  if (record['QT Fuel Capacity']) {
    ship.quantumFuelCapacity = Number(record['QT Fuel Capacity']) || undefined;
  }
  if (record.Status) {
    ship.status = record.Status as Ship['status'];
  }
  return ship;
}

interface DeltaResults {
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
}

async function saveNewRecord(
  queryRunner: import('typeorm').QueryRunner,
  record: ShipRecord,
  results: DeltaResults
): Promise<void> {
  try {
    await queryRunner.manager.save(createShipFromRecord(record));
    results.added++;
  } catch (err: unknown) {
    results.errors.push(`Failed to add ${record.Name}: ${err}`);
  }
}

async function saveUpdatedRecord(
  queryRunner: import('typeorm').QueryRunner,
  ship: Ship,
  record: ShipRecord,
  results: DeltaResults
): Promise<void> {
  if (!applyCsvFieldUpdates(ship, record)) {
    return;
  }
  try {
    await queryRunner.manager.save(ship);
    results.updated++;
  } catch (err: unknown) {
    results.errors.push(`Failed to update ${ship.name}: ${err}`);
  }
}

async function deleteRemovedRecords(
  queryRunner: import('typeorm').QueryRunner,
  newMap: Map<string, ShipRecord>,
  currentMap: Map<string, Ship>,
  results: DeltaResults
): Promise<void> {
  for (const [key, currentShip] of currentMap) {
    if (newMap.has(key)) {
      continue;
    }
    try {
      await queryRunner.manager.delete(Ship, {
        id: currentShip.id,
        organizationId: IsNull(),
      });
      results.deleted++;
    } catch (err: unknown) {
      results.errors.push(`Failed to delete ${currentShip.name}: ${err}`);
    }
  }
}

async function processDeltaRecords(
  queryRunner: import('typeorm').QueryRunner,
  newMap: Map<string, ShipRecord>,
  currentMap: Map<string, Ship>,
  results: DeltaResults
): Promise<void> {
  for (const [, newRecord] of newMap) {
    const key = normalizeKey(newRecord.Name, newRecord.Manufacturer);
    const currentShip = currentMap.get(key);
    if (currentShip) {
      await saveUpdatedRecord(queryRunner, currentShip, newRecord, results);
    } else {
      await saveNewRecord(queryRunner, newRecord, results);
    }
  }
  await deleteRemovedRecords(queryRunner, newMap, currentMap, results);
}

/**
 * POST /api/admin/ships/apply-delta
 * Apply CSV delta to database
 */
async function applyDelta(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No CSV file provided' });
      return;
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const newRecords = parseCSV(csvContent);

    const shipRepository = AppDataSource.getRepository(Ship);
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.startTransaction();

    const results: DeltaResults = { added: 0, updated: 0, deleted: 0, errors: [] };

    try {
      const currentShips = await shipRepository.find({
        where: { organizationId: IsNull() },
      });

      const currentMap = new Map<string, Ship>();
      currentShips.forEach(ship => {
        currentMap.set(normalizeKey(ship.name, ship.manufacturer), ship);
      });

      const newMap = new Map<string, ShipRecord>();
      newRecords.forEach(record => {
        newMap.set(normalizeKey(record.Name, record.Manufacturer), record);
      });

      await processDeltaRecords(queryRunner, newMap, currentMap, results);

      await queryRunner.commitTransaction();

      res.json({
        success: true,
        results,
        message: `Applied delta: ${results.added} added, ${results.updated} updated, ${results.deleted} deleted`,
      });
    } catch (err: unknown) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  } catch (err: unknown) {
    logger.error('Error applying delta', { error: err });
    res.status(500).json({ error: 'Failed to apply delta' });
  }
}

/**
 * GET /api/v2/admin/ships
 * List catalog ships with pagination, search, and filters
 */
async function listCatalogShips(req: Request, res: Response): Promise<void> {
  try {
    const { page, limit, search, manufacturer, size, status, isVehicle, isActive, sort, order } =
      req.query as Record<string, unknown>;

    const shipRepository = AppDataSource.getRepository(Ship);

    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 25;
    const sortField = String(sort || 'name');
    const rawOrder = typeof order === 'string' ? order : 'asc';
    const sortOrder = rawOrder.toUpperCase() as 'ASC' | 'DESC';

    // Whitelist sort columns to prevent injection via orderBy interpolation
    const validSortColumns: Record<string, string> = {
      name: 'ship.name',
      manufacturer: 'ship.manufacturer',
      size: 'ship.size',
      status: 'ship.status',
      updatedAt: 'ship.updatedAt',
      createdAt: 'ship.createdAt',
    };
    const sortColumn = validSortColumns[sortField] || 'ship.name';

    let queryBuilder = shipRepository.createQueryBuilder('ship');

    if (search) {
      const searchStr = String(search).toLowerCase();
      queryBuilder = queryBuilder.andWhere(
        '(LOWER(ship.name) LIKE :search OR LOWER(ship.manufacturer) LIKE :search)',
        { search: `%${searchStr}%` }
      );
    }
    if (manufacturer) {
      queryBuilder = queryBuilder.andWhere('LOWER(ship.manufacturer) LIKE :manufacturer', {
        manufacturer: `%${String(manufacturer).toLowerCase()}%`,
      });
    }
    if (size) {
      queryBuilder = queryBuilder.andWhere('ship.size = :size', { size });
    }
    if (status) {
      queryBuilder = queryBuilder.andWhere('ship.status = :status', { status });
    }
    if (isVehicle !== undefined) {
      queryBuilder = queryBuilder.andWhere('ship.isVehicle = :isVehicle', {
        isVehicle: isVehicle === true || isVehicle === 'true',
      });
    }
    if (isActive !== undefined) {
      queryBuilder = queryBuilder.andWhere('ship.isActive = :isActive', {
        isActive: isActive === true || isActive === 'true',
      });
    }

    const [data, total] = await queryBuilder
      .orderBy(sortColumn, sortOrder)
      .skip((pageNum - 1) * limitNum)
      .take(limitNum)
      .getManyAndCount();

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      data,
      pagination: {
        total,
        count: data.length,
        page: pageNum,
        pageSize: limitNum,
        hasMore: pageNum < totalPages,
        totalPages,
      },
    });
  } catch (err: unknown) {
    logger.error('Error listing catalog ships', { error: err });
    res.status(500).json({ error: 'Failed to list catalog ships' });
  }
}

/**
 * GET /api/v2/admin/ships/:shipId
 * Get a single catalog ship by ID
 */
async function getCatalogShip(req: Request, res: Response): Promise<void> {
  try {
    const { shipId } = req.params;
    const shipRepository = AppDataSource.getRepository(Ship);

    const ship = await shipRepository.findOne({
      where: { id: shipId },
    });

    if (!ship) {
      res.status(404).json({ error: 'Ship not found in catalog' });
      return;
    }

    res.json(ship);
  } catch (err: unknown) {
    logger.error('Error getting catalog ship', { error: err });
    res.status(500).json({ error: 'Failed to get catalog ship' });
  }
}

/**
 * POST /api/v2/admin/ships
 * Create a new catalog ship
 */
async function createCatalogShip(req: Request, res: Response): Promise<void> {
  try {
    const shipRepository = AppDataSource.getRepository(Ship);
    const dto = req.body as Record<string, unknown>;

    const shipId = generateShipId(dto.name as string, dto.manufacturer as string);

    // Check for duplicate
    const existing = await shipRepository.findOne({
      where: { id: shipId },
    });

    if (existing) {
      res.status(409).json({
        error: 'A ship with this name and manufacturer already exists in the catalog',
      });
      return;
    }

    const ship = shipRepository.create({
      ...dto,
      id: shipId,
      organizationId: null,
    });
    await shipRepository.save(ship);

    logger.info('Admin created catalog ship', { shipId: ship.id, name: ship.name });
    res.status(201).json(ship);
  } catch (err: unknown) {
    logger.error('Error creating catalog ship', { error: err });
    res.status(500).json({ error: 'Failed to create catalog ship' });
  }
}

/**
 * PUT /api/v2/admin/ships/:shipId
 * Update an existing catalog ship
 */
async function updateCatalogShip(req: Request, res: Response): Promise<void> {
  try {
    const { shipId } = req.params;
    const shipRepository = AppDataSource.getRepository(Ship);

    const ship = await shipRepository.findOne({
      where: { id: shipId },
    });

    if (!ship) {
      res.status(404).json({ error: 'Ship not found in catalog' });
      return;
    }

    const dto = req.body;
    Object.assign(ship, dto);
    await shipRepository.save(ship);

    logger.info('Admin updated catalog ship', { shipId: ship.id, name: ship.name });
    res.json(ship);
  } catch (err: unknown) {
    logger.error('Error updating catalog ship', { error: err });
    res.status(500).json({ error: 'Failed to update catalog ship' });
  }
}

/**
 * DELETE /api/v2/admin/ships/:shipId
 * Delete a catalog ship
 */
async function deleteCatalogShip(req: Request, res: Response): Promise<void> {
  try {
    const { shipId } = req.params;
    const shipRepository = AppDataSource.getRepository(Ship);

    const ship = await shipRepository.findOne({
      where: { id: shipId },
    });

    if (!ship) {
      res.status(404).json({ error: 'Ship not found in catalog' });
      return;
    }

    await shipRepository.remove(ship);

    logger.info('Admin deleted catalog ship', { shipId, name: ship.name });
    res.json({ success: true, message: `Ship "${ship.name}" deleted from catalog` });
  } catch (err: unknown) {
    logger.error('Error deleting catalog ship', { error: err });
    res.status(500).json({ error: 'Failed to delete catalog ship' });
  }
}

/**
 * Setup admin ship routes
 */
export function setupAdminShipRoutes(router: Router): void {
  // Admin authentication is handled by the parent admin router (routes/v2/admin.ts)

  // === Individual CRUD routes ===

  // List catalog ships with pagination/filters
  router.get(
    '/ships',
    validateSchema(adminShipSchemas.catalogShipQuery, 'query'),
    async (req, res) => {
      await listCatalogShips(req, res);
    }
  );

  // Get single catalog ship
  router.get(
    '/ships/:shipId',
    validateSchema(adminShipSchemas.catalogShipParam, 'params'),
    async (req, res) => {
      await getCatalogShip(req, res);
    }
  );

  // Create catalog ship
  router.post(
    '/ships',
    logAdminMutation,
    validateSchema(adminShipSchemas.createCatalogShip, 'body'),
    async (req, res) => {
      await createCatalogShip(req, res);
    }
  );

  // Update catalog ship
  router.put(
    '/ships/:shipId',
    logAdminMutation,
    validateSchema(adminShipSchemas.catalogShipParam, 'params'),
    validateSchema(adminShipSchemas.updateCatalogShip, 'body'),
    async (req, res) => {
      await updateCatalogShip(req, res);
    }
  );

  // Delete catalog ship
  router.delete(
    '/ships/:shipId',
    logAdminMutation,
    validateSchema(adminShipSchemas.catalogShipParam, 'params'),
    async (req, res) => {
      await deleteCatalogShip(req, res);
    }
  );

  // === Bulk CSV routes ===

  // Preview delta without applying
  router.post('/ships/preview-delta', upload.single('csvFile'), async (req, res) => {
    await previewDelta(req, res);
  });

  // Apply delta to database
  router.post(
    '/ships/apply-delta',
    logAdminMutation,
    upload.single('csvFile'),
    async (req, res) => {
      await applyDelta(req, res);
    }
  );
}
