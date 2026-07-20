"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var FleetTenantController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FleetTenantController = void 0;
const tsyringe_1 = require("tsyringe");
const auth_1 = require("../middleware/auth");
const tenantContext_1 = require("../middleware/tenantContext");
const routing_1 = require("../routing");
const fleet_1 = require("../services/fleet");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const BaseController_1 = require("./BaseController");
let FleetTenantController = class FleetTenantController extends BaseController_1.BaseController {
    static { FleetTenantController_1 = this; }
    static DEFAULT_SHARED_LIMIT = 20;
    static MAX_SHARED_LIMIT = 100;
    fleetService;
    constructor() {
        super();
        this.fleetService = new fleet_1.FleetService();
    }
    async list(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const fleets = await this.fleetService.getAllFleets(organizationId, {
                order: { name: 'ASC' },
            });
            logger_1.logger.info('Fleets retrieved', {
                organizationId,
                count: fleets.length,
            });
            return fleets;
        });
    }
    async listShared(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const pagination = this.getSharedFleetPagination(req.query);
            const result = await this.fleetService.getSharedFleetsPaginated(organizationId, {
                limit: pagination.limit,
                offset: pagination.offset,
            });
            logger_1.logger.info('Shared fleets retrieved', {
                organizationId,
                count: result.data.length,
                total: result.pagination.total,
                limit: result.pagination.limit,
                offset: result.pagination.offset,
            });
            return result;
        });
    }
    getSharedFleetPagination(query) {
        const limitParam = this.parseOptionalQueryInteger(query.limit);
        const offsetParam = this.parseOptionalQueryInteger(query.offset);
        const limit = Math.min(Math.max(limitParam ?? FleetTenantController_1.DEFAULT_SHARED_LIMIT, 1), FleetTenantController_1.MAX_SHARED_LIMIT);
        const offset = Math.max(offsetParam ?? 0, 0);
        return {
            limit,
            offset,
        };
    }
    parseOptionalQueryInteger(value) {
        const rawValue = Array.isArray(value) ? value[0] : value;
        if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
            return Math.trunc(rawValue);
        }
        if (typeof rawValue === 'string') {
            const trimmed = rawValue.trim();
            if (!trimmed) {
                return null;
            }
            const parsed = Number.parseInt(trimmed, 10);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }
    async getStatistics(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const statistics = await this.fleetService.getFleetStatistics(organizationId);
            logger_1.logger.info('Fleet statistics retrieved', { organizationId });
            return statistics;
        });
    }
    async search(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const { q } = req.query;
            if (!q || typeof q !== 'string') {
                throw new apiErrors_1.ValidationError('Search term required');
            }
            const fleets = await this.fleetService.searchFleetsByName(organizationId, q);
            logger_1.logger.info('Fleet search completed', {
                organizationId,
                query: q,
                count: fleets.length,
            });
            return fleets;
        });
    }
    async getById(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const { id } = req.params;
            if (!id) {
                throw new apiErrors_1.ValidationError('Fleet ID required');
            }
            const fleet = await this.fleetService.getFleetById(organizationId, id);
            if (!fleet) {
                res.status(404);
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            logger_1.logger.info('Fleet retrieved', { organizationId, fleetId: id });
            return fleet;
        });
    }
    async create(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const fleetData = req.body;
            const newFleet = await this.fleetService.createFleet(organizationId, fleetData);
            logger_1.logger.info('Fleet created', {
                organizationId,
                fleetId: newFleet.id,
            });
            return newFleet;
        }, 201);
    }
    async update(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const { id } = req.params;
            if (!id) {
                throw new apiErrors_1.ValidationError('Fleet ID required');
            }
            const updates = req.body;
            const fleet = await this.fleetService.updateFleet(organizationId, id, updates);
            logger_1.logger.info('Fleet updated', {
                organizationId,
                fleetId: id,
            });
            return fleet;
        });
    }
    async delete(req, res) {
        await this.execute(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const { id } = req.params;
            if (!id) {
                throw new apiErrors_1.ValidationError('Fleet ID required');
            }
            const fleet = await this.fleetService.getFleetById(organizationId, id);
            if (!fleet) {
                res.status(404);
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            await this.fleetService.deleteFleet(organizationId, id);
            logger_1.logger.info('Fleet deleted', { organizationId, fleetId: id });
            res.status(204).send();
        });
    }
    async share(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const { id } = req.params;
            if (!id) {
                throw new apiErrors_1.ValidationError('Fleet ID required');
            }
            const { targetOrganizationIds } = req.body;
            if (!targetOrganizationIds || !Array.isArray(targetOrganizationIds)) {
                throw new apiErrors_1.ValidationError('targetOrganizationIds must be an array');
            }
            const fleet = await this.fleetService.getFleetById(organizationId, id);
            if (!fleet) {
                res.status(404);
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            const updatedFleet = await this.fleetService.shareFleetWithMany(organizationId, id, targetOrganizationIds);
            logger_1.logger.info('Fleet shared', {
                organizationId,
                fleetId: id,
                targetOrganizations: targetOrganizationIds,
            });
            return updatedFleet;
        });
    }
    async unshare(req, res) {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.tenantContext?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization ID required');
            }
            const { id } = req.params;
            if (!id) {
                throw new apiErrors_1.ValidationError('Fleet ID required');
            }
            const { targetOrganizationIds } = req.body;
            if (!targetOrganizationIds || !Array.isArray(targetOrganizationIds)) {
                throw new apiErrors_1.ValidationError('targetOrganizationIds must be an array');
            }
            const fleet = await this.fleetService.getFleetById(organizationId, id);
            if (!fleet) {
                res.status(404);
                throw new apiErrors_1.NotFoundError('Fleet');
            }
            const updatedFleet = await this.fleetService.unshareFleetWithMany(organizationId, id, targetOrganizationIds);
            logger_1.logger.info('Fleet unshared', {
                organizationId,
                fleetId: id,
                targetOrganizations: targetOrganizationIds,
            });
            return updatedFleet;
        });
    }
};
exports.FleetTenantController = FleetTenantController;
__decorate([
    (0, routing_1.Get)('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "list", null);
__decorate([
    (0, routing_1.Get)('/shared'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "listShared", null);
__decorate([
    (0, routing_1.Get)('/statistics'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "getStatistics", null);
__decorate([
    (0, routing_1.Get)('/search'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "search", null);
__decorate([
    (0, routing_1.Get)('/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "getById", null);
__decorate([
    (0, routing_1.Post)('/'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "create", null);
__decorate([
    (0, routing_1.Put)('/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "update", null);
__decorate([
    (0, routing_1.Delete)('/:id'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "delete", null);
__decorate([
    (0, routing_1.Post)('/:id/share'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "share", null);
__decorate([
    (0, routing_1.Post)('/:id/unshare'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], FleetTenantController.prototype, "unshare", null);
exports.FleetTenantController = FleetTenantController = FleetTenantController_1 = __decorate([
    (0, tsyringe_1.injectable)(),
    (0, routing_1.Controller)('/fleets'),
    (0, routing_1.UseControllerMiddleware)(auth_1.authenticateToken, tenantContext_1.tenantContextMiddleware, tenantContext_1.requireTenantContext),
    __metadata("design:paramtypes", [])
], FleetTenantController);
//# sourceMappingURL=FleetTenantController.js.map