"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupAdminShipRoutes = setupAdminShipRoutes;
const multer_1 = __importDefault(require("multer"));
const typeorm_1 = require("typeorm");
const database_1 = require("../config/database");
const adminAuth_1 = require("../middleware/adminAuth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const Ship_1 = require("../models/Ship");
const adminShipSchemas_1 = require("../schemas/adminShipSchemas");
const logger_1 = require("../utils/logger");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        }
        else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
});
function parseCSV(content) {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }
    const headers = parseCSVLine(lines[0]);
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) {
            continue;
        }
        const record = {
            Name: '',
            Manufacturer: '',
            Type: '',
            Status: '',
        };
        headers.forEach((header, index) => {
            record[header] = values[index] || '';
        });
        records.push(record);
    }
    return records;
}
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        }
        else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}
function generateShipId(name, manufacturer) {
    return `${name}-${manufacturer}`
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, '-')
        .replaceAll(/^-|-$/g, '');
}
function normalizeKey(name, manufacturer) {
    return `${name.toLowerCase().trim()}-${manufacturer.toLowerCase().trim()}`;
}
async function previewDelta(req, res) {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No CSV file provided' });
            return;
        }
        const csvContent = req.file.buffer.toString('utf-8');
        const newRecords = parseCSV(csvContent);
        const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
        const currentShips = await shipRepository.find({
            where: { organizationId: (0, typeorm_1.IsNull)() },
        });
        const currentMap = new Map();
        currentShips.forEach(ship => {
            const key = normalizeKey(ship.name, ship.manufacturer);
            currentMap.set(key, ship);
        });
        const newMap = new Map();
        newRecords.forEach(record => {
            const key = normalizeKey(record.Name, record.Manufacturer);
            newMap.set(key, record);
        });
        const delta = {
            added: [],
            updated: [],
            deleted: [],
            total: 0,
        };
        newMap.forEach((newRecord, key) => {
            const currentShip = currentMap.get(key);
            if (!currentShip) {
                delta.added.push({
                    name: newRecord.Name,
                    manufacturer: newRecord.Manufacturer,
                    shipId: generateShipId(newRecord.Name, newRecord.Manufacturer),
                });
            }
            else {
                const changes = {};
                const fieldsToCheck = [
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
                    const oldVal = String(currentShip[field.toLowerCase()] || '').trim();
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
    }
    catch (err) {
        logger_1.logger.error('Error previewing delta', { error: err });
        res.status(500).json({ error: 'Failed to preview delta' });
    }
}
const CSV_FIELD_MAP = {
    Role: 'role',
    'Crew Size': 'crew',
    SCU: 'cargo',
    'Hangar Size': 'hangarSize',
    'QT Fuel Capacity': 'quantumFuelCapacity',
    Status: 'status',
};
const NUMERIC_SHIP_FIELDS = new Set(['crew', 'cargo', 'quantumFuelCapacity']);
function applyCsvFieldUpdates(ship, record) {
    let hasChanges = false;
    for (const [csvField, entityField] of Object.entries(CSV_FIELD_MAP)) {
        const newVal = String(record[csvField] || '').trim();
        const oldVal = String(ship[entityField] ?? '').trim();
        if (newVal === '' || newVal === oldVal) {
            continue;
        }
        if (NUMERIC_SHIP_FIELDS.has(entityField)) {
            const num = Number(newVal);
            if (!Number.isNaN(num)) {
                ship[entityField] = num;
                hasChanges = true;
            }
        }
        else {
            ship[entityField] = newVal;
            hasChanges = true;
        }
    }
    return hasChanges;
}
function createShipFromRecord(record) {
    const ship = new Ship_1.Ship();
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
        ship.status = record.Status;
    }
    return ship;
}
async function saveNewRecord(queryRunner, record, results) {
    try {
        await queryRunner.manager.save(createShipFromRecord(record));
        results.added++;
    }
    catch (err) {
        results.errors.push(`Failed to add ${record.Name}: ${err}`);
    }
}
async function saveUpdatedRecord(queryRunner, ship, record, results) {
    if (!applyCsvFieldUpdates(ship, record)) {
        return;
    }
    try {
        await queryRunner.manager.save(ship);
        results.updated++;
    }
    catch (err) {
        results.errors.push(`Failed to update ${ship.name}: ${err}`);
    }
}
async function deleteRemovedRecords(queryRunner, newMap, currentMap, results) {
    for (const [key, currentShip] of currentMap) {
        if (newMap.has(key)) {
            continue;
        }
        try {
            await queryRunner.manager.delete(Ship_1.Ship, {
                id: currentShip.id,
                organizationId: (0, typeorm_1.IsNull)(),
            });
            results.deleted++;
        }
        catch (err) {
            results.errors.push(`Failed to delete ${currentShip.name}: ${err}`);
        }
    }
}
async function processDeltaRecords(queryRunner, newMap, currentMap, results) {
    for (const [, newRecord] of newMap) {
        const key = normalizeKey(newRecord.Name, newRecord.Manufacturer);
        const currentShip = currentMap.get(key);
        if (currentShip) {
            await saveUpdatedRecord(queryRunner, currentShip, newRecord, results);
        }
        else {
            await saveNewRecord(queryRunner, newRecord, results);
        }
    }
    await deleteRemovedRecords(queryRunner, newMap, currentMap, results);
}
async function applyDelta(req, res) {
    try {
        if (!req.file) {
            res.status(400).json({ error: 'No CSV file provided' });
            return;
        }
        const csvContent = req.file.buffer.toString('utf-8');
        const newRecords = parseCSV(csvContent);
        const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
        const queryRunner = database_1.AppDataSource.createQueryRunner();
        await queryRunner.startTransaction();
        const results = { added: 0, updated: 0, deleted: 0, errors: [] };
        try {
            const currentShips = await shipRepository.find({
                where: { organizationId: (0, typeorm_1.IsNull)() },
            });
            const currentMap = new Map();
            currentShips.forEach(ship => {
                currentMap.set(normalizeKey(ship.name, ship.manufacturer), ship);
            });
            const newMap = new Map();
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
        }
        catch (err) {
            await queryRunner.rollbackTransaction();
            throw err;
        }
        finally {
            await queryRunner.release();
        }
    }
    catch (err) {
        logger_1.logger.error('Error applying delta', { error: err });
        res.status(500).json({ error: 'Failed to apply delta' });
    }
}
async function listCatalogShips(req, res) {
    try {
        const { page, limit, search, manufacturer, size, status, isVehicle, isActive, sort, order } = req.query;
        const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
        const pageNum = Number(page) || 1;
        const limitNum = Number(limit) || 25;
        const sortField = String(sort || 'name');
        const rawOrder = typeof order === 'string' ? order : 'asc';
        const sortOrder = rawOrder.toUpperCase();
        const validSortColumns = {
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
            queryBuilder = queryBuilder.andWhere('(LOWER(ship.name) LIKE :search OR LOWER(ship.manufacturer) LIKE :search)', { search: `%${searchStr}%` });
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
    }
    catch (err) {
        logger_1.logger.error('Error listing catalog ships', { error: err });
        res.status(500).json({ error: 'Failed to list catalog ships' });
    }
}
async function getCatalogShip(req, res) {
    try {
        const { shipId } = req.params;
        const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
        const ship = await shipRepository.findOne({
            where: { id: shipId },
        });
        if (!ship) {
            res.status(404).json({ error: 'Ship not found in catalog' });
            return;
        }
        res.json(ship);
    }
    catch (err) {
        logger_1.logger.error('Error getting catalog ship', { error: err });
        res.status(500).json({ error: 'Failed to get catalog ship' });
    }
}
async function createCatalogShip(req, res) {
    try {
        const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
        const dto = req.body;
        const shipId = generateShipId(dto.name, dto.manufacturer);
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
        logger_1.logger.info('Admin created catalog ship', { shipId: ship.id, name: ship.name });
        res.status(201).json(ship);
    }
    catch (err) {
        logger_1.logger.error('Error creating catalog ship', { error: err });
        res.status(500).json({ error: 'Failed to create catalog ship' });
    }
}
async function updateCatalogShip(req, res) {
    try {
        const { shipId } = req.params;
        const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
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
        logger_1.logger.info('Admin updated catalog ship', { shipId: ship.id, name: ship.name });
        res.json(ship);
    }
    catch (err) {
        logger_1.logger.error('Error updating catalog ship', { error: err });
        res.status(500).json({ error: 'Failed to update catalog ship' });
    }
}
async function deleteCatalogShip(req, res) {
    try {
        const { shipId } = req.params;
        const shipRepository = database_1.AppDataSource.getRepository(Ship_1.Ship);
        const ship = await shipRepository.findOne({
            where: { id: shipId },
        });
        if (!ship) {
            res.status(404).json({ error: 'Ship not found in catalog' });
            return;
        }
        await shipRepository.remove(ship);
        logger_1.logger.info('Admin deleted catalog ship', { shipId, name: ship.name });
        res.json({ success: true, message: `Ship "${ship.name}" deleted from catalog` });
    }
    catch (err) {
        logger_1.logger.error('Error deleting catalog ship', { error: err });
        res.status(500).json({ error: 'Failed to delete catalog ship' });
    }
}
function setupAdminShipRoutes(router) {
    router.get('/ships', (0, schemaValidation_1.validateSchema)(adminShipSchemas_1.adminShipSchemas.catalogShipQuery, 'query'), async (req, res) => {
        await listCatalogShips(req, res);
    });
    router.get('/ships/:shipId', (0, schemaValidation_1.validateSchema)(adminShipSchemas_1.adminShipSchemas.catalogShipParam, 'params'), async (req, res) => {
        await getCatalogShip(req, res);
    });
    router.post('/ships', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminShipSchemas_1.adminShipSchemas.createCatalogShip, 'body'), async (req, res) => {
        await createCatalogShip(req, res);
    });
    router.put('/ships/:shipId', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminShipSchemas_1.adminShipSchemas.catalogShipParam, 'params'), (0, schemaValidation_1.validateSchema)(adminShipSchemas_1.adminShipSchemas.updateCatalogShip, 'body'), async (req, res) => {
        await updateCatalogShip(req, res);
    });
    router.delete('/ships/:shipId', adminAuth_1.logAdminMutation, (0, schemaValidation_1.validateSchema)(adminShipSchemas_1.adminShipSchemas.catalogShipParam, 'params'), async (req, res) => {
        await deleteCatalogShip(req, res);
    });
    router.post('/ships/preview-delta', upload.single('csvFile'), async (req, res) => {
        await previewDelta(req, res);
    });
    router.post('/ships/apply-delta', adminAuth_1.logAdminMutation, upload.single('csvFile'), async (req, res) => {
        await applyDelta(req, res);
    });
}
//# sourceMappingURL=adminShipRoutes.js.map