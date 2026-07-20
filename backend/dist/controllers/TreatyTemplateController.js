"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TreatyTemplateController = void 0;
const TreatyTemplateService_1 = require("../services/organization/TreatyTemplateService");
const apiErrors_1 = require("../utils/apiErrors");
const BaseController_1 = require("./BaseController");
class TreatyTemplateController extends BaseController_1.BaseController {
    templateService = new TreatyTemplateService_1.TreatyTemplateService();
    constructor() {
        super();
    }
    getOrgContext(req) {
        const userId = req.user?.id;
        const orgId = req.tenantContext?.organizationId ?? req.user?.currentOrganizationId;
        if (!userId || !orgId) {
            throw new apiErrors_1.BadRequestError('Organization context is required');
        }
        return { userId, orgId };
    }
    list = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            const { category, scope, search, page, limit } = req.query;
            return this.templateService.getTemplates(orgId, {
                category: category,
                scope: scope,
                search: search,
            }, {
                page: page ? Number(page) : undefined,
                limit: limit ? Number(limit) : undefined,
            });
        });
    };
    getById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.templateService.getTemplateById(orgId, req.params.id);
        });
    };
    create = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.templateService.createTemplate(orgId, req.body);
        }, 201);
    };
    update = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.templateService.updateTemplate(orgId, req.params.id, req.body);
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            await this.templateService.deleteTemplate(orgId, req.params.id);
            res.status(204).send();
        });
    };
    instantiate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const { orgId } = this.getOrgContext(req);
            return this.templateService.instantiateTemplate(orgId, req.body);
        });
    };
}
exports.TreatyTemplateController = TreatyTemplateController;
//# sourceMappingURL=TreatyTemplateController.js.map