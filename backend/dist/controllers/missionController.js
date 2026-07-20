"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MissionController = void 0;
const Mission_1 = require("../models/Mission");
const AIBriefingGenerationService_1 = require("../services/content/AIBriefingGenerationService");
const MissionService_1 = require("../services/content/MissionService");
const apiErrors_1 = require("../utils/apiErrors");
const logger_1 = require("../utils/logger");
const pagination_1 = require("../utils/pagination");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const BaseController_1 = require("./BaseController");
class MissionController extends BaseController_1.BaseController {
    missionService;
    aiService;
    constructor() {
        super();
        this.missionService = new MissionService_1.MissionService();
    }
    getAIService() {
        this.aiService ??= new AIBriefingGenerationService_1.AIBriefingGenerationService();
        return this.aiService;
    }
    createMission = async (req, res) => {
        try {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const missionData = {
                ...(0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                    'title',
                    'description',
                    'missionType',
                    'difficulty',
                    'priority',
                    'fleetId',
                    'location',
                    'objectives',
                    'tags',
                    'reward',
                    'startDate',
                    'endDate',
                    'notes',
                ]),
                createdBy: authReq.user?.id,
            };
            const mission = await this.missionService.createMission(organizationId, missionData);
            res.status(201).success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getMission = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const mission = await this.missionService.getMissionById(req.params.missionId, organizationId);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getAllMissions = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const paginationOptions = (0, pagination_1.extractPaginationOptions)(req);
            let tags;
            if (req.query.tags) {
                tags = Array.isArray(req.query.tags)
                    ? req.query.tags
                    : req.query.tags.split(',');
            }
            const filters = {
                status: req.query.status,
                missionType: req.query.missionType,
                difficulty: req.query.difficulty,
                priority: req.query.priority,
                createdBy: req.query.createdBy,
                assignedTo: req.query.assignedTo,
                fleetId: req.query.fleetId,
                tags,
                search: req.query.search,
                startDateFrom: req.query.startDateFrom
                    ? new Date(req.query.startDateFrom)
                    : undefined,
                startDateTo: req.query.startDateTo ? new Date(req.query.startDateTo) : undefined,
            };
            const result = await this.missionService.getAllMissions(organizationId, paginationOptions, filters);
            const { pagination } = result;
            const limit = pagination.limit;
            const page = pagination.page;
            res.paginated(result.data, {
                total: pagination.total,
                limit,
                offset: (page - 1) * limit,
                hasMore: pagination.hasNext,
                page,
                totalPages: pagination.totalPages,
                hasNext: pagination.hasNext,
                hasPrevious: pagination.hasPrev,
            });
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    updateMission = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const mission = await this.missionService.updateMission(req.params.missionId, organizationId, req.body);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    deleteMission = async (req, res) => {
        try {
            const authReq = req;
            const organizationId = this.getOrganizationId(authReq);
            const success = await this.missionService.deleteMission(req.params.missionId, organizationId, authReq.user?.id || 'unknown');
            if (!success) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.status(204).send();
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getWorkflow = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const workflow = await this.missionService.getWorkflow(req.params.missionId, organizationId);
            if (!workflow) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(workflow);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    advanceWorkflowPhase = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const { phase, notes } = req.body;
            const mission = await this.missionService.advanceWorkflowPhase(req.params.missionId, organizationId, phase, notes);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    updateStatus = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const { status } = req.body;
            const mission = await this.missionService.transitionStatus(req.params.missionId, organizationId, status);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    completeMission = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const { status, notes } = req.body;
            if (status !== Mission_1.MissionStatus.COMPLETED && status !== Mission_1.MissionStatus.FAILED) {
                throw new apiErrors_1.ValidationError('Complete endpoint only accepts completed or failed status');
            }
            const mission = await this.missionService.completeMission(req.params.missionId, organizationId, { status, notes });
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    assignMission = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const { userId, role } = req.body;
            const mission = await this.missionService.assignMission(req.params.missionId, organizationId, userId, role);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getParticipants = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const participants = await this.missionService.getParticipants(req.params.missionId, organizationId);
            if (participants === null) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(participants);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    addParticipant = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const { userId, role } = req.body;
            const mission = await this.missionService.addParticipant(req.params.missionId, organizationId, userId, role);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    removeParticipant = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const mission = await this.missionService.removeParticipant(req.params.missionId, organizationId, req.params.userId);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    generateBriefing = async (req, res) => {
        try {
            const authReq = req;
            const organizationId = authReq.user?.currentOrganizationId;
            const userId = authReq.user?.id;
            if (!organizationId || !userId) {
                res.status(400).json({ error: 'Organization and user context required' });
                return;
            }
            const mission = await this.missionService.getMissionById(req.params.missionId, organizationId);
            if (!mission) {
                res.status(404).json({ error: 'Mission not found' });
                return;
            }
            const generationRequest = {
                missionType: req.body.missionType || mission.missionType,
                objectives: req.body.objectives || mission.objectives || [],
                difficulty: req.body.difficulty || mission.difficulty,
                location: req.body.location || mission.location,
                fleetComposition: req.body.fleetComposition || undefined,
                participantCount: req.body.participantCount || mission.participants?.length || undefined,
                estimatedDuration: req.body.estimatedDuration || undefined,
                additionalContext: req.body.additionalContext || undefined,
            };
            const result = await this.getAIService().generateBriefing(organizationId, userId, generationRequest);
            res.json(result);
        }
        catch (error) {
            const status = error.status || 500;
            logger_1.logger.error('AI briefing generation failed', {
                missionId: req.params.missionId,
                error: error instanceof Error ? error.message : String(error),
            });
            res.status(status).json({ error: error.message || 'AI generation failed' });
        }
    };
    generateBriefingStream = async (req, res) => {
        try {
            const authReq = req;
            const organizationId = authReq.user?.currentOrganizationId;
            const userId = authReq.user?.id;
            if (!organizationId || !userId) {
                res.status(400).json({ error: 'Organization and user context required' });
                return;
            }
            const mission = await this.missionService.getMissionById(req.params.missionId, organizationId);
            if (!mission) {
                res.status(404).json({ error: 'Mission not found' });
                return;
            }
            const generationRequest = {
                missionType: req.body.missionType || mission.missionType,
                objectives: req.body.objectives || mission.objectives || [],
                difficulty: req.body.difficulty || mission.difficulty,
                location: req.body.location || mission.location,
                fleetComposition: req.body.fleetComposition || undefined,
                participantCount: req.body.participantCount || mission.participants?.length || undefined,
                estimatedDuration: req.body.estimatedDuration || undefined,
                additionalContext: req.body.additionalContext || undefined,
            };
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.flushHeaders();
            const result = await this.getAIService().generateBriefingStream(organizationId, userId, generationRequest, (chunk) => {
                res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
            });
            res.write(`data: ${JSON.stringify({ done: true, ...result })}\n\n`);
            res.end();
        }
        catch (error) {
            const status = error.status || 500;
            logger_1.logger.error('AI briefing streaming generation failed', {
                missionId: req.params.missionId,
                error: error instanceof Error ? error.message : String(error),
            });
            if (res.headersSent) {
                res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
                res.end();
            }
            else {
                res.status(status).json({ error: error.message || 'AI streaming failed' });
            }
        }
    };
    addObjective = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const mission = await this.missionService.addObjective(req.params.missionId, organizationId, req.body);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    updateObjective = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const mission = await this.missionService.updateObjective(req.params.missionId, organizationId, req.params.objectiveId, req.body);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission or objective');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    removeObjective = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const mission = await this.missionService.removeObjective(req.params.missionId, organizationId, req.params.objectiveId);
            if (!mission) {
                throw new apiErrors_1.NotFoundError('Mission or objective');
            }
            res.success(mission);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getTemplates = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const templates = await this.missionService.getTemplates(organizationId);
            res.success(templates);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getMissionsByFleet = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const missions = await this.missionService.getMissionsByFleet(req.params.fleetId, organizationId);
            res.success(missions);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getActiveMissions = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const missions = await this.missionService.getActiveMissions(organizationId);
            res.success(missions);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    searchScmdbMissionCards = async (req, res) => {
        try {
            const filters = {
                search: typeof req.query.search === 'string' ? req.query.search : undefined,
                category: typeof req.query.category === 'string' ? req.query.category : undefined,
                limit: typeof req.query.limit === 'string' ? Number.parseInt(req.query.limit, 10) : undefined,
            };
            const cards = await this.missionService.searchScmdbMissionCards(filters);
            res.success(cards);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    importScmdbMissions = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const items = Array.isArray(req.body.items)
                ? req.body.items
                : [];
            const result = await this.missionService.importScmdbMissions(organizationId, userId, items);
            res.status(201).success(result);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    getScmdbFilters = async (req, res) => {
        try {
            const filters = await this.missionService.getScmdbAvailableFilters();
            res.success(filters);
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
    importScmdbByUrl = async (req, res) => {
        try {
            const organizationId = this.getOrganizationId(req);
            const userId = this.getAuthUser(req).id;
            const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
            const priority = typeof req.body.priority === 'string' ? req.body.priority : undefined;
            const notes = typeof req.body.notes === 'string' ? req.body.notes : undefined;
            const startDate = req.body.startDate ? new Date(req.body.startDate) : undefined;
            const endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;
            const mission = await this.missionService.importScmdbMissionByUrl(organizationId, userId, url, { priority, notes, startDate, endDate });
            res.status(201).success({ mission });
        }
        catch (error) {
            this.handleError(res, error);
        }
    };
}
exports.MissionController = MissionController;
//# sourceMappingURL=missionController.js.map