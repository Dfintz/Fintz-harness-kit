"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SquadronController = void 0;
const FleetService_1 = require("../services/fleet/FleetService");
const TeamService_1 = require("../services/team/TeamService");
const apiErrors_1 = require("../utils/apiErrors");
const pagination_1 = require("../utils/pagination");
const BaseController_1 = require("./BaseController");
class SquadronController extends BaseController_1.BaseController {
    teamService;
    fleetService;
    constructor() {
        super();
        this.teamService = new TeamService_1.TeamService();
        this.fleetService = new FleetService_1.FleetService();
    }
    async resolveTeamId(organizationId, squadronId) {
        const fleet = await this.fleetService.findById(organizationId, squadronId);
        if (!fleet) {
            throw new apiErrors_1.NotFoundError(`Fleet/squadron ${squadronId}`);
        }
        if (!fleet.teamId) {
            throw new apiErrors_1.ValidationError(`Fleet ${squadronId} has no linked team. ` +
                'Run migration 1789000000000-MigrateFleetMembersToTeamMembers first.');
        }
        return fleet.teamId;
    }
    getSquadronMembers = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            const squadronId = req.params.squadronId || req.query.squadronId;
            const teamId = squadronId ? await this.resolveTeamId(organizationId, squadronId) : undefined;
            const filters = {
                teamId,
                userId: req.query.userId,
                role: req.query.role,
                shipType: req.query.shipType,
                status: this.parseStatusFilter(req.query.status),
                joinedAfter: req.query.joinedAfter ? new Date(req.query.joinedAfter) : undefined,
                joinedBefore: req.query.joinedBefore
                    ? new Date(req.query.joinedBefore)
                    : undefined,
                lastActiveAfter: req.query.lastActiveAfter
                    ? new Date(req.query.lastActiveAfter)
                    : undefined,
                lastActiveBefore: req.query.lastActiveBefore
                    ? new Date(req.query.lastActiveBefore)
                    : undefined,
                searchTerm: req.query.searchTerm,
                ...(0, pagination_1.extractPaginationOptions)(req),
            };
            return this.teamService.getTeamMembersFiltered(organizationId, filters);
        });
    };
    getSquadronMemberById = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { memberId } = req.params;
            if (!organizationId || !memberId) {
                throw new apiErrors_1.ValidationError('Organization context and member ID required');
            }
            const member = await this.teamService.getTeamMemberById(organizationId, memberId);
            if (!member) {
                throw new apiErrors_1.NotFoundError('Squadron member');
            }
            return member;
        });
    };
    getSquadronRoster = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            return this.teamService.getTeamMembers(organizationId, teamId);
        });
    };
    getUserSquadrons = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const userId = req.params.userId || req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            return this.teamService.findByUser(organizationId, userId);
        });
    };
    checkMembership = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId, userId } = req.params;
            if (!organizationId || !squadronId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context, squadron ID, and user ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const isMember = await this.teamService.isMember(organizationId, teamId, userId);
            return { isMember };
        });
    };
    getMembership = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId, userId } = req.params;
            if (!organizationId || !squadronId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context, squadron ID, and user ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const membership = await this.teamService.getMembership(organizationId, teamId, userId);
            if (!membership) {
                throw new apiErrors_1.NotFoundError('Membership');
            }
            return membership;
        });
    };
    addMember = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            const { userId, role } = req.body;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            if (!userId) {
                throw new apiErrors_1.ValidationError('User ID is required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const existing = await this.teamService.getMembership(organizationId, teamId, userId);
            if (existing) {
                throw new apiErrors_1.ValidationError('User is already a member of this squadron');
            }
            const member = await this.teamService.addMember(organizationId, teamId, userId, (role || 'member'));
            res.status(201).json(member);
        });
    };
    bulkAddMembers = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            const { members } = req.body;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            if (!Array.isArray(members)) {
                throw new apiErrors_1.ValidationError('members must be an array');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const created = await this.teamService.bulkAddMembers(organizationId, teamId, members);
            res.status(201).json(created);
        });
    };
    bulkUpdateMembers = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { updates } = req.body;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!Array.isArray(updates)) {
                throw new apiErrors_1.ValidationError('updates must be an array');
            }
            return this.teamService.bulkUpdateMembers(organizationId, updates);
        });
    };
    bulkDeleteMembers = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId, memberIds } = req.body;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!squadronId) {
                throw new apiErrors_1.ValidationError('squadronId is required');
            }
            if (!Array.isArray(memberIds)) {
                throw new apiErrors_1.ValidationError('memberIds must be an array');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            await this.teamService.bulkDeleteMembers(organizationId, teamId, memberIds);
            res.status(204).send();
        });
    };
    bulkUpdateStatus = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId, memberIds, status } = req.body;
            if (!organizationId) {
                throw new apiErrors_1.ValidationError('Organization context required');
            }
            if (!squadronId) {
                throw new apiErrors_1.ValidationError('squadronId is required');
            }
            if (!Array.isArray(memberIds)) {
                throw new apiErrors_1.ValidationError('memberIds must be an array');
            }
            if (!status) {
                throw new apiErrors_1.ValidationError('status is required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            await this.teamService.bulkUpdateStatus(organizationId, teamId, memberIds, status);
            res.status(204).send();
        });
    };
    updateRole = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId, userId } = req.params;
            const { role } = req.body;
            if (!organizationId || !squadronId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context, squadron ID, and user ID required');
            }
            if (!role) {
                throw new apiErrors_1.ValidationError('role is required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const membership = await this.teamService.getMembership(organizationId, teamId, userId);
            if (!membership) {
                throw new apiErrors_1.NotFoundError('Membership');
            }
            const member = await this.teamService.updateMember(organizationId, teamId, membership.id, {
                role: role,
            });
            if (!member) {
                throw new apiErrors_1.NotFoundError('Membership');
            }
            return member;
        });
    };
    removeMember = async (req, res) => {
        await this.execute(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId, userId } = req.params;
            if (!organizationId || !squadronId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context, squadron ID, and user ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const membership = await this.teamService.getMembership(organizationId, teamId, userId);
            if (!membership) {
                throw new apiErrors_1.NotFoundError('Membership');
            }
            await this.teamService.removeMember(organizationId, teamId, membership.id);
            res.status(204).send();
        });
    };
    getSquadronMemberCount = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const count = await this.teamService.getTeamMemberCount(organizationId, teamId);
            return { count };
        });
    };
    getActiveCount = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            const count = await this.teamService.getActiveCount(organizationId, teamId);
            return { count };
        });
    };
    getMembersByRole = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            return this.teamService.getMembersByRole(organizationId, teamId);
        });
    };
    getMembersByShipType = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            return this.teamService.getMembersByShipType(organizationId, teamId);
        });
    };
    getSquadronStatistics = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const { squadronId } = req.params;
            if (!organizationId || !squadronId) {
                throw new apiErrors_1.ValidationError('Organization context and squadron ID required');
            }
            const teamId = await this.resolveTeamId(organizationId, squadronId);
            return this.teamService.getTeamStatistics(organizationId, teamId);
        });
    };
    getUserSquadronCount = async (req, res) => {
        await this.executeAndReturn(req, res, async () => {
            const organizationId = req.organizationId || req.user?.organizationId;
            const userId = req.params.userId || req.user?.id;
            if (!organizationId || !userId) {
                throw new apiErrors_1.ValidationError('Organization context and user ID required');
            }
            const count = await this.teamService.getUserTeamCount(organizationId, userId);
            return { count };
        });
    };
    parseStatusFilter(status) {
        if (!status) {
            return undefined;
        }
        if (typeof status === 'string') {
            if (status.includes(',')) {
                return status.split(',').map(s => s.trim());
            }
            return status;
        }
        return undefined;
    }
}
exports.SquadronController = SquadronController;
//# sourceMappingURL=squadronController.js.map