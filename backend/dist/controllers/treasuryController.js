"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreasuryController = void 0;
const CommissaryService_1 = require("../services/treasury/CommissaryService");
const DuesService_1 = require("../services/treasury/DuesService");
const TreasuryService_1 = require("../services/treasury/TreasuryService");
const pagination_1 = require("../utils/pagination");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class TreasuryController extends BaseController_1.BaseController {
    treasuryService;
    duesService;
    commissaryService;
    constructor() {
        super();
        this.treasuryService = (0, TreasuryService_1.getTreasuryService)();
        this.duesService = new DuesService_1.DuesService();
        this.commissaryService = new CommissaryService_1.CommissaryService();
    }
    getBalance = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const balance = await this.treasuryService.getBalance(organizationId);
            res.json(balance);
        });
    };
    getTransactions = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const pagination = (0, pagination_1.parsePaginationQuery)(req.query);
            const filters = {
                type: req.query.type,
                category: req.query.category,
                fromUserId: req.query.fromUserId,
                toUserId: req.query.toUserId,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
            };
            const result = await this.treasuryService.getTransactions(organizationId, pagination, filters);
            res.json(result);
        });
    };
    earnCredits = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const dto = req.body;
            const txn = await this.treasuryService.earnCredits(organizationId, userId, dto);
            res.status(201).json(txn);
        });
    };
    spendCredits = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const dto = req.body;
            const txn = await this.treasuryService.spendCredits(organizationId, userId, dto);
            res.status(201).json(txn);
        });
    };
    transferCredits = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const dto = req.body;
            const txn = await this.treasuryService.transferCredits(organizationId, userId, dto);
            res.status(201).json(txn);
        });
    };
    getStatistics = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const period = req.query.period;
            const stats = await this.treasuryService.getStatistics(organizationId, period);
            res.json(stats);
        });
    };
    getLeaderboard = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const rawLimit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
            const limit = typeof rawLimit === 'string' ? Number.parseInt(rawLimit, 10) : 10;
            const leaderboard = await this.treasuryService.getLeaderboard(organizationId, Number.isFinite(limit) && limit > 0 ? limit : 10);
            res.json(leaderboard);
        });
    };
    listDues = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const pagination = (0, pagination_1.parsePaginationQuery)(req.query);
            const activeOnly = (0, queryUtils_1.parseBooleanQuery)(req.query.activeOnly);
            const result = await this.duesService.listDues(organizationId, pagination, activeOnly);
            res.json(result);
        });
    };
    createDues = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const dto = req.body;
            const dues = await this.duesService.createDues(organizationId, userId, dto);
            res.status(201).json(dues);
        });
    };
    updateDues = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { duesId } = req.params;
            const dto = req.body;
            const dues = await this.duesService.updateDues(organizationId, duesId, dto);
            res.json(dues);
        });
    };
    deleteDues = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { duesId } = req.params;
            await this.duesService.deleteDues(organizationId, duesId);
            res.status(204).send();
        });
    };
    listCommissaryItems = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const pagination = (0, pagination_1.parsePaginationQuery)(req.query);
            const filters = {
                category: req.query.category,
                activeOnly: req.query.activeOnly !== 'false',
                searchTerm: req.query.searchTerm,
                sortBy: req.query.sortBy,
                sortOrder: req.query.sortOrder,
            };
            const result = await this.commissaryService.listItems(organizationId, pagination, filters);
            res.json(result);
        });
    };
    createCommissaryItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const dto = req.body;
            const item = await this.commissaryService.createItem(organizationId, userId, dto);
            res.status(201).json(item);
        });
    };
    updateCommissaryItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { itemId } = req.params;
            const dto = req.body;
            const item = await this.commissaryService.updateItem(organizationId, itemId, dto);
            res.json(item);
        });
    };
    deleteCommissaryItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { itemId } = req.params;
            await this.commissaryService.deleteItem(organizationId, itemId);
            res.status(204).send();
        });
    };
    purchaseItem = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const { itemId } = req.params;
            const { quantity } = req.body;
            const purchase = await this.commissaryService.purchaseItem(organizationId, userId, {
                itemId,
                quantity,
            });
            res.status(201).json(purchase);
        });
    };
    getPurchaseHistory = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const pagination = (0, pagination_1.parsePaginationQuery)(req.query);
            const buyerId = req.query.buyerId;
            const result = await this.commissaryService.getPurchaseHistory(organizationId, pagination, buyerId);
            res.json(result);
        });
    };
}
exports.TreasuryController = TreasuryController;
//# sourceMappingURL=treasuryController.js.map