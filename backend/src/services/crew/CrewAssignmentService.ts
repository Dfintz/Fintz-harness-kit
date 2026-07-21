/**
 * CrewAssignmentService — Domain service for ship crew rostering.
 *
 * Extracts business logic from the controller and uses SlotManager + MembershipWorkflow
 * shared abstractions for member operations and status transitions.
 *
 * Pattern follows the project convention:
 * - Controller handles HTTP concerns only
 * - Service handles business logic, validation, persistence
 */

import { v4 as uuidv4 } from 'uuid';

import { AppDataSource } from '../../config/database';
import { AssignmentStatus, CrewAssignment, type CrewMember } from '../../models/CrewAssignment';
import { NotFoundError, ValidationError } from '../../utils/apiErrors';
import { logger } from '../../utils/logger';
import {
  type PaginatedResponse,
  type PaginationOptions,
  paginateRepository,
} from '../../utils/pagination';
import { CREW_TRANSITIONS, MembershipWorkflow, SlotManager } from '../shared';

// ─── DTOs ────────────────────────────────────────────────────────────

export interface CreateAssignmentInput {
  shipId: string;
  missionId?: string;
  crew?: Array<{
    userId: string;
    role: string;
    station?: string;
  }>;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

export interface AddCrewMemberInput {
  userId: string;
  role: string;
  station?: string;
}

// ─── Service ─────────────────────────────────────────────────────────

export class CrewAssignmentService {
  private readonly repository = AppDataSource.getRepository(CrewAssignment);

  /**
   * Create a new crew assignment for a ship.
   */
  async createAssignment(
    organizationId: string,
    assignerId: string,
    input: CreateAssignmentInput
  ): Promise<CrewAssignment> {
    if (!input.shipId) {
      throw new ValidationError('shipId is required');
    }

    const assignment = this.repository.create({
      id: uuidv4(),
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
      status: AssignmentStatus.ACTIVE,
    });

    await this.repository.save(assignment);

    logger.info('Crew assignment created', {
      assignmentId: assignment.id,
      organizationId,
      shipId: input.shipId,
      crewCount: assignment.crew.length,
    });

    return assignment;
  }

  /**
   * Get paginated crew assignments for an organization.
   */
  async getAssignments(
    organizationId: string,
    pagination: PaginationOptions
  ): Promise<PaginatedResponse<CrewAssignment>> {
    return paginateRepository(this.repository, pagination, { organizationId }, 'createdAt');
  }

  /**
   * Get a single assignment by ID, scoped to the organization.
   */
  async getAssignmentById(organizationId: string, assignmentId: string): Promise<CrewAssignment> {
    const assignment = await this.repository.findOne({
      where: { id: assignmentId, organizationId },
    });

    if (!assignment) {
      throw new NotFoundError('Crew assignment');
    }

    return assignment;
  }

  /**
   * Add a crew member to an assignment.
   * Uses SlotManager for duplicate checking.
   */
  async addCrewMember(
    organizationId: string,
    assignmentId: string,
    input: AddCrewMemberInput
  ): Promise<CrewAssignment> {
    const assignment = await this.getAssignmentById(organizationId, assignmentId);

    const newMember: CrewMember = {
      userId: input.userId,
      role: input.role,
      assignedAt: new Date(),
      station: input.station,
    };

    // SlotManager handles duplicate check + capacity enforcement
    const result = SlotManager.addMember(assignment.crew, newMember);
    assignment.crew = result.members;

    await this.repository.save(assignment);

    logger.info('Crew member added', {
      assignmentId,
      userId: input.userId,
      role: input.role,
    });

    return assignment;
  }

  /**
   * Remove a crew member from an assignment.
   * Uses SlotManager for not-found checking.
   */
  async removeCrewMember(
    organizationId: string,
    assignmentId: string,
    userId: string
  ): Promise<CrewAssignment> {
    const assignment = await this.getAssignmentById(organizationId, assignmentId);

    const result = SlotManager.removeMember(assignment.crew, userId);
    assignment.crew = result.members;

    await this.repository.save(assignment);

    logger.info('Crew member removed', {
      assignmentId,
      userId,
    });

    return assignment;
  }

  /**
   * Update the status of an assignment.
   * Uses MembershipWorkflow to enforce valid transitions.
   */
  async updateStatus(
    organizationId: string,
    assignmentId: string,
    newStatus: AssignmentStatus
  ): Promise<CrewAssignment> {
    const assignment = await this.getAssignmentById(organizationId, assignmentId);

    // Validate the transition using the crew transition map
    MembershipWorkflow.validateTransition(
      CREW_TRANSITIONS,
      assignment.status,
      newStatus,
      'admin' // crew status changes are admin-only
    );

    const previousStatus = assignment.status;
    assignment.status = newStatus;

    // Auto-set endDate when completing
    if (newStatus === AssignmentStatus.COMPLETED && !assignment.endDate) {
      assignment.endDate = new Date();
    }

    await this.repository.save(assignment);

    logger.info('Crew assignment status updated', {
      assignmentId,
      from: previousStatus,
      to: newStatus,
    });

    return assignment;
  }

  /**
   * Get all active assignments for a specific ship.
   */
  async getAssignmentsForShip(organizationId: string, shipId: string): Promise<CrewAssignment[]> {
    return this.repository.find({
      where: {
        organizationId,
        shipId,
        status: AssignmentStatus.ACTIVE,
      },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Check if a user is assigned to any active assignment in the org.
   * Useful for "one assignment per user" enforcement.
   */
  async isUserAssigned(organizationId: string, userId: string): Promise<boolean> {
    const assignments = await this.repository.find({
      where: { organizationId, status: AssignmentStatus.ACTIVE },
    });

    return assignments.some(a => SlotManager.hasMember(a.crew, userId));
  }

  /**
   * Get assignments where a specific user is a crew member.
   */
  async getAssignmentsForUser(organizationId: string, userId: string): Promise<CrewAssignment[]> {
    // Since crew is stored as simple-json, we need to load and filter in-app.
    // For high-volume orgs, consider migrating to JSONB for SQL-level filtering.
    const assignments = await this.repository.find({
      where: { organizationId, status: AssignmentStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });

    return assignments.filter(a => SlotManager.hasMember(a.crew, userId));
  }
}

