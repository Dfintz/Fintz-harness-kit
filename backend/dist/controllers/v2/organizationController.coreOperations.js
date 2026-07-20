"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listOrganizationsCoreHandler = listOrganizationsCoreHandler;
exports.getOrganizationCoreHandler = getOrganizationCoreHandler;
exports.createOrganizationCoreHandler = createOrganizationCoreHandler;
exports.updateOrganizationCoreHandler = updateOrganizationCoreHandler;
exports.deleteOrganizationCoreHandler = deleteOrganizationCoreHandler;
const database_1 = require("../../config/database");
const errorHandlerV2_1 = require("../../middleware/errorHandlerV2");
const queryParser_1 = require("../../middleware/queryParser");
const Organization_1 = require("../../models/Organization");
const OrgTierService_1 = require("../../services/organization/OrgTierService");
const api_1 = require("../../types/api");
const errorHandler_1 = require("../../utils/errorHandler");
async function listOrganizationsCoreHandler(req, res) {
    const queryParams = req.queryParams ?? { limit: 20, offset: 0, sort: null };
    const { limit, offset, sort } = queryParams;
    const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
    const queryBuilder = orgRepo.createQueryBuilder('organization');
    if (sort) {
        queryBuilder.orderBy(`organization.${sort.field}`, sort.order);
    }
    else {
        queryBuilder.orderBy('organization.createdAt', 'DESC');
    }
    const total = await queryBuilder.getCount();
    const organizations = await queryBuilder.skip(offset).take(limit).getMany();
    const links = (0, queryParser_1.buildHateoasLinks)('/api/v2/organizations', offset, limit, total);
    res.paginated(organizations, {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
    }, links);
}
async function getOrganizationCoreHandler(req, res) {
    const { id } = req.params;
    const orgRepo = database_1.AppDataSource.getRepository(Organization_1.Organization);
    const organization = await orgRepo
        .createQueryBuilder('organization')
        .where('organization.id = :id', { id })
        .getOne();
    if (!organization) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
    }
    res.success({
        ...organization,
        scale: OrgTierService_1.orgTierService.getScalingProfile(organization.totalMembers),
    });
}
async function createOrganizationCoreHandler(req, res, organizationService) {
    const userId = req.user?.id;
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }
    const orgData = req.body;
    try {
        const organization = await organizationService.createOrganization(orgData, userId);
        res.status(201);
        res.success(organization);
    }
    catch (error) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to create organization'), 500);
    }
}
async function updateOrganizationCoreHandler(req, res, organizationService) {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }
    const updates = req.body;
    try {
        const organization = await organizationService.updateOrganization(id, updates, userId);
        if (!organization) {
            throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.ORG_NOT_FOUND, 'Organization not found', 404);
        }
        res.success(organization);
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to update organization'), 500);
    }
}
async function deleteOrganizationCoreHandler(req, res, organizationService) {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) {
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
    }
    try {
        const result = await organizationService.deleteOrganization(id, userId, false, {
            reason: 'User requested deletion',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
        });
        res.success({
            message: result.message,
            requestId: result.requestId,
            scheduledFor: result.scheduledFor,
        });
    }
    catch (error) {
        if (error instanceof errorHandlerV2_1.ApiError) {
            throw error;
        }
        throw new errorHandlerV2_1.ApiError(api_1.ApiErrorCode.INTERNAL_ERROR, (0, errorHandler_1.getErrorMessage)(error, 'Failed to delete organization'), 500);
    }
}
//# sourceMappingURL=organizationController.coreOperations.js.map