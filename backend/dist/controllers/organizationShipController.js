"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationShipController = void 0;
const ship_1 = require("../services/ship");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const queryUtils_1 = require("../utils/queryUtils");
const BaseController_1 = require("./BaseController");
class OrganizationShipController extends BaseController_1.BaseController {
    orgShipService;
    constructor() {
        super();
        this.orgShipService = new ship_1.OrganizationShipService();
    }
    getOrgIdFromRequest(req) {
        const orgId = req.params.orgId ||
            req.tenantContext?.organizationId ||
            req.organizationId ||
            req
                .user?.organizationId ||
            req
                .user?.currentOrganizationId;
        if (!orgId) {
            throw new apiErrors_1.ValidationError('Organization context required');
        }
        return orgId;
    }
    getOrgShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            const filters = {
                shipId: req.query.shipId,
                role: this.parseRoleFilter(req.query.role),
                status: this.parseStatusFilter(req.query.status),
                condition: this.parseConditionFilter(req.query.condition),
                isAvailable: this.parseBooleanFilter(req.query.isAvailable),
                isCapital: this.parseBooleanFilter(req.query.isCapital),
                assignedCaptain: req.query.assignedCaptain,
                location: req.query.location,
                needsMaintenance: (0, queryUtils_1.parseBooleanQuery)(req.query.needsMaintenance) ? true : undefined,
                search: req.query.search,
            };
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.orgShipService.findOrgShips(organizationId, filters, paginationOptions);
        });
    };
    getOrgShipById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId ||
                req.user
                    ?.organizationId;
            const { shipId } = req.params;
            if (!organizationId || !shipId) {
                throw new Error('Organization context and ship ID required');
            }
            const ship = await this.orgShipService.getOrgShipById(organizationId, shipId);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            return ship;
        });
    };
    createOrgShip = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            const shipData = req.body;
            const ship = await this.orgShipService.createOrgShip(organizationId, shipData);
            res.status(201).json(ship);
        });
    };
    updateOrgShip = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId ||
                req.user
                    ?.organizationId;
            const { shipId } = req.params;
            if (!organizationId || !shipId) {
                throw new Error('Organization context and ship ID required');
            }
            const updates = req.body;
            const ship = await this.orgShipService.updateOrgShip(organizationId, shipId, updates);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            return ship;
        });
    };
    deleteOrgShip = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.organizationId ||
                req.user
                    ?.organizationId;
            const { shipId } = req.params;
            if (!organizationId || !shipId) {
                throw new Error('Organization context and ship ID required');
            }
            const success = await this.orgShipService.deleteOrgShip(organizationId, shipId);
            if (!success) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            res.status(204).send();
        });
    };
    assignCaptain = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId ||
                req.user
                    ?.organizationId;
            const { shipId } = req.params;
            const { captainId } = req.body;
            if (!organizationId || !shipId) {
                throw new Error('Organization context and ship ID required');
            }
            if (!captainId) {
                throw new Error('Captain ID is required');
            }
            const ship = await this.orgShipService.assignCaptain(organizationId, shipId, captainId);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            return ship;
        });
    };
    assignCrew = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId ||
                req.user
                    ?.organizationId;
            const { shipId } = req.params;
            const { crewIds } = req.body;
            if (!organizationId || !shipId) {
                throw new Error('Organization context and ship ID required');
            }
            if (!Array.isArray(crewIds)) {
                throw new TypeError('crewIds must be an array');
            }
            const ship = await this.orgShipService.assignCrew(organizationId, shipId, crewIds);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            return ship;
        });
    };
    addCrewMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId ||
                req.user
                    ?.organizationId;
            const { shipId, userId } = req.params;
            const { role } = req.body || {};
            if (!organizationId || !shipId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context, ship ID, and user ID required');
            }
            let normalizedRole;
            if (role !== null && role !== undefined) {
                if (typeof role !== 'string') {
                    throw new apiErrors_1.ValidationError('role must be a string');
                }
                const trimmedRole = role.trim();
                normalizedRole = trimmedRole || undefined;
            }
            const ship = await this.orgShipService.addCrewMember(organizationId, shipId, userId, normalizedRole);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            return ship;
        });
    };
    removeCrewMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId ||
                req.user
                    ?.organizationId;
            const { shipId, userId } = req.params;
            if (!organizationId || !shipId || !userId) {
                throw new Error('Organization context, ship ID, and user ID required');
            }
            const ship = await this.orgShipService.removeCrewMember(organizationId, shipId, userId);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            return ship;
        });
    };
    getShipsNeedingMaintenance = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            return this.orgShipService.getShipsNeedingMaintenance(organizationId);
        });
    };
    getCapitalShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.orgShipService.getCapitalShips(organizationId, paginationOptions);
        });
    };
    getShipsByRole = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            const { role } = req.params;
            if (!role) {
                throw new Error('Role parameter required');
            }
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.orgShipService.getShipsByRole(organizationId, role, paginationOptions);
        });
    };
    getAvailableShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.orgShipService.getAvailableShips(organizationId, paginationOptions);
        });
    };
    getFleetSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            return this.orgShipService.getFleetSummary(organizationId);
        });
    };
    loanOrgShip = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            const { shipId } = req.params;
            const { borrowerId, purpose, activityId, activityName } = req.body;
            if (!borrowerId) {
                throw new apiErrors_1.ValidationError('borrowerId is required');
            }
            const ship = await this.orgShipService.loanOrgShip(organizationId, shipId, borrowerId, {
                purpose,
                activityId,
                activityName,
            });
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Organization ship');
            }
            return ship;
        });
    };
    returnOrgShipLoan = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrgIdFromRequest(req);
            const { shipId } = req.params;
            const ship = await this.orgShipService.returnOrgShipLoan(organizationId, shipId);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('Loaned organization ship');
            }
            return ship;
        });
    };
    parseRoleFilter(role) {
        if (!role) {
            return undefined;
        }
        if (typeof role === 'string') {
            if (role.includes(',')) {
                return role.split(',').map(r => r.trim());
            }
            return role;
        }
        return undefined;
    }
    parseStatusFilter(status) {
        if (!status) {
            return undefined;
        }
        if (typeof status === 'string') {
            if (status.includes(',')) {
                return status.split(',').map(s => s.trim());
            }
            return status;
        }
        return undefined;
    }
    parseConditionFilter(condition) {
        if (!condition) {
            return undefined;
        }
        if (typeof condition === 'string') {
            if (condition.includes(',')) {
                return condition.split(',').map(c => c.trim());
            }
            return condition;
        }
        return undefined;
    }
    parseBooleanFilter(value) {
        if (value === 'true') {
            return true;
        }
        if (value === 'false') {
            return false;
        }
        return undefined;
    }
}
exports.OrganizationShipController = OrganizationShipController;
//# sourceMappingURL=organizationShipController.js.map