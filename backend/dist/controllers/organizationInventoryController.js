"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationInventoryController = void 0;
const OrganizationInventoryService_1 = require("../services/organization/OrganizationInventoryService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
const safeParseInt = (value) => {
    if (!value) {
        return undefined;
    }
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
};
class OrganizationInventoryController extends BaseController_1.BaseController {
    inventoryService = new OrganizationInventoryService_1.OrganizationInventoryService();
    constructor() {
        super();
    }
    createInventoryItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const { orgId } = req.params;
            const dto = req.body;
            const item = await this.inventoryService.createInventoryItem(orgId, dto);
            res.status(201).json(item);
        });
    };
    getInventory = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            const filters = {
                category: req.query.category,
                searchTerm: req.query.searchTerm,
                assignedTo: req.query.assignedTo,
                page: safeParseInt(req.query.page),
                limit: safeParseInt(req.query.limit) !== undefined ? Math.min(safeParseInt(req.query.limit), 200) : undefined,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
            };
            return this.inventoryService.getInventory(orgId, filters);
        });
    };
    getInventoryItem = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, id } = req.params;
            const item = await this.inventoryService.getInventoryItemById(orgId, id);
            if (!item) {
                throw new apiErrors_1.NotFoundError('Organization inventory item');
            }
            return item;
        });
    };
    updateInventoryItem = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId, id } = req.params;
            const dto = req.body;
            return this.inventoryService.updateInventoryItem(orgId, id, dto);
        });
    };
    deleteInventoryItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const { orgId, id } = req.params;
            await this.inventoryService.deleteInventoryItem(orgId, id);
            res.status(200).json({ message: 'Organization inventory item deleted successfully' });
        });
    };
    getInventoryStatistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = req.params;
            return this.inventoryService.getInventoryStatistics(orgId);
        });
    };
}
exports.OrganizationInventoryController = OrganizationInventoryController;
//# sourceMappingURL=organizationInventoryController.js.map