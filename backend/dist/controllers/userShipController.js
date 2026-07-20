"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserShipController = void 0;
const ship_1 = require("../services/ship");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const BaseController_1 = require("./BaseController");
class UserShipController extends BaseController_1.BaseController {
    userShipService;
    constructor() {
        super();
        this.userShipService = new ship_1.UserShipService();
    }
    resolveUserId(req) {
        const paramId = req.params.userId;
        if (paramId && paramId !== 'me') {
            return paramId;
        }
        return req.user?.id;
    }
    getUserShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.resolveUserId(req);
            if (!userId) {
                throw new Error('User ID required');
            }
            const filters = {
                userId,
                shipId: req.query.shipId,
                status: this.parseStatusFilter(req.query.status),
                condition: this.parseConditionFilter(req.query.condition),
                location: req.query.location,
                search: req.query.search,
                tags: req.query.tags ? req.query.tags.split(',') : undefined,
                isLoaned: this.parseBooleanFilter(req.query.isLoaned),
                sharingLevel: this.parseSharingLevelFilter(req.query.sharingLevel),
            };
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.userShipService.findUserShips('', filters, paginationOptions);
        });
    };
    getUserShipById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const shipId = req.params.shipId;
            const ship = await this.userShipService.getUserShipById(shipId);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
    createUserShip = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.resolveUserId(req);
            if (!userId) {
                throw new Error('User ID required');
            }
            const safeBody = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'shipId',
                'shipName',
                'customName',
                'manufacturer',
                'model',
                'variant',
                'status',
                'condition',
                'pledgeDate',
                'purchasePrice',
                'currentValue',
                'insuranceLevel',
                'loanerShip',
                'isGamePackage',
                'customizations',
                'notes',
                'description',
                'sharingLevel',
                'location',
                'hangar',
                'tags',
                'erkulLoadoutUrl',
            ]);
            const shipData = {
                ...safeBody,
                userId,
            };
            const ship = await this.userShipService.createUserShip(shipData);
            res.status(201).json(ship);
        });
    };
    bulkImportUserShips = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.resolveUserId(req);
            if (!userId) {
                throw new Error('User ID required');
            }
            const { ships } = req.body;
            if (!Array.isArray(ships) || ships.length === 0) {
                throw new apiErrors_1.ValidationError('ships array is required and must not be empty');
            }
            const ALLOWED_FIELDS = [
                'shipId',
                'shipName',
                'customName',
                'manufacturer',
                'model',
                'variant',
                'status',
                'condition',
                'pledgeDate',
                'purchasePrice',
                'currentValue',
                'insuranceLevel',
                'loanerShip',
                'isGamePackage',
                'customizations',
                'notes',
                'sharingLevel',
                'location',
                'hangar',
                'tags',
                'erkulLoadoutUrl',
            ];
            const sanitizedShips = ships.map((s) => (0, prototypePollutionPrevention_1.sanitizeObject)(s, ALLOWED_FIELDS));
            const result = await this.userShipService.bulkCreateUserShips(userId, sanitizedShips);
            res.status(201).json(result);
        });
    };
    updateUserShip = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const shipId = req.params.shipId;
            const updates = req.body;
            const ship = await this.userShipService.updateUserShip('', shipId, updates);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
    deleteUserShip = async (req, res) => {
        await this.execute(req, res, async () => {
            const shipId = req.params.shipId;
            const success = await this.userShipService.deleteUserShip('', shipId);
            if (!success) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            res.status(204).send();
        });
    };
    clearAllUserShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authenticatedUserId = req.user?.id;
            const targetUserId = this.resolveUserId(req);
            if (!authenticatedUserId) {
                throw new apiErrors_1.UnauthorizedError('Authentication required');
            }
            if (!targetUserId || targetUserId !== authenticatedUserId) {
                throw new apiErrors_1.ForbiddenError('You can only clear your own personal hangar');
            }
            const deleted = await this.userShipService.bulkDeleteAllUserShips(authenticatedUserId);
            return { deleted };
        });
    };
    loanShip = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const shipId = req.params.shipId;
            const { scope, startDate, endDate, purpose, activityId, activityName } = req.body;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            const validScope = scope === 'alliance' ? 'alliance' : 'organization';
            const ship = await this.userShipService.loanShip(organizationId, shipId, organizationId, {
                expiresAt: endDate ? new Date(endDate) : undefined,
                scope: validScope,
                startDate: startDate ? new Date(startDate) : undefined,
                purpose,
                activityId,
                activityName,
            });
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
    returnLoanedShip = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const shipId = req.params.shipId;
            if (!organizationId) {
                throw new apiErrors_1.ForbiddenError('Organization context required');
            }
            const ship = await this.userShipService.returnLoanedShip(organizationId, shipId);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
    getShipsNeedingInsurance = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.resolveUserId(req);
            const daysBeforeExpiry = Number.parseInt(req.query.daysBeforeExpiry, 10) || 30;
            if (!userId) {
                throw new Error('User ID required');
            }
            return this.userShipService.getShipsNeedingInsurance(userId, daysBeforeExpiry);
        });
    };
    getOrgAvailableShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.params.orgId ||
                req.tenantContext?.organizationId ||
                req.organizationId ||
                req.user?.organizationId;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            return this.userShipService.getOrgAvailableShips(organizationId);
        });
    };
    getUserShipSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.resolveUserId(req);
            if (!userId) {
                throw new Error('User ID required');
            }
            return this.userShipService.getUserShipSummary('', userId);
        });
    };
    updateShipSharing = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const shipId = req.params.shipId;
            const { sharingLevel, sharedWithUsers } = req.body;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            if (!sharingLevel) {
                throw new apiErrors_1.ValidationError('sharingLevel is required');
            }
            const ship = await this.userShipService.updateSharingLevel(organizationId, shipId, sharingLevel, sharedWithUsers);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
    shareShipWithUsers = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const shipId = req.params.shipId;
            const { userIds } = req.body;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                throw new apiErrors_1.ValidationError('userIds array is required and must not be empty');
            }
            const ship = await this.userShipService.shareWithUsers(organizationId, shipId, userIds);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
    unshareShipFromUser = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const shipId = req.params.shipId;
            const targetUserId = req.params.targetUserId;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            const ship = await this.userShipService.unshareFromUser(organizationId, shipId, targetUserId);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
    getOrgSharedShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.userShipService.getShipsSharedWithOrg([organizationId], paginationOptions);
        });
    };
    getAccessibleShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const userId = req.params.userId || req.user?.id;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            if (!userId) {
                throw new Error('User ID required');
            }
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.userShipService.getAccessibleShips(userId, paginationOptions);
        });
    };
    getAllianceSharedShips = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            return this.userShipService.getAllianceSharedShips(organizationId, paginationOptions);
        });
    };
    getOrgFleetSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            return this.userShipService.getOrgFleetSummary(organizationId);
        });
    };
    updateErkulLoadoutUrl = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const shipId = req.params.shipId;
            const { erkulLoadoutUrl } = req.body;
            if (!organizationId) {
                throw new Error('Organization context required');
            }
            if (!erkulLoadoutUrl) {
                throw new apiErrors_1.ValidationError('erkulLoadoutUrl is required');
            }
            const ship = await this.userShipService.updateErkulLoadoutUrl(organizationId, shipId, erkulLoadoutUrl);
            if (!ship) {
                throw new apiErrors_1.NotFoundError('User ship');
            }
            return ship;
        });
    };
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
    parseSharingLevelFilter(sharingLevel) {
        if (!sharingLevel) {
            return undefined;
        }
        if (typeof sharingLevel === 'string') {
            if (sharingLevel.includes(',')) {
                return sharingLevel.split(',').map(s => s.trim());
            }
            return sharingLevel;
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
exports.UserShipController = UserShipController;
//# sourceMappingURL=userShipController.js.map