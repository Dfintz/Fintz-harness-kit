"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MiningOperationController = void 0;
const RegolithService_1 = require("../services/content/RegolithService");
const MiningOperationService_1 = require("../services/mining/MiningOperationService");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class MiningOperationController extends BaseController_1.BaseController {
    miningService = new MiningOperationService_1.MiningOperationService();
    constructor() {
        super();
    }
    createMiningOperation = async (req, res) => {
        await this.execute(req, res, async () => {
            const operation = await this.miningService.create(req.body);
            res.status(201).json(operation);
        });
    };
    getMiningOperations = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.miningService.findAll(paginationOptions);
        });
    };
    getMiningOperationById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.miningService.findById(req.params.id));
    };
    addCrewMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.miningService.addCrewMember(req.params.id, req.body));
    };
    recordResources = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.miningService.recordResources(req.params.id, req.body));
    };
    updateStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.miningService.updateStatus(req.params.id, req.body.status));
    };
    updateMiningOperation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.miningService.update(req.params.id, req.body));
    };
    deleteMiningOperation = async (req, res) => {
        await this.execute(req, res, async () => {
            await this.miningService.delete(req.params.id);
            res.status(204).send();
        });
    };
    getRegolithSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const location = decodeURIComponent(req.params.location);
            return RegolithService_1.RegolithService.getMiningDataSummary(location);
        });
    };
}
exports.MiningOperationController = MiningOperationController;
//# sourceMappingURL=miningOperationController.js.map