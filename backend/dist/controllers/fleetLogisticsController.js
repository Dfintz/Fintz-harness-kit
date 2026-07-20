"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetLogisticsController = void 0;
const FleetLogisticsService_1 = require("../services/fleet/FleetLogisticsService");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class FleetLogisticsController extends BaseController_1.BaseController {
    logisticsService = new FleetLogisticsService_1.FleetLogisticsService();
    constructor() {
        super();
    }
    createLogistics = async (req, res) => {
        await this.execute(req, res, async () => {
            const logistics = await this.logisticsService.create(req.body);
            res.status(201).json(logistics);
        });
    };
    getLogistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { fleetId } = req.query;
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.logisticsService.findAll(paginationOptions, fleetId);
        });
    };
    getLogisticsById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.logisticsService.findById(req.params.id));
    };
    updateLogistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.logisticsService.update(req.params.id, req.body));
    };
    updateStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.logisticsService.updateStatus(req.params.id, req.body.status));
    };
    calculateFuelRequirements = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const logistics = await this.logisticsService.findById(req.params.id);
            return this.logisticsService.calculateFuelRequirements(logistics);
        });
    };
    calculateCargoCapacity = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const logistics = await this.logisticsService.findById(req.params.id);
            return this.logisticsService.calculateCargoCapacity(logistics);
        });
    };
    calculateJumpRange = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const logistics = await this.logisticsService.findById(req.params.id);
            return this.logisticsService.calculateJumpRange(logistics);
        });
    };
    deleteLogistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            await this.logisticsService.delete(req.params.id);
            return { message: 'Fleet logistics deleted successfully' };
        });
    };
}
exports.FleetLogisticsController = FleetLogisticsController;
//# sourceMappingURL=fleetLogisticsController.js.map