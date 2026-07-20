"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LootController = void 0;
const LootPool_1 = require("../models/LootPool");
const LootDistributionService_1 = require("../services/loot/LootDistributionService");
const LootOcrService_1 = require("../services/loot/LootOcrService");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class LootController extends BaseController_1.BaseController {
    lootService;
    ocrService;
    constructor() {
        super();
        this.lootService = (0, LootDistributionService_1.getLootDistributionService)();
        this.ocrService = (0, LootOcrService_1.getLootOcrService)();
    }
    listPools = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const pagination = (0, pagination_1.parsePaginationQuery)(req.query);
            const filters = {
                activityId: req.query.activityId,
                status: req.query.status,
            };
            const result = await this.lootService.listPools(organizationId, pagination, filters);
            res.json(result);
        });
    };
    getPool = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { poolId } = req.params;
            const pool = await this.lootService.getPoolDetail(organizationId, poolId);
            if (!pool) {
                res.status(404).json({ message: 'Loot pool not found' });
                return;
            }
            res.json(pool);
        });
    };
    createPool = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const dto = req.body;
            const pool = await this.lootService.createPool(organizationId, userId, dto);
            res.status(201).json(pool);
        });
    };
    updatePool = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const dto = req.body;
            const pool = await this.lootService.updatePool(organizationId, poolId, userId, dto);
            res.json(pool);
        });
    };
    lockPool = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const pool = await this.lootService.lockPool(organizationId, poolId, userId);
            res.json(pool);
        });
    };
    cancelPool = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const pool = await this.lootService.cancelPool(organizationId, poolId, userId);
            res.json(pool);
        });
    };
    distributePool = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const result = await this.lootService.distribute(organizationId, poolId, userId);
            res.json(result);
        });
    };
    retryDistribution = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const result = await this.lootService.retryDistribution(organizationId, poolId, userId);
            res.json(result);
        });
    };
    getEligibleParticipants = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { poolId } = req.params;
            const pool = await this.lootService.getPoolById(organizationId, poolId);
            if (!pool) {
                res.status(404).json({ message: 'Loot pool not found' });
                return;
            }
            const participants = await this.lootService.getEligibleParticipants(pool);
            res.json(participants);
        });
    };
    addItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const dto = req.body;
            const item = await this.lootService.addItem(organizationId, poolId, userId, dto);
            res.status(201).json(item);
        });
    };
    addItemsBulk = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const items = req.body.items;
            const created = await this.lootService.addItemsBulk(organizationId, poolId, userId, items);
            res.status(201).json(created);
        });
    };
    updateItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId, itemId } = req.params;
            const dto = req.body;
            const item = await this.lootService.updateItem(organizationId, poolId, itemId, userId, dto);
            res.json(item);
        });
    };
    removeItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId, itemId } = req.params;
            await this.lootService.removeItem(organizationId, poolId, itemId, userId);
            res.status(204).send();
        });
    };
    assignItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId, itemId } = req.params;
            const targetUserId = req.body.userId;
            const item = await this.lootService.assignItem(organizationId, poolId, itemId, userId, targetUserId);
            res.json(item);
        });
    };
    claimItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { poolId, itemId } = req.params;
            const dto = req.body;
            const claim = await this.lootService.claimItem(organizationId, poolId, itemId, { id: user.id, name: user.username ?? user.id }, dto);
            res.status(201).json(claim);
        });
    };
    withdrawClaim = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId, itemId } = req.params;
            await this.lootService.withdrawClaim(organizationId, poolId, itemId, userId);
            res.status(204).send();
        });
    };
    scanImage = async (req, res) => {
        await this.execute(req, res, async () => {
            this.getOrganizationId(req);
            const file = req.file;
            if (!file?.buffer) {
                throw new apiErrors_1.ValidationError('An image file is required (field name: "image")');
            }
            const result = await this.ocrService.extractItems(file.buffer);
            res.json(result);
        });
    };
    scanImageForPool = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { poolId } = req.params;
            const pool = await this.lootService.getPoolById(organizationId, poolId);
            if (!pool) {
                res.status(404).json({ message: 'Loot pool not found' });
                return;
            }
            if (pool.status !== LootPool_1.LootPoolStatus.OPEN) {
                throw new apiErrors_1.ConflictError('OCR scanning is only available while the loot pool is open');
            }
            await this.lootService.assertCanManagePool(organizationId, poolId, userId);
            const file = req.file;
            if (!file?.buffer) {
                throw new apiErrors_1.ValidationError('An image file is required (field name: "image")');
            }
            const result = await this.ocrService.extractItems(file.buffer);
            res.json(result);
        });
    };
}
exports.LootController = LootController;
//# sourceMappingURL=lootController.js.map