"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FederationController = void 0;
const FederationAmbassadorService_1 = require("../services/federation/FederationAmbassadorService");
const FederationAnnouncementService_1 = require("../services/federation/FederationAnnouncementService");
const FederationApplicationService_1 = require("../services/federation/FederationApplicationService");
const FederationDiscordService_1 = require("../services/federation/FederationDiscordService");
const FederationDiscordSettingsService_1 = require("../services/federation/FederationDiscordSettingsService");
const FederationIntelService_1 = require("../services/federation/FederationIntelService");
const federationPermissions_1 = require("../services/federation/federationPermissions");
const FederationPersonnelService_1 = require("../services/federation/FederationPersonnelService");
const FederationPollService_1 = require("../services/federation/FederationPollService");
const FederationTeamService_1 = require("../services/federation/FederationTeamService");
const FederationWikiService_1 = require("../services/federation/FederationWikiService");
const OrganizationFederationService_1 = require("../services/organization/OrganizationFederationService");
const apiErrors_1 = require("../utils/apiErrors");
const prototypePollutionPrevention_1 = require("../utils/prototypePollutionPrevention");
const BaseController_1 = require("./BaseController");
class FederationController extends BaseController_1.BaseController {
    federationService;
    ambassadorService;
    wikiService;
    announcementService;
    pollService;
    teamService;
    intelService;
    personnelService;
    applicationService;
    discordService;
    discordSettingsService;
    constructor() {
        super();
        this.federationService = OrganizationFederationService_1.OrganizationFederationService.getInstance();
        this.ambassadorService = FederationAmbassadorService_1.FederationAmbassadorService.getInstance();
        this.wikiService = FederationWikiService_1.FederationWikiService.getInstance();
        this.announcementService = FederationAnnouncementService_1.FederationAnnouncementService.getInstance();
        this.pollService = FederationPollService_1.FederationPollService.getInstance();
        this.teamService = FederationTeamService_1.FederationTeamService.getInstance();
        this.intelService = FederationIntelService_1.FederationIntelService.getInstance();
        this.personnelService = FederationPersonnelService_1.FederationPersonnelService.getInstance();
        this.applicationService = FederationApplicationService_1.FederationApplicationService.getInstance();
        this.discordService = FederationDiscordService_1.FederationDiscordService.getInstance();
        this.discordSettingsService = FederationDiscordSettingsService_1.FederationDiscordSettingsService.getInstance();
    }
    create = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const userId = this.getAuthUser(authReq).id;
            const organizationId = this.getOrganizationId(authReq);
            const orgName = authReq.user?.currentOrganizationName;
            const federation = await this.federationService.createFederation(userId, organizationId, orgName, req.body);
            res.status(201).json(federation);
        });
    };
    getById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const federation = await this.federationService.getFederation(req.params.id);
            if (!federation) {
                throw new apiErrors_1.NotFoundError('Federation');
            }
            return federation;
        });
    };
    resolveSlug = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const result = await this.federationService.resolveBySlug(req.params.slug);
            if (!result) {
                throw new apiErrors_1.NotFoundError('Federation');
            }
            return result;
        });
    };
    disband = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            await this.federationService.disbandFederation(req.params.id, organizationId);
            res.status(204).send();
        });
    };
    list = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.getOrganizationFederations(organizationId);
        });
    };
    search = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.federationService.searchFederations({
            name: req.query.query,
            tags: req.query.tags ? req.query.tags.split(',') : undefined,
            minMembers: req.query.minMembers
                ? Number.parseInt(req.query.minMembers, 10)
                : undefined,
            maxMembers: req.query.maxMembers
                ? Number.parseInt(req.query.maxMembers, 10)
                : undefined,
        }));
    };
    update = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.updateFederation(req.params.id, organizationId, req.body);
        });
    };
    activate = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.activateFederation(req.params.id, organizationId);
        });
    };
    updateSuccessionMode = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.updateSuccessionMode(req.params.id, organizationId, req.body.successionMode, req.body.leaderTermDays);
        });
    };
    succeedChairman = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.succeedChairman(req.params.id, organizationId);
        });
    };
    inviteMember = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const member = await this.federationService.inviteMember(req.params.id, organizationId, req.body.targetOrgId, req.body.targetOrgName, req.body.role, req.body.associationType);
            res.status(201).json(member);
        });
    };
    acceptInvitation = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.acceptInvitation(req.params.id, organizationId);
        });
    };
    removeMember = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            await this.federationService.removeMember(req.params.id, organizationId, req.params.memberId);
            res.status(204).send();
        });
    };
    updateMemberRole = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.updateMemberRole(req.params.id, organizationId, req.params.memberId, req.body.role);
        });
    };
    createProposal = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const userId = this.getAuthUser(authReq).id;
            const organizationId = this.getOrganizationId(authReq);
            const proposal = await this.federationService.createProposal(req.params.id, organizationId, userId, req.body);
            res.status(201).json(proposal);
        });
    };
    castVote = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const authReq = req;
            const userId = this.getAuthUser(authReq).id;
            const organizationId = this.getOrganizationId(authReq);
            const federation = await this.federationService.getFederation(req.params.id);
            const voterMember = federation?.members?.find((m) => m.organizationId === organizationId);
            const orgName = voterMember?.organizationName ?? `Organization ${organizationId.slice(0, 8)}`;
            return this.federationService.castVote(req.params.proposalId, organizationId, orgName, userId, req.body.vote, req.body.comment);
        });
    };
    getProposal = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const proposal = await this.federationService.getProposal(req.params.proposalId);
            if (!proposal) {
                throw new apiErrors_1.NotFoundError('Proposal');
            }
            return proposal;
        });
    };
    listProposals = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.federationService.getFederationProposals(req.params.id, req.query.status));
    };
    addResource = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const resource = await this.federationService.addSharedResource(req.params.id, organizationId, {
                name: req.body.name,
                type: req.body.type,
                providedBy: organizationId,
                accessLevel: req.body.accessLevel,
                description: req.body.description,
            });
            res.status(201).json(resource);
        });
    };
    removeResource = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            await this.federationService.removeSharedResource(req.params.id, req.params.resourceId, organizationId);
            res.status(204).send();
        });
    };
    createTreaty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const treaty = await this.federationService.createTreaty(req.params.id, organizationId, req.body);
            res.status(201).json(treaty);
        });
    };
    terminateTreaty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            await this.federationService.terminateTreaty(req.params.id, req.params.treatyId, organizationId);
            res.status(204).send();
        });
    };
    respondToTreaty = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const treaty = await this.federationService.respondToTreaty(req.params.id, req.params.treatyId, organizationId, req.body.action);
            res.status(200).json(treaty);
        });
    };
    getStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.federationService.getFederationStats(req.params.id));
    };
    getContributions = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.federationService.getMemberContributions(req.params.id));
    };
    getSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.getFederationSettings(req.params.id, organizationId);
        });
    };
    updateSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.updateFederationSettings(req.params.id, organizationId, req.body);
        });
    };
    listFederationFleets = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.getFederationFleets(req.params.id, organizationId);
        });
    };
    listFederationUnits = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.federationService.getFederationUnits(req.params.id, organizationId);
        });
    };
    publicList = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const tags = req.query.tags;
            let parsedTags;
            if (Array.isArray(tags)) {
                parsedTags = tags;
            }
            else if (tags) {
                parsedTags = [tags];
            }
            return this.federationService.getPublicFederations({
                name: req.query.search,
                tags: parsedTags,
                minMembers: req.query.minMembers ? Number(req.query.minMembers) : undefined,
                maxMembers: req.query.maxMembers ? Number(req.query.maxMembers) : undefined,
            }, {
                page: req.query.page ? Number(req.query.page) : 1,
                limit: Math.min(req.query.limit ? Number(req.query.limit) : 20, 200),
                sortBy: req.query.sortBy ?? 'memberCount',
                sortOrder: req.query.sortOrder ?? 'DESC',
            });
        });
    };
    publicGet = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const federation = await this.federationService.getPublicFederation(req.params.id);
            if (!federation) {
                throw new apiErrors_1.NotFoundError('Federation');
            }
            return federation;
        });
    };
    publicStats = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.federationService.getPublicFederationStats());
    };
    listAmbassadors = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.ambassadorService.listAmbassadors(req.params.id));
    };
    appointAmbassador = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            const ambassador = await this.ambassadorService.appointAmbassador(req.params.id, organizationId, req.body);
            res.status(201).json(ambassador);
        });
    };
    updateAmbassador = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            return this.ambassadorService.updateAmbassador(req.params.id, req.params.ambId, organizationId, req.body);
        });
    };
    removeAmbassador = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = this.getOrganizationId(req);
            await this.ambassadorService.removeAmbassador(req.params.id, req.params.ambId, organizationId);
            res.status(204).send();
        });
    };
    getMyAmbassadorProfile = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.ambassadorService.getMyAmbassadorProfile(req.params.id, userId);
        });
    };
    listWikiPages = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.wikiService.listPages(req.params.id, userId);
        });
    };
    getWikiTree = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.wikiService.getPageTree(req.params.id, userId);
        });
    };
    getWikiPage = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.wikiService.getPage(req.params.id, userId, req.params.pageId);
        });
    };
    createWikiPage = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const page = await this.wikiService.createPage(req.params.id, userId, req.body);
            res.status(201).json(page);
        });
    };
    updateWikiPage = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.wikiService.updatePage(req.params.id, userId, req.params.pageId, req.body);
        });
    };
    deleteWikiPage = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            await this.wikiService.deletePage(req.params.id, userId, req.params.pageId);
            res.status(204).send();
        });
    };
    listFederationAnnouncements = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.announcementService.listAnnouncements(req.params.id, userId);
        });
    };
    createFederationAnnouncement = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const userId = this.getAuthUser(authReq).id;
            const userName = authReq.user?.username;
            const body = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'title',
                'content',
                'targetAudience',
            ]);
            const announcement = await this.announcementService.createAnnouncement(req.params.id, userId, {
                title: body.title,
                content: body.content,
                targetAudience: body.targetAudience,
                createdByName: userName,
            });
            res.status(201).json(announcement);
        });
    };
    deleteFederationAnnouncement = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            await this.announcementService.deleteAnnouncement(req.params.id, userId, req.params.announcementId);
            res.status(204).send();
        });
    };
    toggleAnnouncementPin = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.announcementService.togglePin(req.params.id, userId, req.params.announcementId);
        });
    };
    postFederationAnnouncementToDiscord = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const body = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, ['channelId']);
            return this.announcementService.postAnnouncementToDiscord(req.params.id, userId, req.params.announcementId, body.channelId);
        });
    };
    listFederationPolls = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.pollService.listPolls(req.params.id, userId, req.query.status);
        });
    };
    createFederationPoll = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const userId = this.getAuthUser(authReq).id;
            const userName = authReq.user?.username;
            const body = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'title',
                'description',
                'pollType',
                'options',
                'votingMode',
                'isAnonymous',
                'maxSelections',
                'endsAt',
            ]);
            const poll = await this.pollService.createPoll(req.params.id, userId, {
                title: body.title,
                description: body.description,
                pollType: body.pollType,
                options: body.options,
                votingMode: body.votingMode,
                isAnonymous: body.isAnonymous,
                maxSelections: body.maxSelections,
                endsAt: body.endsAt,
                createdByName: userName,
            });
            res.status(201).json(poll);
        });
    };
    castFederationVote = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.pollService.castVote(req.params.id, userId, req.params.pollId, req.body.optionId);
        });
    };
    getFederationPollResults = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.pollService.getResults(req.params.id, userId, req.params.pollId);
        });
    };
    closeFederationPoll = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.pollService.closePoll(req.params.id, userId, req.params.pollId);
        });
    };
    deleteFederationPoll = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            await this.pollService.deletePoll(req.params.id, userId, req.params.pollId);
            res.status(204).send();
        });
    };
    postFederationPollToDiscord = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const body = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, ['channelId']);
            return this.pollService.postPollToDiscord(req.params.id, userId, req.params.pollId, body.channelId);
        });
    };
    listFederationTeams = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.teamService.listTeams(req.params.id, userId);
        });
    };
    getFederationTeam = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.teamService.getTeam(req.params.id, userId, req.params.teamId);
        });
    };
    createFederationTeam = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            const team = await this.teamService.createTeam(req.params.id, userId, req.body);
            res.status(201).json(team);
        });
    };
    updateFederationTeam = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.teamService.updateTeam(req.params.id, userId, req.params.teamId, req.body);
        });
    };
    addFederationTeamMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.teamService.addMember(req.params.id, userId, req.params.teamId, req.body);
        });
    };
    removeFederationTeamMember = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.teamService.removeMember(req.params.id, userId, req.params.teamId, req.params.memberUserId);
        });
    };
    deleteFederationTeam = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            await this.teamService.deleteTeam(req.params.id, userId, req.params.teamId);
            res.status(204).send();
        });
    };
    listFederationIntel = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.intelService.listIntel(req.params.id, userId, {
                classification: req.query.classification,
                status: req.query.status,
            });
        });
    };
    getFederationIntel = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.intelService.getIntel(req.params.id, userId, req.params.intelId);
        });
    };
    submitFederationIntel = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const userId = this.getAuthUser(authReq).id;
            const userName = authReq.user?.username;
            const orgId = this.getOrganizationId(authReq);
            const body = (0, prototypePollutionPrevention_1.sanitizeObject)(req.body, [
                'title',
                'content',
                'classification',
                'tags',
                'visibleToTreaties',
            ]);
            const entry = await this.intelService.submitIntel(req.params.id, userId, {
                title: body.title,
                content: body.content,
                classification: body.classification,
                tags: body.tags,
                visibleToTreaties: body.visibleToTreaties,
                submittedByName: userName,
                submittedByOrgId: orgId,
            });
            res.status(201).json(entry);
        });
    };
    updateFederationIntel = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.intelService.updateIntel(req.params.id, userId, req.params.intelId, req.body);
        });
    };
    approveFederationIntel = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.intelService.approveIntel(req.params.id, userId, req.params.intelId);
        });
    };
    archiveFederationIntel = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.intelService.archiveIntel(req.params.id, userId, req.params.intelId);
        });
    };
    deleteFederationIntel = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            await this.intelService.deleteIntel(req.params.id, userId, req.params.intelId);
            res.status(204).send();
        });
    };
    listFederationPersonnel = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.personnelService.listPersonnel(req.params.id, userId);
        });
    };
    getFederationPersonnelSummary = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.personnelService.getPersonnelSummary(req.params.id, userId);
        });
    };
    getFederationApplicationMode = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.applicationService.getApplicationMode(req.params.id));
    };
    submitFederationApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const authReq = req;
            const userId = this.getAuthUser(authReq).id;
            const orgId = this.getOrganizationId(authReq);
            const orgName = authReq.user?.currentOrganizationName ?? 'Unknown Organization';
            const application = await this.applicationService.applyToFederation(req.params.id, userId, orgId, orgName, req.body);
            res.status(201).json(application);
        });
    };
    listFederationApplications = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.applicationService.listApplications(req.params.id, userId, {
                status: req.query.status,
            });
        });
    };
    reviewFederationApplication = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.applicationService.reviewApplication(req.params.id, req.params.appId, userId, req.body.decision, req.body.note);
        });
    };
    withdrawFederationApplication = async (req, res) => {
        await this.execute(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            await this.applicationService.withdrawApplication(req.params.id, req.params.appId, userId);
            res.status(204).send();
        });
    };
    getFederationDiscordStatus = async (req, res) => {
        await this.executeAndReturn(req, res, async () => this.discordService.getStatus(req.params.id));
    };
    setupFederationDiscord = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.discordService.setupCentralGuild(req.params.id, userId, req.body.guildId, req.body.guildName);
        });
    };
    unlinkFederationDiscord = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.discordService.unlinkCentralGuild(req.params.id, userId);
        });
    };
    getFederationDiscordConflicts = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.discordService.getConflictQueue(req.params.id, userId);
        });
    };
    resolveFederationDiscordConflict = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            return this.discordService.resolveConflict(req.params.id, userId, req.params.discordUserId, req.body.chosenOrgId);
        });
    };
    syncFederationDiscordUser = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = this.getAuthUser(req).id;
            await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, req.params.id, userId, 'settings', 'Ambassador settings permission required to sync Discord users');
            return this.discordService.resolveUserRoles(req.params.id, req.body.discordUserId);
        });
    };
    async requireSettingsPermission(req) {
        const userId = this.getAuthUser(req).id;
        await (0, federationPermissions_1.requireFederationPermission)(this.ambassadorService, req.params.id, userId, 'settings', 'Ambassador settings permission required to manage guild settings');
        return userId;
    }
    getFederationGuildSettingsList = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            await this.requireSettingsPermission(req);
            const rows = await this.discordSettingsService.getAllForFederation(req.params.id);
            return rows.map(r => r.toDTO());
        });
    };
    getFederationGuildSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            await this.requireSettingsPermission(req);
            const settings = await this.discordSettingsService.getOrCreateSettings(req.params.id, req.params.guildId);
            return settings.toDTO();
        });
    };
    updateFederationEventSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateEventSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationVoiceChannelSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateVoiceChannelSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationTunnelSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateTunnelSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationNotificationPreferences = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateNotificationPreferences(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationRoleSyncSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateRoleSyncSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationCrossModerationSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateCrossModerationSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationTicketSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateTicketSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationTeamVoiceSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateTeamVoiceSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationLfgSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateLfgSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationRecruitmentSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateRecruitmentSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationWelcomeSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateWelcomeSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationAuditLogSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateAuditLogSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationStatSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateStatSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationDmNotificationSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateDmNotificationSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationSmartLfgPingSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateSmartLfgPingSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationGiveawaySettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateGiveawaySettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    updateFederationAdvancedEventSettings = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.updateAdvancedEventSettings(req.params.id, req.params.guildId, (0, prototypePollutionPrevention_1.sanitizeObject)(req.body), userId);
            return result.toDTO();
        });
    };
    addFederationStarCommsManagerRole = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const roleId = req.body.roleId;
            const result = await this.discordSettingsService.addStarCommsManagerRole(req.params.id, req.params.guildId, roleId, userId);
            return result.toDTO();
        });
    };
    removeFederationStarCommsManagerRole = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const userId = await this.requireSettingsPermission(req);
            const result = await this.discordSettingsService.removeStarCommsManagerRole(req.params.id, req.params.guildId, req.params.roleId, userId);
            return result.toDTO();
        });
    };
}
exports.FederationController = FederationController;
//# sourceMappingURL=federationController.js.map