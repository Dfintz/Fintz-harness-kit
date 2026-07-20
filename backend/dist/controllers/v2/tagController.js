"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TagController = void 0;
const TagService_1 = require("../../services/tag/TagService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class TagController extends BaseController_1.BaseController {
    tagService;
    constructor() {
        super();
        this.tagService = new TagService_1.TagService();
    }
    listTags = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { search, limit } = req.query;
            const tags = await this.tagService.listTags(organizationId, {
                search: search,
                limit: limit ? Math.min(parseInt(limit, 10), 200) : undefined,
            });
            res.json({ success: true, data: tags });
        });
    };
    getTag = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const tag = await this.tagService.getTag(organizationId, req.params.tagId);
            if (!tag) {
                res.status(404).json({ success: false, error: 'Tag not found' });
                return;
            }
            res.json({ success: true, data: tag });
        });
    };
    createTag = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            const tag = await this.tagService.createTag(organizationId, userId, body);
            res.status(201).json({ success: true, data: tag });
        });
    };
    updateTag = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            const tag = await this.tagService.updateTag(organizationId, req.params.tagId, body);
            res.json({ success: true, data: tag });
        });
    };
    deleteTag = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            await this.tagService.deleteTag(organizationId, req.params.tagId);
            res.json({ success: true, message: 'Tag deleted' });
        });
    };
    applyTag = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { resourceType, resourceId } = req.body;
            const assignment = await this.tagService.applyTag(organizationId, userId, req.params.tagId, resourceType, resourceId);
            res.json({ success: true, data: assignment });
        });
    };
    removeTag = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { resourceType, resourceId } = req.body;
            await this.tagService.removeTag(organizationId, req.params.tagId, resourceType, resourceId);
            res.json({ success: true, message: 'Tag removed from resource' });
        });
    };
    getPopularTags = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10;
            const tags = await this.tagService.getPopularTags(organizationId, limit);
            res.json({ success: true, data: tags });
        });
    };
}
exports.TagController = TagController;
//# sourceMappingURL=tagController.js.map