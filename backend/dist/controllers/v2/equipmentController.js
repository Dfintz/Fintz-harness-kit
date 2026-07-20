"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EquipmentController = void 0;
const EquipmentService_1 = require("../../services/equipment/EquipmentService");
const BaseController_1 = require("../BaseController");
class EquipmentController extends BaseController_1.BaseController {
    equipmentService;
    constructor() {
        super();
        this.equipmentService = new EquipmentService_1.EquipmentService();
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { type, status, ownerId, shipId } = req.query;
            const { page, limit } = this.getPaginationParams(req);
            const { equipment, total } = await this.equipmentService.listEquipment(organizationId, {
                type,
                status,
                ownerId,
                shipId,
            });
            res.json({
                success: true,
                ...this.createPaginatedResponse(equipment, total, page, limit),
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const item = await this.equipmentService.createEquipment(organizationId, userId, req.body);
            res.status(201).json({ success: true, data: item });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { equipmentId } = req.params;
            const item = await this.equipmentService.getEquipment(equipmentId, organizationId);
            if (!item) {
                res.status(404).json({ success: false, error: 'Equipment not found' });
                return;
            }
            res.json({ success: true, data: item });
        });
    };
    update = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { equipmentId } = req.params;
            const item = await this.equipmentService.updateEquipment(equipmentId, organizationId, userId, req.body);
            res.json({ success: true, data: item });
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { equipmentId } = req.params;
            await this.equipmentService.deleteEquipment(equipmentId, organizationId, userId);
            res.json({ success: true, message: `Equipment ${equipmentId} deleted` });
        });
    };
    checkCompatibility = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { equipmentId } = req.params;
            const shipId = req.query.shipId;
            const result = await this.equipmentService.checkCompatibility(equipmentId, shipId ?? '', organizationId);
            res.json({ success: true, data: result });
        });
    };
    getUserInventory = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { userId } = req.params;
            const inventory = await this.equipmentService.getUserInventory(organizationId, userId);
            res.json({ success: true, data: inventory });
        });
    };
    transfer = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { equipmentId } = req.params;
            const { toUserId } = req.body;
            const item = await this.equipmentService.transfer(equipmentId, organizationId, userId, toUserId);
            res.json({ success: true, data: item });
        });
    };
}
exports.EquipmentController = EquipmentController;
//# sourceMappingURL=equipmentController.js.map