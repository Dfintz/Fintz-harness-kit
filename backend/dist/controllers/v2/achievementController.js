"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AchievementController = void 0;
const TitleBadgeService_1 = require("../../services/gamification/TitleBadgeService");
const BaseController_1 = require("../BaseController");
class AchievementController extends BaseController_1.BaseController {
    titleBadgeService;
    constructor() {
        super();
        this.titleBadgeService = new TitleBadgeService_1.TitleBadgeService();
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { category, rarity, type } = req.query;
            const { page, limit } = this.getPaginationParams(req);
            const { items, total } = await this.titleBadgeService.list(organizationId, {
                category,
                rarity,
                type,
            });
            res.json({
                success: true,
                ...this.createPaginatedResponse(items, total, page, limit),
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const achievement = await this.titleBadgeService.create(organizationId, user.id, req.body);
            res.status(201).json({ success: true, data: achievement });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { achievementId } = req.params;
            const achievement = await this.titleBadgeService.getById(achievementId, organizationId);
            if (!achievement) {
                res.status(404).json({ success: false, error: 'Title or badge not found' });
                return;
            }
            res.json({ success: true, data: achievement });
        });
    };
    update = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { achievementId } = req.params;
            const achievement = await this.titleBadgeService.update(achievementId, organizationId, req.body);
            res.json({ success: true, data: achievement });
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { achievementId } = req.params;
            await this.titleBadgeService.delete(achievementId, organizationId);
            res.json({ success: true, message: `Title/badge ${achievementId} deleted` });
        });
    };
    award = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { achievementId } = req.params;
            const { userId } = req.body;
            const userAchievement = await this.titleBadgeService.award(achievementId, organizationId, userId, user.id);
            res.json({ success: true, data: userAchievement });
        });
    };
    revoke = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const { achievementId } = req.params;
            const { userId } = req.body;
            await this.titleBadgeService.revoke(achievementId, organizationId, userId, user.id);
            res.json({ success: true, message: 'Title/badge revoked' });
        });
    };
    getUserItems = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { userId } = req.params;
            const items = await this.titleBadgeService.getUserItems(organizationId, userId);
            res.json({ success: true, data: items });
        });
    };
    getPublicUserItems = async (req, res) => {
        await this.execute(req, res, async () => {
            const { userId } = req.params;
            const items = await this.titleBadgeService.getUserPublicItems(userId);
            res.json({ success: true, data: items });
        });
    };
    getRecipients = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { achievementId } = req.params;
            const recipients = await this.titleBadgeService.getRecipients(achievementId, organizationId);
            res.json({ success: true, data: recipients });
        });
    };
    toggleDisplay = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { userAchievementId } = req.params;
            const { isDisplayed } = req.body;
            const updated = await this.titleBadgeService.toggleDisplay(userAchievementId, user.id, isDisplayed);
            res.json({ success: true, data: updated });
        });
    };
}
exports.AchievementController = AchievementController;
//# sourceMappingURL=achievementController.js.map