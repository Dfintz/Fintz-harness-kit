"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityParticipantService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const data_source_1 = require("../../data-source");
const Activity_1 = require("../../models/Activity");
const ActivityParticipant_1 = require("../../models/ActivityParticipant");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const activityWebSocketController_1 = require("../../websocket/controllers/activityWebSocketController");
const TenantService_1 = require("../base/TenantService");
const ActivityAuditLogger_1 = require("./ActivityAuditLogger");
const RouteCalculationService_1 = require("./RouteCalculationService");
class ActivityParticipantService extends TenantService_1.TenantService {
    participantRepo = data_source_1.AppDataSource.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
    _routeCalcService;
    get routeCalcService() {
        this._routeCalcService ??= new RouteCalculationService_1.RouteCalculationService();
        return this._routeCalcService;
    }
    constructor() {
        super(data_source_1.AppDataSource.getRepository(Activity_1.Activity));
    }
    async findActivityById(activityId) {
        return this.repository
            .createQueryBuilder('activity')
            .where('activity.id = :activityId', { activityId })
            .getOne();
    }
    async findParticipantByActivityAndUser(activityId, userId) {
        return this.participantRepo
            .createQueryBuilder('participant')
            .where('participant.activityId = :activityId', { activityId })
            .andWhere('participant.userId = :userId', { userId })
            .getOne();
    }
    async isParticipant(activityId, userId) {
        const count = await this.participantRepo.count({
            where: { activityId, userId },
        });
        return count > 0;
    }
    async getParticipantCount(activityId, status) {
        const where = { activityId };
        if (status) {
            where.status = status;
        }
        return this.participantRepo.count({ where });
    }
    async getParticipants(activityId, status) {
        const queryBuilder = this.participantRepo
            .createQueryBuilder('participant')
            .where('participant.activityId = :activityId', { activityId });
        if (status) {
            queryBuilder.andWhere('participant.status = :status', { status });
        }
        return queryBuilder.orderBy('participant.joinedAt', 'ASC').getMany();
    }
    async getUserActivities(userId) {
        return this.participantRepo
            .createQueryBuilder('participant')
            .where('participant.userId = :userId', { userId })
            .orderBy('participant.joinedAt', 'DESC')
            .getMany();
    }
    async getParticipant(activityId, userId) {
        return this.findParticipantByActivityAndUser(activityId, userId);
    }
    async isLeader(activityId, userId) {
        const count = await this.participantRepo.count({
            where: { activityId, userId, role: Activity_1.ParticipantRole.LEADER },
        });
        return count > 0;
    }
    async canManageActivity(activityId, userId) {
        const participant = await this.findParticipantByActivityAndUser(activityId, userId);
        if (!participant) {
            return false;
        }
        if (participant.status !== ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED) {
            return false;
        }
        return (participant.role === Activity_1.ParticipantRole.LEADER ||
            participant.role === Activity_1.ParticipantRole.CO_LEADER ||
            participant.role === Activity_1.ParticipantRole.COMMANDER);
    }
    async updateParticipant(activityId, userId, updates) {
        const result = await this.participantRepo.update({ activityId, userId }, updates);
        return result.affected ?? 0;
    }
    async inviteMembers(activityId, members) {
        const invited = [];
        const skipped = [];
        for (const member of members) {
            const existing = await this.findParticipantByActivityAndUser(activityId, member.userId);
            if (existing) {
                skipped.push(member.userId);
                continue;
            }
            const row = this.participantRepo.create({
                activityId,
                userId: member.userId,
                userName: member.userName,
                organizationId: member.organizationId,
                organizationName: member.organizationName,
                role: Activity_1.ParticipantRole.MEMBER,
                status: ActivityParticipant_1.ActivityParticipantStatus.INVITED,
                joinedAt: new Date(),
            });
            await this.participantRepo.save(row);
            invited.push(member.userId);
        }
        return { invited, skipped };
    }
    async syncParticipantToTable(activityId, participant) {
        await this.participantRepo
            .createQueryBuilder()
            .insert()
            .into(ActivityParticipant_1.ActivityParticipantEntity)
            .values({
            activityId,
            userId: participant.userId,
            userName: participant.userName,
            avatarUrl: participant.avatarUrl,
            organizationId: participant.organizationId,
            organizationName: participant.organizationName,
            role: participant.role,
            status: participant.status,
            joinedAt: participant.joinedAt instanceof Date
                ? participant.joinedAt
                : new Date(participant.joinedAt),
            shipType: participant.shipType,
            shipName: participant.shipName,
            shipId: participant.shipId,
            crewPosition: participant.crewPosition,
            crewShipId: participant.crewShipId,
            reputation: participant.reputation,
            notes: participant.notes,
            message: participant.message,
        })
            .orUpdate([
            'userName',
            'avatarUrl',
            'organizationId',
            'organizationName',
            'role',
            'status',
            'shipType',
            'shipName',
            'shipId',
            'crewPosition',
            'crewShipId',
            'reputation',
            'notes',
            'message',
            'updatedAt',
        ], ['activityId', 'userId'])
            .execute();
    }
    async removeParticipantFromTable(activityId, userId) {
        await this.participantRepo.delete({ activityId, userId });
    }
    async joinActivity(activityId, dto) {
        let wasUpdate = false;
        let effectiveRole = dto.role ?? Activity_1.ParticipantRole.MEMBER;
        const savedActivity = await this.withEntityLock(activityId, async (activity, queryRunner) => {
            const activityRepo = queryRunner.manager.getRepository(Activity_1.Activity);
            const participantRepo = queryRunner.manager.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
            const existingRow = await participantRepo
                .createQueryBuilder('participant')
                .where('participant.activityId = :activityId', { activityId })
                .andWhere('participant.userId = :userId', { userId: dto.userId })
                .getOne();
            const now = new Date();
            if (existingRow) {
                wasUpdate = true;
                effectiveRole = dto.role ?? existingRow.role;
                await participantRepo.update({ activityId, userId: dto.userId }, {
                    role: effectiveRole,
                    shipId: dto.shipId ?? existingRow.shipId,
                    shipType: dto.shipType ?? existingRow.shipType,
                    shipName: dto.shipName ?? existingRow.shipName,
                    crewPosition: dto.crewPosition ?? existingRow.crewPosition,
                    notes: dto.notes ?? existingRow.notes,
                    message: dto.message ?? existingRow.message,
                });
                activity.updatedAt = now;
                return activityRepo.save(activity);
            }
            if (activity.maxParticipants) {
                const acceptedCount = await participantRepo.count({
                    where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
                });
                if (acceptedCount >= activity.maxParticipants) {
                    throw new apiErrors_1.ActivityFullError('Activity has reached maximum participants');
                }
            }
            const newRow = participantRepo.create({
                activityId,
                userId: dto.userId,
                userName: dto.userName,
                organizationId: dto.organizationId,
                organizationName: dto.organizationName,
                role: effectiveRole,
                status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED,
                joinedAt: now,
                shipId: dto.shipId,
                shipType: dto.shipType,
                shipName: dto.shipName,
                crewPosition: dto.crewPosition,
                notes: dto.notes,
                message: dto.message,
                metadata: dto.metadata,
            });
            await participantRepo.save(newRow);
            activity.currentParticipants = await participantRepo.count({
                where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
            });
            activity.updatedAt = now;
            return activityRepo.save(activity);
        }, { onNotFound: () => new apiErrors_1.ActivityNotFoundError('activity') });
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.PARTICIPANT_JOINED,
            activityId,
            activityTitle: savedActivity.title,
            activityType: savedActivity.activityType,
            organizationId: savedActivity.organizationId ?? '',
            performedById: dto.userId,
            performedByName: dto.userName,
            details: wasUpdate
                ? { updated: true, role: effectiveRole, shipType: dto.shipType }
                : {
                    role: effectiveRole,
                    organizationId: dto.organizationId,
                    organizationName: dto.organizationName,
                    shipType: dto.shipType,
                    currentParticipants: savedActivity.currentParticipants,
                    maxParticipants: savedActivity.maxParticipants,
                },
        });
        if (wasUpdate) {
            logger_1.logger.info(`User ${dto.userId} updated participation in activity ${activityId}`);
            return { activity: savedActivity, wasUpdate: true };
        }
        logger_1.logger.info(`User ${dto.userId} joined activity ${activityId}`);
        if (savedActivity.organizationId) {
            (0, activityWebSocketController_1.emitParticipantJoined)(savedActivity.organizationId, activityId, { userId: dto.userId, userName: dto.userName, role: effectiveRole }, dto.userId);
        }
        return { activity: savedActivity, wasUpdate: false };
    }
    async leaveActivity(activityId, userId) {
        let leavingUserName;
        let previousCount = 0;
        const savedActivity = await this.withEntityLock(activityId, async (activity, queryRunner) => {
            const activityRepo = queryRunner.manager.getRepository(Activity_1.Activity);
            const participantRepo = queryRunner.manager.getRepository(ActivityParticipant_1.ActivityParticipantEntity);
            if (activity.creatorId === userId) {
                throw new apiErrors_1.ForbiddenError('Activity creator cannot leave their own activity');
            }
            const participantRow = await participantRepo
                .createQueryBuilder('participant')
                .where('participant.activityId = :activityId', { activityId })
                .andWhere('participant.userId = :userId', { userId })
                .getOne();
            if (!participantRow) {
                throw new apiErrors_1.ValidationError('User is not a participant in this activity');
            }
            leavingUserName = participantRow.userName ?? userId;
            previousCount = activity.currentParticipants;
            await participantRepo.delete({ activityId, userId });
            activity.currentParticipants = await participantRepo.count({
                where: { activityId, status: ActivityParticipant_1.ActivityParticipantStatus.ACCEPTED },
            });
            activity.updatedAt = new Date();
            if (activity.ships) {
                for (const ship of activity.ships) {
                    if (ship.crew) {
                        ship.crew = ship.crew.filter(crewMember => crewMember.userId !== userId);
                        ship.currentCrew = ship.crew.length;
                    }
                }
            }
            return activityRepo.save(activity);
        }, { onNotFound: () => new apiErrors_1.ActivityNotFoundError('activity') });
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.PARTICIPANT_LEFT,
            activityId,
            activityTitle: savedActivity.title,
            activityType: savedActivity.activityType,
            organizationId: savedActivity.organizationId ?? '',
            performedById: userId,
            performedByName: leavingUserName ?? userId,
            details: {
                previousParticipantCount: previousCount,
                currentParticipants: savedActivity.currentParticipants,
            },
        });
        logger_1.logger.info(`User ${userId} left activity ${activityId}`);
        if (savedActivity.organizationId) {
            (0, activityWebSocketController_1.emitParticipantLeft)(savedActivity.organizationId, activityId, userId, userId);
        }
        return savedActivity;
    }
    async addShip(activityId, userId, shipDto) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (!(await this.isParticipant(activityId, userId))) {
            throw new apiErrors_1.ForbiddenError('Only activity participants can add ships');
        }
        const ship = {
            id: `ship_${node_crypto_1.default.randomUUID()}`,
            shipType: shipDto.shipType,
            shipName: shipDto.shipName,
            ownerId: userId,
            ownerName: shipDto.captainName || 'Unknown',
            captainId: shipDto.captainId,
            captainName: shipDto.captainName,
            role: 'other',
            crewCapacity: shipDto.maxCrew ?? 1,
            crewAssigned: 1,
            maxCrew: shipDto.maxCrew ?? 1,
            currentCrew: 1,
            description: shipDto.description,
            metadata: shipDto.metadata ?? {},
            capabilities: [],
            status: 'assigned',
            crewMembers: [
                {
                    userId: shipDto.captainId,
                    userName: shipDto.captainName,
                    position: 'Captain',
                },
            ],
            crew: [
                {
                    userId: shipDto.captainId,
                    userName: shipDto.captainName,
                    position: 'Captain',
                },
            ],
        };
        activity.ships = [...(activity.ships ?? []), ship];
        activity.updatedAt = new Date();
        await this.routeCalcService.enrichShipMetadata([ship]);
        await this.routeCalcService.updateActivityRouteData(activity);
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.SHIP_ASSIGNED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: shipDto.captainName || 'Unknown',
            details: {
                shipId: ship.id,
                shipName: shipDto.shipName,
                shipType: shipDto.shipType,
                maxCrew: shipDto.maxCrew,
                captainId: shipDto.captainId,
                totalShips: updatedActivity.ships?.length ?? 0,
            },
        });
        logger_1.logger.info(`Ship ${shipDto.shipName} added to activity ${activityId} by ${userId}`);
        return updatedActivity;
    }
    async joinShipAsCrew(activityId, shipId, userId, userName, position) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        if (!(await this.isParticipant(activityId, userId))) {
            throw new apiErrors_1.ForbiddenError('Only activity participants can join ship crews');
        }
        const ship = activity.ships?.find(s => s.id === shipId);
        if (!ship) {
            throw new apiErrors_1.NotFoundError('Ship');
        }
        if ((ship.currentCrew ?? 0) >= (ship.maxCrew ?? 0)) {
            throw new apiErrors_1.ActivityFullError('Ship has reached maximum crew capacity');
        }
        const isAlreadyCrew = ship.crew?.some(c => c.userId === userId);
        if (isAlreadyCrew) {
            throw new apiErrors_1.ConflictError('User is already crew on this ship');
        }
        ship.crew = [
            ...(ship.crew ?? []),
            {
                userId,
                userName,
                position,
            },
        ];
        ship.currentCrew = ship.crew.length;
        activity.ships = activity.ships ? [...activity.ships] : activity.ships;
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.CREW_JOINED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: userId,
            performedByName: userName,
            details: {
                shipId,
                shipName: ship.shipName,
                shipType: ship.shipType,
                position,
                currentCrew: ship.currentCrew,
                maxCrew: ship.maxCrew,
            },
        });
        logger_1.logger.info(`User ${userId} joined ship ${shipId} in activity ${activityId} as ${position}`);
        return updatedActivity;
    }
    findAndRemoveFromCrew(activity, userId) {
        if (!activity.ships) {
            return null;
        }
        for (const ship of activity.ships) {
            if (!ship.crew) {
                continue;
            }
            const crewIndex = ship.crew.findIndex(c => c.userId === userId);
            if (crewIndex === -1) {
                continue;
            }
            if (ship.captainId === userId) {
                throw new apiErrors_1.ForbiddenError('Ship captain cannot leave crew without transferring captaincy');
            }
            const crewMember = ship.crew[crewIndex];
            const info = {
                shipId: ship.id ?? '',
                shipName: ship.shipName ?? '',
                shipType: ship.shipType,
                position: crewMember.position,
                userName: crewMember.userName,
            };
            ship.crew = ship.crew.filter((_, i) => i !== crewIndex);
            ship.currentCrew = ship.crew.length;
            return info;
        }
        return null;
    }
    async leaveShipCrew(activityId, userId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const leftShipInfo = this.findAndRemoveFromCrew(activity, userId);
        if (!leftShipInfo) {
            throw new apiErrors_1.ValidationError('User is not crew on any ship in this activity');
        }
        activity.ships = activity.ships ? [...activity.ships] : activity.ships;
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        if (leftShipInfo) {
            ActivityAuditLogger_1.activityAuditLogger.log({
                action: ActivityAuditLogger_1.ActivityAuditAction.CREW_LEFT,
                activityId,
                activityTitle: activity.title,
                activityType: activity.activityType,
                organizationId: activity.organizationId ?? '',
                performedById: userId,
                performedByName: leftShipInfo.userName || userId,
                details: {
                    shipId: leftShipInfo.shipId,
                    shipName: leftShipInfo.shipName,
                    shipType: leftShipInfo.shipType,
                    previousPosition: leftShipInfo.position,
                },
            });
        }
        logger_1.logger.info(`User ${userId} left ship crew in activity ${activityId}`);
        return updatedActivity;
    }
    async getAvailableCrewPositions(activityId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const positions = [];
        if (activity.ships) {
            const commonPositions = [
                'Pilot',
                'Co-pilot',
                'Gunner',
                'Engineer',
                'Navigator',
                'Cargo',
                'Medical',
            ];
            for (const ship of activity.ships) {
                const availableSlots = (ship.maxCrew ?? 0) - (ship.currentCrew ?? 0);
                for (let i = 0; i < availableSlots; i++) {
                    const existingPositions = ship.crew?.map(c => c.position) ?? [];
                    const suggestedPosition = commonPositions.find(pos => !existingPositions.includes(pos)) ??
                        `Crew Member ${existingPositions.length + 1}`;
                    positions.push({
                        activityId,
                        shipId: ship.id ?? '',
                        shipName: ship.shipName ?? 'Unknown Ship',
                        shipType: ship.shipType,
                        position: suggestedPosition,
                        available: true,
                        requirements: ship.metadata?.positionRequirements?.[suggestedPosition],
                    });
                }
            }
        }
        return positions;
    }
    async inviteOrganization(activityId, organizationId, organizationName, invitedByUserId, role = 'participant') {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const isCreator = activity.creatorId === invitedByUserId;
        if (!isCreator) {
            throw new apiErrors_1.ForbiddenError('Only activity creator can invite organizations');
        }
        const existingOrg = activity.participatingOrgs?.find(org => org.organizationId === organizationId);
        if (existingOrg) {
            throw new apiErrors_1.ConflictError('Organization is already participating or invited to this activity');
        }
        activity.participatingOrgs = [
            ...(activity.participatingOrgs ?? []),
            {
                organizationId,
                organizationName,
                role: (role || 'participant'),
                memberCount: 0,
                status: 'invited',
                joinedAt: new Date(),
                invitedBy: invitedByUserId,
            },
        ];
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ORG_INVITED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: invitedByUserId,
            performedByName: activity.creatorName || invitedByUserId,
            details: {
                invitedOrganizationId: organizationId,
                invitedOrganizationName: organizationName,
                role,
                totalInvitedOrgs: updatedActivity.participatingOrgs?.filter(o => o.status === 'invited').length || 0,
            },
        });
        logger_1.logger.info(`Organization ${organizationId} invited to activity ${activityId} by ${invitedByUserId}`);
        return updatedActivity;
    }
    async acceptOrganizationInvite(activityId, organizationId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const orgParticipation = activity.participatingOrgs?.find(org => org.organizationId === organizationId);
        if (!orgParticipation) {
            throw new apiErrors_1.NotFoundError('Organization invitation');
        }
        if (orgParticipation.status !== 'invited') {
            throw new apiErrors_1.ValidationError('Organization invitation is not in pending status');
        }
        orgParticipation.status = 'accepted';
        orgParticipation.joinedAt = new Date();
        activity.participatingOrgs = [...activity.participatingOrgs];
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ORG_INVITE_ACCEPTED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: organizationId,
            performedByName: orgParticipation.organizationName,
            details: {
                acceptedOrganizationId: organizationId,
                acceptedOrganizationName: orgParticipation.organizationName,
                role: orgParticipation.role,
                totalParticipatingOrgs: updatedActivity.participatingOrgs?.filter(o => o.status === 'accepted').length || 0,
            },
        });
        logger_1.logger.info(`Organization ${organizationId} accepted invitation to activity ${activityId}`);
        return updatedActivity;
    }
    async declineOrganizationInvite(activityId, organizationId) {
        const activity = await this.findActivityById(activityId);
        if (!activity) {
            throw new apiErrors_1.ActivityNotFoundError('activity');
        }
        const orgIndex = activity.participatingOrgs?.findIndex(org => org.organizationId === organizationId);
        if (orgIndex === undefined || orgIndex === -1) {
            throw new apiErrors_1.NotFoundError('Organization invitation');
        }
        const declinedOrg = activity.participatingOrgs[orgIndex];
        activity.participatingOrgs = activity.participatingOrgs.filter((_, i) => i !== orgIndex);
        activity.updatedAt = new Date();
        const updatedActivity = await this.repository.save(activity);
        ActivityAuditLogger_1.activityAuditLogger.log({
            action: ActivityAuditLogger_1.ActivityAuditAction.ORG_INVITE_DECLINED,
            activityId,
            activityTitle: activity.title,
            activityType: activity.activityType,
            organizationId: activity.organizationId ?? '',
            performedById: organizationId,
            performedByName: declinedOrg.organizationName,
            details: {
                declinedOrganizationId: organizationId,
                declinedOrganizationName: declinedOrg.organizationName,
            },
        });
        logger_1.logger.info(`Organization ${organizationId} declined invitation to activity ${activityId}`);
        return updatedActivity;
    }
}
exports.ActivityParticipantService = ActivityParticipantService;
//# sourceMappingURL=ActivityParticipantService.js.map