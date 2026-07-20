"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetAuditLogger = exports.FleetAuditLogger = exports.FleetAuditAction = void 0;
const database_1 = require("../../config/database");
const FleetAuditLog_1 = require("../../models/FleetAuditLog");
const logger_1 = require("../../utils/logger");
const AuditService_1 = require("../audit/AuditService");
const DomainAuditLogger_1 = require("../shared/DomainAuditLogger");
var FleetAuditAction;
(function (FleetAuditAction) {
    FleetAuditAction["FLEET_CREATED"] = "FLEET_CREATED";
    FleetAuditAction["FLEET_UPDATED"] = "FLEET_UPDATED";
    FleetAuditAction["FLEET_DELETED"] = "FLEET_DELETED";
    FleetAuditAction["FLEET_ARCHIVED"] = "FLEET_ARCHIVED";
    FleetAuditAction["FLEET_RESTORED"] = "FLEET_RESTORED";
    FleetAuditAction["SHIP_ADDED_TO_FLEET"] = "SHIP_ADDED_TO_FLEET";
    FleetAuditAction["SHIP_REMOVED_FROM_FLEET"] = "SHIP_REMOVED_FROM_FLEET";
    FleetAuditAction["SHIPS_BULK_ADDED"] = "SHIPS_BULK_ADDED";
    FleetAuditAction["FLEET_NESTED"] = "FLEET_NESTED";
    FleetAuditAction["FLEET_UNNESTED"] = "FLEET_UNNESTED";
    FleetAuditAction["FLEET_REORDERED"] = "FLEET_REORDERED";
    FleetAuditAction["FLEET_TEAM_CREATED"] = "FLEET_TEAM_CREATED";
    FleetAuditAction["FLEET_TEAM_CAPACITY_UPDATED"] = "FLEET_TEAM_CAPACITY_UPDATED";
    FleetAuditAction["FLEET_TEAM_REPARENTED"] = "FLEET_TEAM_REPARENTED";
    FleetAuditAction["FLEET_TEAM_DELETED"] = "FLEET_TEAM_DELETED";
    FleetAuditAction["CREW_MEMBER_ASSIGNED"] = "CREW_MEMBER_ASSIGNED";
    FleetAuditAction["CREW_MEMBER_UNASSIGNED"] = "CREW_MEMBER_UNASSIGNED";
    FleetAuditAction["CREW_MEMBER_UNAVAILABLE"] = "CREW_MEMBER_UNAVAILABLE";
    FleetAuditAction["CREW_POSITION_SELECTED"] = "CREW_POSITION_SELECTED";
    FleetAuditAction["CREW_POSITION_VACATED"] = "CREW_POSITION_VACATED";
    FleetAuditAction["FLEET_GATE_PASSED"] = "FLEET_GATE_PASSED";
    FleetAuditAction["FLEET_GATE_FAILED"] = "FLEET_GATE_FAILED";
})(FleetAuditAction || (exports.FleetAuditAction = FleetAuditAction = {}));
class FleetAuditLogger extends DomainAuditLogger_1.DomainAuditLogger {
    static instance;
    constructor() {
        super({
            category: AuditService_1.AuditCategory.FLEET,
            domainLabel: 'Fleet',
        });
    }
    static getInstance() {
        if (!FleetAuditLogger.instance) {
            FleetAuditLogger.instance = new FleetAuditLogger();
        }
        return FleetAuditLogger.instance;
    }
    static resetInstance() {
        if (process.env.NODE_ENV === 'test') {
            FleetAuditLogger.instance = undefined;
        }
    }
    buildMessage(entry) {
        return `Fleet ${entry.action}: ${entry.fleetName}`;
    }
    buildResource(entry) {
        return `fleet/${entry.fleetId}`;
    }
    log(entry) {
        const enriched = {
            ...entry,
            details: {
                ...entry.details,
                fleetId: entry.fleetId,
                fleetName: entry.fleetName,
            },
        };
        super.log(enriched);
        this.persistToDatabase(entry).catch(err => {
            logger_1.logger.warn('Failed to persist fleet audit log to database', {
                action: entry.action,
                fleetId: entry.fleetId,
                error: err instanceof Error ? err.message : String(err),
            });
        });
    }
    async persistToDatabase(entry) {
        if (!database_1.AppDataSource.isInitialized) {
            return;
        }
        const repo = database_1.AppDataSource.getRepository(FleetAuditLog_1.FleetAuditLog);
        const record = repo.create({
            action: entry.action,
            fleetId: entry.fleetId,
            fleetName: entry.fleetName,
            organizationId: entry.organizationId,
            performedById: entry.performedById ?? undefined,
            performedByName: entry.performedByName ?? undefined,
            details: entry.details,
        });
        await repo.save(record);
    }
    logShipAdded(organizationId, fleetId, fleetName, shipId, shipName, performedById, performedByName) {
        this.log({
            action: FleetAuditAction.SHIP_ADDED_TO_FLEET,
            fleetId,
            fleetName,
            organizationId,
            performedById,
            performedByName,
            details: { shipId, shipName },
        });
    }
    logShipRemoved(params) {
        this.log({
            action: FleetAuditAction.SHIP_REMOVED_FROM_FLEET,
            fleetId: params.fleetId,
            fleetName: params.fleetName,
            organizationId: params.organizationId,
            performedById: params.performedById,
            performedByName: params.performedByName,
            details: {
                shipId: params.shipId,
                shipName: params.shipName,
                ...(params.crewFillImpact && { crewFillImpact: params.crewFillImpact }),
            },
        });
    }
    logFleetNested(organizationId, childFleetId, childFleetName, parentFleetId, parentFleetName, performedById, performedByName) {
        this.log({
            action: FleetAuditAction.FLEET_NESTED,
            fleetId: childFleetId,
            fleetName: childFleetName,
            organizationId,
            performedById,
            performedByName,
            details: { parentFleetId, parentFleetName },
        });
    }
    logFleetUnnested(organizationId, childFleetId, childFleetName, previousParentFleetId, previousParentFleetName, performedById, performedByName) {
        this.log({
            action: FleetAuditAction.FLEET_UNNESTED,
            fleetId: childFleetId,
            fleetName: childFleetName,
            organizationId,
            performedById,
            performedByName,
            details: { previousParentFleetId, previousParentFleetName },
        });
    }
    logCrewMemberUnavailable(params) {
        this.log({
            action: FleetAuditAction.CREW_MEMBER_UNAVAILABLE,
            fleetId: params.fleetId,
            fleetName: params.fleetName,
            organizationId: params.organizationId,
            details: {
                memberId: params.memberId,
                memberName: params.memberName,
                previousStatus: params.previousStatus,
                newStatus: params.newStatus,
                ...(params.crewFillImpact && { crewFillImpact: params.crewFillImpact }),
            },
        });
    }
    logGateChange(organizationId, fleetId, fleetName, passed, gate, crewFillImpact, trigger) {
        this.log({
            action: passed ? FleetAuditAction.FLEET_GATE_PASSED : FleetAuditAction.FLEET_GATE_FAILED,
            fleetId,
            fleetName,
            organizationId,
            details: {
                gate,
                trigger,
                crewFillImpact,
            },
        });
    }
    logTeamCreated(organizationId, fleetId, fleetName, teamId, teamName, maxMembers) {
        this.log({
            action: FleetAuditAction.FLEET_TEAM_CREATED,
            fleetId,
            fleetName,
            organizationId,
            details: { teamId, teamName, maxMembers },
        });
    }
    logTeamCapacityUpdated(params) {
        this.log({
            action: FleetAuditAction.FLEET_TEAM_CAPACITY_UPDATED,
            fleetId: params.fleetId,
            fleetName: params.fleetName,
            organizationId: params.organizationId,
            details: {
                teamId: params.teamId,
                previousCapacity: params.previousCapacity,
                newCapacity: params.newCapacity,
                totalCrewPositions: params.totalCrewPositions,
                standbySlots: params.standbySlots,
            },
        });
    }
    async getFleetAuditLog(options) {
        if (database_1.AppDataSource.isInitialized) {
            try {
                return await this.queryFromDatabase(options);
            }
            catch (err) {
                logger_1.logger.warn('Fleet audit DB query failed, falling back to in-memory buffer', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return this.getAuditLog({
            organizationId: options?.organizationId,
            action: options?.action,
            startDate: options?.startDate,
            endDate: options?.endDate,
            limit: options?.limit,
            filter: options?.fleetId ? e => e.fleetId === options.fleetId : undefined,
        });
    }
    async queryFromDatabase(options) {
        const repo = database_1.AppDataSource.getRepository(FleetAuditLog_1.FleetAuditLog);
        const qb = repo.createQueryBuilder('log');
        if (options?.fleetId) {
            qb.andWhere('log.fleetId = :fleetId', { fleetId: options.fleetId });
        }
        if (options?.organizationId) {
            qb.andWhere('log.organizationId = :organizationId', {
                organizationId: options.organizationId,
            });
        }
        if (options?.action) {
            qb.andWhere('log.action = :action', { action: options.action });
        }
        if (options?.startDate) {
            qb.andWhere('log.createdAt >= :startDate', { startDate: options.startDate });
        }
        if (options?.endDate) {
            qb.andWhere('log.createdAt <= :endDate', { endDate: options.endDate });
        }
        qb.orderBy('log.createdAt', 'DESC');
        qb.take(options?.limit ?? 100);
        const rows = await qb.getMany();
        return rows.map(row => ({
            action: row.action,
            fleetId: row.fleetId,
            fleetName: row.fleetName,
            organizationId: row.organizationId,
            performedById: row.performedById,
            performedByName: row.performedByName,
            details: row.details,
            timestamp: row.createdAt,
        }));
    }
}
exports.FleetAuditLogger = FleetAuditLogger;
exports.fleetAuditLogger = FleetAuditLogger.getInstance();
//# sourceMappingURL=FleetAuditLogger.js.map