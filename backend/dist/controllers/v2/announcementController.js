"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnnouncementController = void 0;
const AnnouncementService_1 = require("../../services/communication/announcement/AnnouncementService");
const BaseController_1 = require("../BaseController");
class AnnouncementController extends BaseController_1.BaseController {
    announcementService;
    constructor() {
        super();
        this.announcementService = new AnnouncementService_1.AnnouncementService();
    }
    list = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { page, limit, status, targetType, createdBy } = req.query;
            const pageNum = Number.parseInt(page) || 1;
            const pageSize = Math.min(Number.parseInt(limit) || 20, 200);
            const result = await this.announcementService.list(organizationId, {
                status: status,
                targetType: targetType,
                createdBy,
            }, pageNum, pageSize);
            res.json({
                success: true,
                data: result.announcements,
                pagination: {
                    total: result.total,
                    count: result.announcements.length,
                    page: result.page,
                    pageSize,
                    hasMore: result.page < result.totalPages,
                    totalPages: result.totalPages,
                },
            });
        });
    };
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const user = this.getAuthUser(req);
            const dto = {
                title: req.body.title,
                content: req.body.content,
                createdBy: user.id,
                createdByName: user.username,
                embedConfig: req.body.embedConfig,
                targetType: req.body.targetType,
                targetIds: req.body.targetIds,
                scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
            };
            const announcement = await this.announcementService.create(organizationId, dto);
            res.status(201).json({
                success: true,
                data: announcement,
            });
        });
    };
    getById = async (req, res) => {
        await this.execute(req, res, async () => {
            const { announcementId } = req.params;
            const announcement = await this.announcementService.getById(announcementId);
            if (!announcement) {
                res.status(404).json({ success: false, error: 'Announcement not found' });
                return;
            }
            res.json({
                success: true,
                data: announcement,
            });
        });
    };
    update = async (req, res) => {
        await this.execute(req, res, async () => {
            const { announcementId } = req.params;
            const dto = {
                title: req.body.title,
                content: req.body.content,
                embedConfig: req.body.embedConfig,
                targetType: req.body.targetType,
                targetIds: req.body.targetIds,
                scheduledAt: req.body.scheduledAt ? new Date(req.body.scheduledAt) : undefined,
                status: req.body.status,
            };
            const announcement = await this.announcementService.update(announcementId, dto);
            res.json({
                success: true,
                data: announcement,
            });
        });
    };
    delete = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { announcementId } = req.params;
            await this.announcementService.delete(announcementId, user.id);
            res.json({
                success: true,
                message: 'Announcement deleted',
            });
        });
    };
    publish = async (req, res) => {
        await this.execute(req, res, async () => {
            const { announcementId } = req.params;
            const { channelId } = req.body;
            const result = await this.announcementService.send(announcementId, channelId);
            res.json({
                success: true,
                data: result,
            });
        });
    };
    pin = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { announcementId } = req.params;
            const result = await this.announcementService.togglePin(announcementId, user.id);
            res.json({
                success: true,
                data: {
                    announcementId,
                    pinned: result.pinned,
                },
            });
        });
    };
    markRead = async (req, res) => {
        await this.execute(req, res, async () => {
            const user = this.getAuthUser(req);
            const { announcementId } = req.params;
            const result = await this.announcementService.markRead(announcementId, user.id);
            res.json({
                success: true,
                data: {
                    announcementId,
                    userId: user.id,
                    readAt: result.readAt.toISOString(),
                },
            });
        });
    };
}
exports.AnnouncementController = AnnouncementController;
//# sourceMappingURL=announcementController.js.map