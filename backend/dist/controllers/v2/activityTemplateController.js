"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityTemplateControllerV2 = void 0;
const activityTemplate_service_1 = require("../../services/activity/activityTemplate.service");
const api_1 = require("../../types/api");
const ApiError_1 = require("../../utils/ApiError");
const queryUtils_1 = require("../../utils/queryUtils");
class ActivityTemplateControllerV2 {
    activityTemplateService;
    constructor() {
        this.activityTemplateService = new activityTemplate_service_1.ActivityTemplateService();
    }
    getOrgId(req) {
        const orgId = req.tenantContext?.organizationId;
        if (!orgId) {
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.INVALID_INPUT, 'Organization context is required', 400);
        }
        return orgId;
    }
    getUser(req) {
        const user = req.user;
        if (!user?.id) {
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.UNAUTHORIZED, 'Authentication required', 401);
        }
        return { id: user.id, username: user.username ?? '' };
    }
    async listTemplates(req, res) {
        const orgId = this.getOrgId(req);
        const filters = {};
        if (req.query.category) {
            filters.category = req.query.category;
        }
        if (req.query.activityType) {
            filters.activityType = req.query.activityType;
        }
        if (req.query.isPublic !== undefined) {
            filters.isPublic = (0, queryUtils_1.parseBooleanQuery)(req.query.isPublic);
        }
        if (req.query.search) {
            filters.search = req.query.search;
        }
        if (req.query.page) {
            filters.page = Number(req.query.page);
        }
        if (req.query.limit) {
            filters.limit = Math.min(Number(req.query.limit), 200);
        }
        const result = await this.activityTemplateService.getTemplates(orgId, filters);
        res.success(result);
    }
    async createTemplate(req, res) {
        const orgId = this.getOrgId(req);
        const user = this.getUser(req);
        const dto = req.body;
        const template = await this.activityTemplateService.createTemplate(orgId, dto, user.id, user.username);
        res.status(201).success({ template });
    }
    async getTemplate(req, res) {
        const orgId = this.getOrgId(req);
        const { templateId } = req.params;
        const template = await this.activityTemplateService.getTemplate(orgId, templateId);
        if (!template) {
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
        }
        res.success({ template });
    }
    async updateTemplate(req, res) {
        const orgId = this.getOrgId(req);
        const user = this.getUser(req);
        const { templateId } = req.params;
        const dto = req.body;
        const template = await this.activityTemplateService.updateTemplate(orgId, templateId, dto, user.id);
        if (!template) {
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
        }
        res.success({ template });
    }
    async deleteTemplate(req, res) {
        const orgId = this.getOrgId(req);
        const user = this.getUser(req);
        const { templateId } = req.params;
        const deleted = await this.activityTemplateService.deleteTemplate(orgId, templateId, user.id);
        if (!deleted) {
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
        }
        res.status(204).send();
    }
    async cloneTemplate(req, res) {
        const orgId = this.getOrgId(req);
        const user = this.getUser(req);
        const { templateId } = req.params;
        const clone = await this.activityTemplateService.cloneTemplate(orgId, templateId, user.id, user.username);
        if (!clone) {
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
        }
        res.status(201).success({ template: clone });
    }
    async applyTemplate(req, res) {
        const orgId = this.getOrgId(req);
        const user = this.getUser(req);
        const { templateId } = req.params;
        const dto = req.body;
        const activity = await this.activityTemplateService.createActivityFromTemplate(orgId, templateId, dto, user.id, user.username);
        if (!activity) {
            throw new ApiError_1.ApiError(api_1.ApiErrorCode.RESOURCE_NOT_FOUND, 'Activity template not found', 404);
        }
        res.status(201).success({ activity });
    }
    async getCategories(_req, res) {
        const categories = this.activityTemplateService.getCategories();
        res.success({ categories });
    }
}
exports.ActivityTemplateControllerV2 = ActivityTemplateControllerV2;
//# sourceMappingURL=activityTemplateController.js.map