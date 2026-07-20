"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillController = void 0;
const SkillService_1 = require("../../services/skill/SkillService");
const apiErrors_1 = require("../../utils/apiErrors");
const BaseController_1 = require("../BaseController");
class SkillController extends BaseController_1.BaseController {
    skillService;
    constructor() {
        super();
        this.skillService = new SkillService_1.SkillService();
    }
    listSkills = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { category, search, limit } = req.query;
            const data = await this.skillService.listSkills(organizationId, {
                category: category,
                search: search,
                limit: limit ? Math.min(parseInt(limit, 10), 200) : undefined,
            });
            res.json({ success: true, data });
        });
    };
    getSkill = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const skill = await this.skillService.getSkill(organizationId, req.params.skillId);
            if (!skill) {
                res.status(404).json({ success: false, error: 'Skill not found' });
                return;
            }
            res.json({ success: true, data: skill });
        });
    };
    createSkill = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            const skill = await this.skillService.createSkill(organizationId, userId, body);
            res.status(201).json({ success: true, data: skill });
        });
    };
    updateSkill = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const body = req.body;
            const skill = await this.skillService.updateSkill(organizationId, req.params.skillId, body);
            res.json({ success: true, data: skill });
        });
    };
    deleteSkill = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            await this.skillService.deleteSkill(organizationId, req.params.skillId);
            res.json({ success: true, message: 'Skill deleted' });
        });
    };
    getUserSkills = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const skills = await this.skillService.getUserSkills(organizationId, req.params.userId);
            res.json({ success: true, data: skills });
        });
    };
    endorseSkill = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.user?.currentOrganizationId;
            const userId = req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const { userId: targetUserId } = req.body;
            const endorsement = await this.skillService.endorseSkill(organizationId, userId, req.params.skillId, targetUserId);
            res.status(201).json({ success: true, data: endorsement });
        });
    };
    getCategories = async (req, res) => {
        await this.execute(req, res, async () => {
            const categories = this.skillService.getCategories();
            res.json({ success: true, data: categories });
        });
    };
}
exports.SkillController = SkillController;
//# sourceMappingURL=skillController.js.map