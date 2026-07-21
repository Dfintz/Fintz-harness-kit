import { ACTIVITY_CREW_POSITIONS, ACTIVITY_PASSENGER_ROLES } from '@sc-fleet-manager/shared-types';
import Joi from 'joi';

import { description, id, optionalId, paginationKeys } from './common';

/**
 * Activity validation schemas
 */

// Route waypoint schema for route planning
const routeWaypointSchema = Joi.object({
  order: Joi.number().integer().min(0).required(),
  location: Joi.string().trim().min(1).max(200).required(),
  system: Joi.string().trim().min(1).max(100).required(),
  coordinates: Joi.string().trim().max(100).optional(),
  distance: Joi.number().min(0).optional(), // km from previous waypoint
  estimatedTravelTime: Joi.number().integer().min(0).optional(), // minutes
  activities: Joi.array().items(Joi.string().trim()).optional(),
  requiredFuel: Joi.number().min(0).optional(), // Legacy - SCU
  quantumFuelRequired: Joi.number().min(0).optional(), // SCU
  refuelAvailable: Joi.boolean().optional(),
  notes: Joi.string().trim().max(500).optional(),
});

// Crew member schema for ship assignments
// Note: 'role' is an optional alias for 'position' for consistency with CrewAssignment model.
// When both are provided, 'position' takes precedence. Future code should use 'role'.
const crewMemberSchema = Joi.object({
  userId: Joi.string().trim().required(),
  userName: Joi.string().trim().required(),
  position: Joi.string().trim().required(),
  role: Joi.string().trim().optional(), // Alias for position (for CrewAssignment consistency)
  assignedAt: Joi.date().iso().optional(),
});

// Passenger slot schema for non-crew personnel
const passengerSlotSchema = Joi.object({
  role: Joi.string().trim().required(),
  capacity: Joi.number().integer().min(1).max(100).required(),
  filled: Joi.number().integer().min(0).max(Joi.ref('capacity')).required(),
  assignedUserNames: Joi.array().items(Joi.string().trim()).optional(),
});

// Ship metadata schema
const shipMetadataSchema = Joi.object({
  size: Joi.string().trim().optional(),
  manufacturer: Joi.string().trim().optional(),
  cargoCapacity: Joi.number().min(0).optional(),
  hangarSize: Joi.string().trim().optional(),
  vehicleCargoCapacity: Joi.number().integer().min(0).optional(),
  quantumFuelCapacity: Joi.number().min(0).optional(),
  hydrogenFuelCapacity: Joi.number().min(0).optional(),
  isRefuelCapable: Joi.boolean().optional(),
  isRearmCapable: Joi.boolean().optional(),
  isRepairCapable: Joi.boolean().optional(),
  loanerShip: Joi.string().trim().optional(),
  quantum: Joi.string().trim().optional(),
  shields: Joi.string().trim().optional(),
  weapons: Joi.array().items(Joi.string()).optional(),
  notes: Joi.string().trim().max(500).optional(),
}).unknown(true); // Allow additional metadata fields

// Ship assignment schema
const shipAssignmentSchema = Joi.object({
  id: Joi.string().trim().optional(),
  shipId: Joi.string().trim().optional(),
  shipType: Joi.string().trim().required(),
  shipName: Joi.string().trim().optional(),
  ownerId: Joi.string().trim().required(),
  ownerName: Joi.string().trim().required(),
  captainId: Joi.string().trim().optional(),
  captainName: Joi.string().trim().optional(),
  description: Joi.string().trim().max(500).optional(),
  role: Joi.string()
    .valid('combat', 'mining', 'cargo', 'medical', 'support', 'scout', 'other')
    .required(),
  crewCapacity: Joi.number().integer().min(0).max(100).required(),
  crewAssigned: Joi.number().integer().min(0).max(Joi.ref('crewCapacity')).required(),
  crewMembers: Joi.array().items(crewMemberSchema).default([]),
  crew: Joi.array().items(crewMemberSchema).optional(), // Alias
  capabilities: Joi.array().items(Joi.string()).default([]),
  status: Joi.string()
    .valid('available', 'assigned', 'deployed', 'maintenance')
    .default('available'),
  // Loaner support
  isLoaner: Joi.boolean().optional(),
  contributedBy: Joi.string().trim().optional(),
  contributedByUserId: Joi.string().trim().optional(),
  // Nested transport support
  parentShipId: Joi.string().trim().optional(),
  isTransported: Joi.boolean().optional(),
  transportType: Joi.string().valid('hangar', 'cargo', 'tractor_beam', 'docking_collar').optional(),
  // Passenger support
  passengers: Joi.array().items(passengerSlotSchema).optional(),
  // Metadata
  metadata: shipMetadataSchema.optional(),
});

export const bringAndInviteFleetSchema = Joi.object({
  fleetId: Joi.string().trim().required(),
  shipIds: Joi.array().items(Joi.string().trim()).max(100).optional(),
  userIds: Joi.array().items(Joi.string().trim()).max(200).optional(),
});

export const activitySchemas = {
  createV2: Joi.object({
    organizationId: Joi.string().trim().optional(),
    title: Joi.string().trim().min(3).max(200).required(),
    description,
    type: Joi.string()
      .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
      .required(),
    status: Joi.string()
      .valid(
        'draft',
        'open',
        'planning',
        'recruiting',
        'ready',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'expired'
      )
      .optional(),
    visibility: Joi.string()
      .valid('public', 'organization', 'cross_org', 'alliance', 'private', 'listed')
      .optional(),
    maxParticipants: Joi.number().integer().min(1).max(100).optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    timezone: Joi.string().trim().max(50).optional(),
    location: Joi.string().trim().max(200).optional(),
    requirements: Joi.string().trim().max(500).optional(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).optional(),
    voiceChannelMode: Joi.string().valid('none', 'current', 'temp').optional(),
    voiceChannelLimit: Joi.number().integer().min(1).max(99).optional(),
    metadata: Joi.object().unknown(true).optional(),
    shipRequirementType: Joi.string().valid('none', 'required', 'preferred').optional(),
    requiredShips: Joi.array()
      .items(
        Joi.object({
          requirementType: Joi.string().valid('specific', 'role').required(),
          shipName: Joi.string().trim().max(200).optional(),
          shipId: Joi.string().trim().optional(),
          role: Joi.string().trim().max(200).optional(),
          count: Joi.number().integer().min(1).max(99).required(),
          crewPerShip: Joi.number().integer().min(0).max(500).optional(),
          avgCrewPerShip: Joi.number().min(0).max(500).optional(),
        })
      )
      .max(50)
      .optional(),
    crewSpotsTotal: Joi.number().integer().min(1).max(10000).optional(),
    isRecurring: Joi.boolean().optional(),
    recurringSchedule: Joi.string().trim().max(5000).optional(),
  }),

  updateV2: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description,
    type: Joi.string()
      .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
      .optional(),
    status: Joi.string()
      .valid(
        'draft',
        'open',
        'planning',
        'recruiting',
        'ready',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'expired'
      )
      .optional(),
    visibility: Joi.string()
      .valid('public', 'organization', 'cross_org', 'alliance', 'private', 'listed')
      .optional(),
    maxParticipants: Joi.number().integer().min(1).max(100).optional(),
    startDate: Joi.date().iso().allow(null).optional(),
    endDate: Joi.date().iso().allow(null).optional(),
    timezone: Joi.string().trim().max(50).allow('', null).optional(),
    location: Joi.string().trim().max(200).optional(),
    requirements: Joi.string().trim().max(500).optional(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).optional(),
    metadata: Joi.object().unknown(true).optional(),
    shipRequirementType: Joi.string().valid('none', 'required', 'preferred').optional(),
    requiredShips: Joi.array()
      .items(
        Joi.object({
          requirementType: Joi.string().valid('specific', 'role').required(),
          shipName: Joi.string().trim().max(200).optional(),
          shipId: Joi.string().trim().optional(),
          role: Joi.string().trim().max(200).optional(),
          count: Joi.number().integer().min(1).max(99).required(),
          crewPerShip: Joi.number().integer().min(0).max(500).optional(),
          avgCrewPerShip: Joi.number().min(0).max(500).optional(),
        })
      )
      .max(50)
      .optional(),
    crewSpotsTotal: Joi.number().integer().min(1).max(10000).optional(),
  }),

  // Create activity
  create: Joi.object({
    title: Joi.string().trim().min(3).max(200).required(),
    description,
    activityType: Joi.string()
      .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
      .required(),
    scheduledStartTime: Joi.date().iso().required(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).required(), // minutes
    maxParticipants: Joi.number().integer().min(1).max(100).optional(),
    requiredShips: Joi.array().items(Joi.string()).optional(),
    shipRequirementType: Joi.string().valid('none', 'required', 'preferred').optional(),
    shipRequirements: Joi.array()
      .items(
        Joi.alternatives().try(
          Joi.object({
            requirementType: Joi.string().valid('specific').required(),
            shipName: Joi.string().trim().min(1).max(200).required(),
            shipId: Joi.string().trim().optional(),
            count: Joi.number().integer().min(1).max(99).required(),
            crewPerShip: Joi.number().integer().min(0).max(500).required(),
          }),
          Joi.object({
            requirementType: Joi.string().valid('role').required(),
            role: Joi.string().trim().min(1).max(200).required(),
            count: Joi.number().integer().min(1).max(99).required(),
            avgCrewPerShip: Joi.number().min(0).max(500).required(),
          })
        )
      )
      .max(50)
      .optional(),
    crewSpotsTotal: Joi.number().integer().min(1).max(10000).optional(),
    difficulty: Joi.string().valid('easy', 'medium', 'hard', 'expert').optional(),
    location: Joi.string().trim().max(200).optional(),
    requirements: Joi.string().trim().max(500).optional(),
    // Team/Squad assignment (Phase 1.1)
    teamId: Joi.string().uuid().allow(null).optional(),
    // Ship assignments validation
    shipAssignments: Joi.array().items(shipAssignmentSchema).max(20).optional(),
    ships: Joi.array().items(shipAssignmentSchema).max(20).optional(), // Alias for shipAssignments
    // Route planning validation
    routePlan: Joi.array().items(routeWaypointSchema).max(50).optional(),
    totalDistance: Joi.number().min(0).optional(),
    totalEstimatedTime: Joi.number().integer().min(0).optional(),
    // Route capabilities (calculated fields - usually set by service, not client)
    totalCargoCapacity: Joi.number().min(0).optional(),
    totalQuantumFuel: Joi.number().min(0).optional(),
    totalQuantumFuelRequired: Joi.number().min(0).optional(),
    maxJumpRange: Joi.number().min(0).optional(),
    hasRefuelShip: Joi.boolean().optional(),
  }),

  // Update activity
  update: Joi.object({
    title: Joi.string().trim().min(3).max(200).optional(),
    description,
    activityType: Joi.string()
      .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
      .optional(),
    scheduledStartTime: Joi.date().iso().optional(),
    estimatedDuration: Joi.number().integer().min(1).max(1440).optional(),
    maxParticipants: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string()
      .valid(
        'draft',
        'open',
        'planning',
        'recruiting',
        'ready',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'expired'
      )
      .optional(),
    // Team/Squad assignment (Phase 1.1)
    teamId: Joi.string().uuid().allow(null).optional(),
  }),

  // Participant operations
  addParticipant: Joi.object({
    userId: id,
    role: Joi.string().valid('organizer', 'participant', 'reserve').default('participant'),
    shipId: Joi.string().trim().optional(),
  }),

  updateParticipant: Joi.object({
    status: Joi.string()
      .valid('invited', 'confirmed', 'declined', 'attended', 'no_show')
      .required(),
    role: Joi.string().valid('organizer', 'participant', 'reserve').optional(),
  }),

  // Query filters
  query: Joi.object({
    ...paginationKeys,
    activityType: Joi.string()
      .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
      .optional(),
    status: Joi.string()
      .valid(
        'draft',
        'open',
        'planning',
        'recruiting',
        'ready',
        'in_progress',
        'completed',
        'failed',
        'cancelled',
        'expired'
      )
      .optional(),
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional(),
    organizationId: Joi.string().trim().optional(),
  }),

  // Activity ID param
  param: Joi.object({
    id,
  }),

  // Complete activity
  complete: Joi.object({
    report: Joi.string().trim().max(5000).optional(),
    attendanceCount: Joi.number().integer().min(0).optional(),
    notes: Joi.string().trim().max(2000).optional(),
  }).or('report', 'attendanceCount', 'notes'),

  // Reminder operations
  createReminder: Joi.object({
    reminderType: Joi.string()
      .valid('1_day_before', '1_hour_before', '30_min_before', 'custom')
      .required(),
    channel: Joi.string().valid('discord', 'email', 'both').default('both'),
    recipientUserIds: Joi.array().items(Joi.string()).optional(),
    recipientEmails: Joi.array().items(Joi.string().email()).optional(),
    discordChannelId: optionalId,
    messageTemplate: Joi.string().trim().max(2000).optional(),
  }),

  rescheduleReminder: Joi.object({
    newTime: Joi.date().iso().required(),
  }),

  reminderParams: Joi.object({
    activityId: id,
    reminderId: id,
  }),

  // Aggregator: create activity with participants
  createActivityFull: Joi.object({
    activityData: Joi.object({
      title: Joi.string().trim().min(3).max(200).required(),
      description,
      activityType: Joi.string()
        .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
        .required(),
      scheduledStartDate: Joi.date().iso().required(),
      scheduledEndDate: Joi.date().iso().optional(),
      maxParticipants: Joi.number().integer().min(1).max(100).optional(),
    }).required(),
    participantIds: Joi.array().items(Joi.string().trim()).optional(),
    notifyParticipants: Joi.boolean().default(true),
    postToDiscord: Joi.boolean().default(false),
    discordChannelId: Joi.string().trim().when('postToDiscord', { is: true, then: Joi.required() }),
  }),

  // Aggregator: complete activity with attendance tracking
  completeActivityFull: Joi.object({
    outcome: Joi.string().valid('success', 'failed', 'cancelled').optional(),
    summary: Joi.string().trim().max(2000).optional(),
    participantReports: Joi.array()
      .items(
        Joi.object({
          userId: id,
          attended: Joi.boolean().required(),
          contribution: Joi.string().trim().max(500).optional(),
        })
      )
      .optional(),
    notifyParticipants: Joi.boolean().default(true),
  }),

  // Loan multiple ships to an activity
  loanShips: Joi.object({
    ships: Joi.array()
      .items(
        Joi.object({
          shipId: Joi.string().trim().optional(),
          shipType: Joi.string().trim().required(),
          shipName: Joi.string().trim().optional(),
          crewCapacity: Joi.number().integer().min(1).max(100).optional(),
        })
      )
      .min(1)
      .max(20)
      .required(),
  }),

  // Set/move a participant's crew position on a ship
  setCrewPosition: Joi.object({
    targetUserId: Joi.string().trim().required(),
    shipAssignmentId: Joi.string().trim().required(),
    crewPosition: Joi.string()
      .trim()
      .valid(...ACTIVITY_CREW_POSITIONS)
      .required(),
  }),

  // Define/edit passenger (non-crew) slots on a ship
  setPassengerSlots: Joi.object({
    slots: Joi.array()
      .items(
        Joi.object({
          role: Joi.string()
            .trim()
            .valid(...ACTIVITY_PASSENGER_ROLES)
            .required(),
          capacity: Joi.number().integer().min(0).max(100).required(),
        })
      )
      .max(10)
      .required(),
  }),

  // Join a ship as a passenger in a slot of the given role
  joinPassenger: Joi.object({
    passengerRole: Joi.string()
      .trim()
      .valid(...ACTIVITY_PASSENGER_ROLES)
      .required(),
  }),

  // Define/edit typed crew slots (seats per role) on a ship
  setCrewSlots: Joi.object({
    slots: Joi.array()
      .items(
        Joi.object({
          role: Joi.string()
            .trim()
            .valid(...ACTIVITY_CREW_POSITIONS)
            .required(),
          capacity: Joi.number().integer().min(0).max(100).required(),
        })
      )
      .min(1)
      .max(20)
      .required(),
  }),

  // Bring some/all of a fleet's ships into an activity
  bringFleet: Joi.object({
    fleetId: Joi.string().trim().required(),
    shipIds: Joi.array().items(Joi.string().trim()).max(100).optional(),
  }),

  // Bring fleet ships and invite fleet members in one orchestrated call
  bringAndInviteFleet: bringAndInviteFleetSchema,

  // Invite some/all of a fleet's members to an activity
  inviteFleet: Joi.object({
    fleetId: Joi.string().trim().required(),
    userIds: Joi.array().items(Joi.string().trim()).max(200).optional(),
  }),

  // Nest a ship inside another ship's hangar/cargo (parentShipId=null to un-nest)
  nestShip: Joi.object({
    parentShipId: Joi.string().trim().allow(null).optional(),
    transportType: Joi.string()
      .valid('hangar', 'cargo', 'tractor_beam', 'docking_collar')
      .allow(null)
      .optional(),
  }),

  // Initiate ready check for an activity
  initiateReadyCheck: Joi.object({
    durationSeconds: Joi.number().integer().min(30).max(600).default(120),
  }),

  // Respond to an active ready check
  respondReadyCheck: Joi.object({
    response: Joi.string().valid('ready', 'not_ready').required(),
  }),

  // Set command chain for an operation
  setCommandChain: Joi.object({
    fleetCommanders: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().trim().required(),
          userName: Joi.string().trim().required(),
          fleetId: Joi.string().trim().optional(),
          fleetName: Joi.string().trim().optional(),
        })
      )
      .max(20)
      .required(),
    squadronLeaders: Joi.array()
      .items(
        Joi.object({
          userId: Joi.string().trim().required(),
          userName: Joi.string().trim().required(),
          squadronName: Joi.string().trim().min(1).max(100).required(),
          reportsToUserId: Joi.string().trim().required(),
        })
      )
      .max(50)
      .default([]),
  }),

  // Issue a command through the chain
  issueCommand: Joi.object({
    type: Joi.string()
      .valid(
        'order',
        'preflight_check',
        'move_to',
        'hold_position',
        'engage',
        'disengage',
        'rally',
        'refuel',
        'form_up',
        'weapons_free',
        'weapons_hold',
        'custom'
      )
      .required(),
    priority: Joi.string().valid('routine', 'urgent', 'critical').default('routine'),
    message: Joi.string().trim().min(1).max(500).required(),
    targetScope: Joi.object({
      type: Joi.string().valid('all', 'fleet', 'squadron', 'individual').required(),
      fleetId: Joi.string().trim().optional(),
      squadronName: Joi.string().trim().optional(),
      userIds: Joi.array().items(Joi.string().trim()).max(100).optional(),
    }).required(),
    payload: Joi.object().unknown(true).optional(),
  }),

  // Acknowledge a command
  acknowledgeCommand: Joi.object({
    response: Joi.string().trim().max(200).optional(),
  }),

  // Provision StarComms operation from activity context
  provisionStarComms: Joi.object({
    integrationId: Joi.string().uuid().required(),
    dryRun: Joi.boolean().default(false),
  }),
};
