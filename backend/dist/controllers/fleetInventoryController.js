"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetInventoryController = void 0;
const fleet_1 = require("../services/fleet");
const apiErrors_1 = require("../utils/apiErrors");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BaseController_1 = require("./BaseController");
class FleetInventoryController extends BaseController_1.BaseController {
    inventoryService = new fleet_1.FleetInventoryService();
    constructor() {
        super();
    }
    createInventoryItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const dto = req.body;
            const item = await this.inventoryService.createInventoryItem(organizationId, dto);
            res.status(201).json(item);
        });
    };
    getInventory = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const safeQuery = (0, prototypePollutionPrevention_1.sanitizeQueryParams)(req.query, {
                fleetId: 'string',
                category: 'string',
                status: 'string',
                managerId: 'string',
                lowStockOnly: 'boolean',
                criticalOnly: 'boolean',
                searchTerm: 'string',
            });
            const filters = {
                fleetId: safeQuery.fleetId,
                category: safeQuery.category,
                status: safeQuery.status,
                managerId: safeQuery.managerId,
                lowStockOnly: safeQuery.lowStockOnly || false,
                criticalOnly: safeQuery.criticalOnly || false,
                searchTerm: safeQuery.searchTerm,
            };
            return this.inventoryService.getInventory(organizationId, filters);
        });
    };
    getInventoryItem = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { id } = req.params;
            const item = await this.inventoryService.getInventoryItemById(organizationId, id);
            if (!item) {
                throw new apiErrors_1.NotFoundError('Inventory item');
            }
            return item;
        });
    };
    updateInventoryItem = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { id } = req.params;
            const dto = req.body;
            return this.inventoryService.updateInventoryItem(organizationId, id, dto);
        });
    };
    adjustStock = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { id } = req.params;
            const dto = req.body;
            return this.inventoryService.adjustStock(organizationId, id, dto);
        });
    };
    deleteInventoryItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { id } = req.params;
            await this.inventoryService.deleteInventoryItem(organizationId, id);
            res.status(200).json({ message: 'Inventory item deleted successfully' });
        });
    };
    getInventoryStatistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { fleetId } = req.params;
            if (!fleetId || !UUID_REGEX.test(fleetId)) {
                throw new apiErrors_1.NotFoundError('Invalid fleet ID format');
            }
            return this.inventoryService.getInventoryStatistics(organizationId, fleetId);
        });
    };
    getInventoryByCategory = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { fleetId } = req.params;
            if (!fleetId || !UUID_REGEX.test(fleetId)) {
                throw new apiErrors_1.NotFoundError('Invalid fleet ID format');
            }
            return this.inventoryService.getInventoryByCategory(organizationId, fleetId);
        });
    };
    getLowStockReport = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { fleetId } = req.params;
            if (!fleetId || !UUID_REGEX.test(fleetId)) {
                throw new apiErrors_1.NotFoundError('Invalid fleet ID format');
            }
            return this.inventoryService.getLowStockReport(organizationId, fleetId);
        });
    };
}
exports.FleetInventoryController = FleetInventoryController;
//# sourceMappingURL=fleetInventoryController.js.map