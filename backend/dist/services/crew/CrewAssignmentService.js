"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrewAssignmentService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../../config/database");
const CrewAssignment_1 = require("../../models/CrewAssignment");
const apiErrors_1 = require("../../utils/apiErrors");
const logger_1 = require("../../utils/logger");
const pagination_1 = require("../../utils/pagination");
const shared_1 = require("../shared");
class CrewAssignmentService {
    repository = database_1.AppDataSource.getRepository(CrewAssignment_1.CrewAssignment);
    async createAssignment(organizationId, assignerId, input) {
        if (!input.shipId) {
            throw new apiErrors_1.ValidationError('shipId is required');
        }
        const assignment = this.repository.create({
            id: (0, uuid_1.v4)(),
            organizationId,
            shipId: input.shipId,
            missionId: input.missionId ?? undefined,
            assignerId,
            crew: (input.crew ?? []).map(c => ({
                userId: c.userId,
                role: c.role,
                assignedAt: new Date(),
                station: c.station,
            })),
            startDate: input.startDate ? new Date(input.startDate) : undefined,
            endDate: input.endDate ? new Date(input.endDate) : undefined,
            notes: input.notes,
            status: CrewAssignment_1.AssignmentStatus.ACTIVE,
        });
        await this.repository.save(assignment);
        logger_1.logger.info('Crew assignment created', {
            assignmentId: assignment.id,
            organizationId,
            shipId: input.shipId,
            crewCount: assignment.crew.length,
        });
        return assignment;
    }
    async getAssignments(organizationId, pagination) {
        return (0, pagination_1.paginateRepository)(this.repository, pagination, { organizationId }, 'createdAt');
    }
    async getAssignmentById(organizationId, assignmentId) {
        const assignment = await this.repository.findOne({
            where: { id: assignmentId, organizationId },
        });
        if (!assignment) {
            throw new apiErrors_1.NotFoundError('Crew assignment');
        }
        return assignment;
    }
    async addCrewMember(organizationId, assignmentId, input) {
        const assignment = await this.getAssignmentById(organizationId, assignmentId);
        const newMember = {
            userId: input.userId,
            role: input.role,
            assignedAt: new Date(),
            station: input.station,
        };
        const result = shared_1.SlotManager.addMember(assignment.crew, newMember);
        assignment.crew = result.members;
        await this.repository.save(assignment);
        logger_1.logger.info('Crew member added', {
            assignmentId,
            userId: input.userId,
            role: input.role,
        });
        return assignment;
    }
    async removeCrewMember(organizationId, assignmentId, userId) {
        const assignment = await this.getAssignmentById(organizationId, assignmentId);
        const result = shared_1.SlotManager.removeMember(assignment.crew, userId);
        assignment.crew = result.members;
        await this.repository.save(assignment);
        logger_1.logger.info('Crew member removed', {
            assignmentId,
            userId,
        });
        return assignment;
    }
    async updateStatus(organizationId, assignmentId, newStatus) {
        const assignment = await this.getAssignmentById(organizationId, assignmentId);
        shared_1.MembershipWorkflow.validateTransition(shared_1.CREW_TRANSITIONS, assignment.status, newStatus, 'admin');
        const previousStatus = assignment.status;
        assignment.status = newStatus;
        if (newStatus === CrewAssignment_1.AssignmentStatus.COMPLETED && !assignment.endDate) {
            assignment.endDate = new Date();
        }
        await this.repository.save(assignment);
        logger_1.logger.info('Crew assignment status updated', {
            assignmentId,
            from: previousStatus,
            to: newStatus,
        });
        return assignment;
    }
    async getAssignmentsForShip(organizationId, shipId) {
        return this.repository.find({
            where: {
                organizationId,
                shipId,
                status: CrewAssignment_1.AssignmentStatus.ACTIVE,
            },
            order: { createdAt: 'DESC' },
        });
    }
    async isUserAssigned(organizationId, userId) {
        const assignments = await this.repository.find({
            where: { organizationId, status: CrewAssignment_1.AssignmentStatus.ACTIVE },
        });
        return assignments.some(a => shared_1.SlotManager.hasMember(a.crew, userId));
    }
    async getAssignmentsForUser(organizationId, userId) {
        const assignments = await this.repository.find({
            where: { organizationId, status: CrewAssignment_1.AssignmentStatus.ACTIVE },
            order: { createdAt: 'DESC' },
        });
        return assignments.filter(a => shared_1.SlotManager.hasMember(a.crew, userId));
    }
}
exports.CrewAssignmentService = CrewAssignmentService;
//# sourceMappingURL=CrewAssignmentService.js.map