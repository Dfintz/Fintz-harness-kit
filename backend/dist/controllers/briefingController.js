"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BriefingController = void 0;
const content_1 = require("../services/content");
const BriefingDiscordWebhookService_1 = require("../services/discord/BriefingDiscordWebhookService");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const BaseController_1 = require("./BaseController");
class BriefingController extends BaseController_1.BaseController {
    briefingService;
    briefingDiscordService;
    constructor() {
        super();
        this.briefingService = new content_1.BriefingService();
        this.briefingDiscordService = new BriefingDiscordWebhookService_1.BriefingDiscordWebhookService();
    }
    createBriefing = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const userId = this.getAuthUser(authReq).id;
            const briefing = await this.briefingService.createBriefing(organizationId, {
                ...(0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                    'title',
                    'missionId',
                    'type',
                    'classification',
                    'operationIds',
                    'summary',
                    'content',
                    'objectives',
                    'targetDate',
                    'expiresAt',
                    'tags',
                    'notes',
                ]),
                creatorId: userId,
            });
            res.status(201).json(briefing);
        });
    };
    getBriefing = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const briefing = await this.briefingService.getBriefingById(req.params.id, organizationId);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            return briefing;
        });
    };
    postToDiscord = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const userId = this.getAuthUser(authReq).id;
            const briefing = await this.briefingService.getBriefingById(req.params.id, organizationId);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            const { webhookUrl } = req.body;
            await this.briefingDiscordService.postBriefingToWebhook(briefing, webhookUrl, {
                organizationId,
                userId,
            });
            return { posted: true };
        });
    };
    getAllBriefings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            const filters = {
                creatorId: req.query.creatorId,
                missionId: req.query.missionId,
                status: req.query.status,
                classification: req.query.classification,
                operationId: req.query.operationId,
                tags: typeof req.query.tags === 'string' ? req.query.tags.split(',') : undefined,
            };
            return this.briefingService.getAllBriefings(organizationId, paginationOptions, filters);
        });
    };
    getBriefingsByMission = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.briefingService.getBriefingsByMission(req.params.missionId, organizationId);
        });
    };
    updateBriefing = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const briefing = await this.briefingService.updateBriefing(req.params.id, organizationId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'title',
                'classification',
                'operationIds',
                'elements',
                'backgroundImage',
                'pages',
                'tags',
                'status',
                'participants',
            ]));
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            return briefing;
        });
    };
    deleteBriefing = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const success = await this.briefingService.deleteBriefing(req.params.id, organizationId);
            if (!success) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            res.status(204).send();
        });
    };
    addElement = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const briefing = await this.briefingService.addElement(req.params.id, organizationId, req.body);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            return briefing;
        });
    };
    updateElement = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const briefing = await this.briefingService.updateElement(req.params.id, organizationId, req.params.elementId, req.body);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing or element');
            }
            return briefing;
        });
    };
    deleteElement = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const briefing = await this.briefingService.deleteElement(req.params.id, organizationId, req.params.elementId);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing or element');
            }
            return briefing;
        });
    };
    addParticipant = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { userId } = req.body;
            const briefing = await this.briefingService.addParticipant(req.params.id, organizationId, userId);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            return briefing;
        });
    };
    removeParticipant = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { userId } = req.body;
            const briefing = await this.briefingService.removeParticipant(req.params.id, organizationId, userId);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            return briefing;
        });
    };
    updateStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const { status } = req.body;
            const briefing = await this.briefingService.updateStatus(req.params.id, organizationId, status);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            return briefing;
        });
    };
    createVersion = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const briefing = await this.briefingService.createVersion(req.params.id, organizationId);
            if (!briefing) {
                throw new apiErrors_1.NotFoundError('Briefing');
            }
            res.status(201).json(briefing);
        });
    };
}
exports.BriefingController = BriefingController;
//# sourceMappingURL=briefingController.js.map