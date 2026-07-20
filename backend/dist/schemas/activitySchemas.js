"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activitySchemas = exports.bringAndInviteFleetSchema = void 0;
const shared_types_1 = require("@sc-fleet-manager/shared-types");
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
const routeWaypointSchema = joi_1.default.object({
    order: joi_1.default.number().integer().min(0).required(),
    location: joi_1.default.string().trim().min(1).max(200).required(),
    system: joi_1.default.string().trim().min(1).max(100).required(),
    coordinates: joi_1.default.string().trim().max(100).optional(),
    distance: joi_1.default.number().min(0).optional(),
    estimatedTravelTime: joi_1.default.number().integer().min(0).optional(),
    activities: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
    requiredFuel: joi_1.default.number().min(0).optional(),
    quantumFuelRequired: joi_1.default.number().min(0).optional(),
    refuelAvailable: joi_1.default.boolean().optional(),
    notes: joi_1.default.string().trim().max(500).optional(),
});
const crewMemberSchema = joi_1.default.object({
    userId: joi_1.default.string().trim().required(),
    userName: joi_1.default.string().trim().required(),
    position: joi_1.default.string().trim().required(),
    role: joi_1.default.string().trim().optional(),
    assignedAt: joi_1.default.date().iso().optional(),
});
const passengerSlotSchema = joi_1.default.object({
    role: joi_1.default.string().trim().required(),
    capacity: joi_1.default.number().integer().min(1).max(100).required(),
    filled: joi_1.default.number().integer().min(0).max(joi_1.default.ref('capacity')).required(),
    assignedUserNames: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
});
const shipMetadataSchema = joi_1.default.object({
    size: joi_1.default.string().trim().optional(),
    manufacturer: joi_1.default.string().trim().optional(),
    cargoCapacity: joi_1.default.number().min(0).optional(),
    hangarSize: joi_1.default.string().trim().optional(),
    vehicleCargoCapacity: joi_1.default.number().integer().min(0).optional(),
    quantumFuelCapacity: joi_1.default.number().min(0).optional(),
    hydrogenFuelCapacity: joi_1.default.number().min(0).optional(),
    isRefuelCapable: joi_1.default.boolean().optional(),
    isRearmCapable: joi_1.default.boolean().optional(),
    isRepairCapable: joi_1.default.boolean().optional(),
    loanerShip: joi_1.default.string().trim().optional(),
    quantum: joi_1.default.string().trim().optional(),
    shields: joi_1.default.string().trim().optional(),
    weapons: joi_1.default.array().items(joi_1.default.string()).optional(),
    notes: joi_1.default.string().trim().max(500).optional(),
}).unknown(true);
const shipAssignmentSchema = joi_1.default.object({
    id: joi_1.default.string().trim().optional(),
    shipId: joi_1.default.string().trim().optional(),
    shipType: joi_1.default.string().trim().required(),
    shipName: joi_1.default.string().trim().optional(),
    ownerId: joi_1.default.string().trim().required(),
    ownerName: joi_1.default.string().trim().required(),
    captainId: joi_1.default.string().trim().optional(),
    captainName: joi_1.default.string().trim().optional(),
    description: joi_1.default.string().trim().max(500).optional(),
    role: joi_1.default.string()
        .valid('combat', 'mining', 'cargo', 'medical', 'support', 'scout', 'other')
        .required(),
    crewCapacity: joi_1.default.number().integer().min(0).max(100).required(),
    crewAssigned: joi_1.default.number().integer().min(0).max(joi_1.default.ref('crewCapacity')).required(),
    crewMembers: joi_1.default.array().items(crewMemberSchema).default([]),
    crew: joi_1.default.array().items(crewMemberSchema).optional(),
    capabilities: joi_1.default.array().items(joi_1.default.string()).default([]),
    status: joi_1.default.string()
        .valid('available', 'assigned', 'deployed', 'maintenance')
        .default('available'),
    isLoaner: joi_1.default.boolean().optional(),
    contributedBy: joi_1.default.string().trim().optional(),
    contributedByUserId: joi_1.default.string().trim().optional(),
    parentShipId: joi_1.default.string().trim().optional(),
    isTransported: joi_1.default.boolean().optional(),
    transportType: joi_1.default.string().valid('hangar', 'cargo', 'tractor_beam', 'docking_collar').optional(),
    passengers: joi_1.default.array().items(passengerSlotSchema).optional(),
    metadata: shipMetadataSchema.optional(),
});
exports.bringAndInviteFleetSchema = joi_1.default.object({
    fleetId: joi_1.default.string().trim().required(),
    shipIds: joi_1.default.array().items(joi_1.default.string().trim()).max(100).optional(),
    userIds: joi_1.default.array().items(joi_1.default.string().trim()).max(200).optional(),
});
exports.activitySchemas = {
    createV2: joi_1.default.object({
        organizationId: joi_1.default.string().trim().optional(),
        title: joi_1.default.string().trim().min(3).max(200).required(),
        description: common_1.description,
        type: joi_1.default.string()
            .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
            .required(),
        status: joi_1.default.string()
            .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
            .optional(),
        visibility: joi_1.default.string()
            .valid('public', 'organization', 'cross_org', 'alliance', 'private', 'listed')
            .optional(),
        maxParticipants: joi_1.default.number().integer().min(1).max(100).optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        timezone: joi_1.default.string().trim().max(50).optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        requirements: joi_1.default.string().trim().max(500).optional(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional(),
        voiceChannelMode: joi_1.default.string().valid('none', 'current', 'temp').optional(),
        voiceChannelLimit: joi_1.default.number().integer().min(1).max(99).optional(),
        metadata: joi_1.default.object().unknown(true).optional(),
        shipRequirementType: joi_1.default.string().valid('none', 'required', 'preferred').optional(),
        requiredShips: joi_1.default.array()
            .items(joi_1.default.object({
            requirementType: joi_1.default.string().valid('specific', 'role').required(),
            shipName: joi_1.default.string().trim().max(200).optional(),
            shipId: joi_1.default.string().trim().optional(),
            role: joi_1.default.string().trim().max(200).optional(),
            count: joi_1.default.number().integer().min(1).max(99).required(),
            crewPerShip: joi_1.default.number().integer().min(0).max(500).optional(),
            avgCrewPerShip: joi_1.default.number().min(0).max(500).optional(),
        }))
            .max(50)
            .optional(),
        crewSpotsTotal: joi_1.default.number().integer().min(1).max(10000).optional(),
        isRecurring: joi_1.default.boolean().optional(),
        recurringSchedule: joi_1.default.string().trim().max(5000).optional(),
    }),
    updateV2: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: common_1.description,
        type: joi_1.default.string()
            .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
            .optional(),
        status: joi_1.default.string()
            .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
            .optional(),
        visibility: joi_1.default.string()
            .valid('public', 'organization', 'cross_org', 'alliance', 'private', 'listed')
            .optional(),
        maxParticipants: joi_1.default.number().integer().min(1).max(100).optional(),
        startDate: joi_1.default.date().iso().allow(null).optional(),
        endDate: joi_1.default.date().iso().allow(null).optional(),
        timezone: joi_1.default.string().trim().max(50).allow('', null).optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        requirements: joi_1.default.string().trim().max(500).optional(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional(),
        metadata: joi_1.default.object().unknown(true).optional(),
        shipRequirementType: joi_1.default.string().valid('none', 'required', 'preferred').optional(),
        requiredShips: joi_1.default.array()
            .items(joi_1.default.object({
            requirementType: joi_1.default.string().valid('specific', 'role').required(),
            shipName: joi_1.default.string().trim().max(200).optional(),
            shipId: joi_1.default.string().trim().optional(),
            role: joi_1.default.string().trim().max(200).optional(),
            count: joi_1.default.number().integer().min(1).max(99).required(),
            crewPerShip: joi_1.default.number().integer().min(0).max(500).optional(),
            avgCrewPerShip: joi_1.default.number().min(0).max(500).optional(),
        }))
            .max(50)
            .optional(),
        crewSpotsTotal: joi_1.default.number().integer().min(1).max(10000).optional(),
    }),
    create: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).required(),
        description: common_1.description,
        activityType: joi_1.default.string()
            .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
            .required(),
        scheduledStartTime: joi_1.default.date().iso().required(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).required(),
        maxParticipants: joi_1.default.number().integer().min(1).max(100).optional(),
        requiredShips: joi_1.default.array().items(joi_1.default.string()).optional(),
        shipRequirementType: joi_1.default.string().valid('none', 'required', 'preferred').optional(),
        shipRequirements: joi_1.default.array()
            .items(joi_1.default.alternatives().try(joi_1.default.object({
            requirementType: joi_1.default.string().valid('specific').required(),
            shipName: joi_1.default.string().trim().min(1).max(200).required(),
            shipId: joi_1.default.string().trim().optional(),
            count: joi_1.default.number().integer().min(1).max(99).required(),
            crewPerShip: joi_1.default.number().integer().min(0).max(500).required(),
        }), joi_1.default.object({
            requirementType: joi_1.default.string().valid('role').required(),
            role: joi_1.default.string().trim().min(1).max(200).required(),
            count: joi_1.default.number().integer().min(1).max(99).required(),
            avgCrewPerShip: joi_1.default.number().min(0).max(500).required(),
        })))
            .max(50)
            .optional(),
        crewSpotsTotal: joi_1.default.number().integer().min(1).max(10000).optional(),
        difficulty: joi_1.default.string().valid('easy', 'medium', 'hard', 'expert').optional(),
        location: joi_1.default.string().trim().max(200).optional(),
        requirements: joi_1.default.string().trim().max(500).optional(),
        teamId: joi_1.default.string().uuid().allow(null).optional(),
        shipAssignments: joi_1.default.array().items(shipAssignmentSchema).max(20).optional(),
        ships: joi_1.default.array().items(shipAssignmentSchema).max(20).optional(),
        routePlan: joi_1.default.array().items(routeWaypointSchema).max(50).optional(),
        totalDistance: joi_1.default.number().min(0).optional(),
        totalEstimatedTime: joi_1.default.number().integer().min(0).optional(),
        totalCargoCapacity: joi_1.default.number().min(0).optional(),
        totalQuantumFuel: joi_1.default.number().min(0).optional(),
        totalQuantumFuelRequired: joi_1.default.number().min(0).optional(),
        maxJumpRange: joi_1.default.number().min(0).optional(),
        hasRefuelShip: joi_1.default.boolean().optional(),
    }),
    update: joi_1.default.object({
        title: joi_1.default.string().trim().min(3).max(200).optional(),
        description: common_1.description,
        activityType: joi_1.default.string()
            .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
            .optional(),
        scheduledStartTime: joi_1.default.date().iso().optional(),
        estimatedDuration: joi_1.default.number().integer().min(1).max(1440).optional(),
        maxParticipants: joi_1.default.number().integer().min(1).max(100).optional(),
        status: joi_1.default.string()
            .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
            .optional(),
        teamId: joi_1.default.string().uuid().allow(null).optional(),
    }),
    addParticipant: joi_1.default.object({
        userId: common_1.id,
        role: joi_1.default.string().valid('organizer', 'participant', 'reserve').default('participant'),
        shipId: joi_1.default.string().trim().optional(),
    }),
    updateParticipant: joi_1.default.object({
        status: joi_1.default.string()
            .valid('invited', 'confirmed', 'declined', 'attended', 'no_show')
            .required(),
        role: joi_1.default.string().valid('organizer', 'participant', 'reserve').optional(),
    }),
    query: joi_1.default.object({
        ...common_1.paginationKeys,
        activityType: joi_1.default.string()
            .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
            .optional(),
        status: joi_1.default.string()
            .valid('draft', 'open', 'planning', 'recruiting', 'ready', 'in_progress', 'completed', 'failed', 'cancelled', 'expired')
            .optional(),
        startDate: joi_1.default.date().iso().optional(),
        endDate: joi_1.default.date().iso().optional(),
        organizationId: joi_1.default.string().trim().optional(),
    }),
    param: joi_1.default.object({
        id: common_1.id,
    }),
    complete: joi_1.default.object({
        report: joi_1.default.string().trim().max(5000).optional(),
        attendanceCount: joi_1.default.number().integer().min(0).optional(),
        notes: joi_1.default.string().trim().max(2000).optional(),
    }).or('report', 'attendanceCount', 'notes'),
    createReminder: joi_1.default.object({
        reminderType: joi_1.default.string()
            .valid('1_day_before', '1_hour_before', '30_min_before', 'custom')
            .required(),
        channel: joi_1.default.string().valid('discord', 'email', 'both').default('both'),
        recipientUserIds: joi_1.default.array().items(joi_1.default.string()).optional(),
        recipientEmails: joi_1.default.array().items(joi_1.default.string().email()).optional(),
        discordChannelId: common_1.optionalId,
        messageTemplate: joi_1.default.string().trim().max(2000).optional(),
    }),
    rescheduleReminder: joi_1.default.object({
        newTime: joi_1.default.date().iso().required(),
    }),
    reminderParams: joi_1.default.object({
        activityId: common_1.id,
        reminderId: common_1.id,
    }),
    createActivityFull: joi_1.default.object({
        activityData: joi_1.default.object({
            title: joi_1.default.string().trim().min(3).max(200).required(),
            description: common_1.description,
            activityType: joi_1.default.string()
                .valid('mission', 'contract', 'bounty', 'event', 'lfg', 'operation', 'job_listing')
                .required(),
            scheduledStartDate: joi_1.default.date().iso().required(),
            scheduledEndDate: joi_1.default.date().iso().optional(),
            maxParticipants: joi_1.default.number().integer().min(1).max(100).optional(),
        }).required(),
        participantIds: joi_1.default.array().items(joi_1.default.string().trim()).optional(),
        notifyParticipants: joi_1.default.boolean().default(true),
        postToDiscord: joi_1.default.boolean().default(false),
        discordChannelId: joi_1.default.string().trim().when('postToDiscord', { is: true, then: joi_1.default.required() }),
    }),
    completeActivityFull: joi_1.default.object({
        outcome: joi_1.default.string().valid('success', 'failed', 'cancelled').optional(),
        summary: joi_1.default.string().trim().max(2000).optional(),
        participantReports: joi_1.default.array()
            .items(joi_1.default.object({
            userId: common_1.id,
            attended: joi_1.default.boolean().required(),
            contribution: joi_1.default.string().trim().max(500).optional(),
        }))
            .optional(),
        notifyParticipants: joi_1.default.boolean().default(true),
    }),
    loanShips: joi_1.default.object({
        ships: joi_1.default.array()
            .items(joi_1.default.object({
            shipId: joi_1.default.string().trim().optional(),
            shipType: joi_1.default.string().trim().required(),
            shipName: joi_1.default.string().trim().optional(),
            crewCapacity: joi_1.default.number().integer().min(1).max(100).optional(),
        }))
            .min(1)
            .max(20)
            .required(),
    }),
    setCrewPosition: joi_1.default.object({
        targetUserId: joi_1.default.string().trim().required(),
        shipAssignmentId: joi_1.default.string().trim().required(),
        crewPosition: joi_1.default.string()
            .trim()
            .valid(...shared_types_1.ACTIVITY_CREW_POSITIONS)
            .required(),
    }),
    setPassengerSlots: joi_1.default.object({
        slots: joi_1.default.array()
            .items(joi_1.default.object({
            role: joi_1.default.string()
                .trim()
                .valid(...shared_types_1.ACTIVITY_PASSENGER_ROLES)
                .required(),
            capacity: joi_1.default.number().integer().min(0).max(100).required(),
        }))
            .max(10)
            .required(),
    }),
    joinPassenger: joi_1.default.object({
        passengerRole: joi_1.default.string()
            .trim()
            .valid(...shared_types_1.ACTIVITY_PASSENGER_ROLES)
            .required(),
    }),
    setCrewSlots: joi_1.default.object({
        slots: joi_1.default.array()
            .items(joi_1.default.object({
            role: joi_1.default.string()
                .trim()
                .valid(...shared_types_1.ACTIVITY_CREW_POSITIONS)
                .required(),
            capacity: joi_1.default.number().integer().min(0).max(100).required(),
        }))
            .min(1)
            .max(20)
            .required(),
    }),
    bringFleet: joi_1.default.object({
        fleetId: joi_1.default.string().trim().required(),
        shipIds: joi_1.default.array().items(joi_1.default.string().trim()).max(100).optional(),
    }),
    bringAndInviteFleet: exports.bringAndInviteFleetSchema,
    inviteFleet: joi_1.default.object({
        fleetId: joi_1.default.string().trim().required(),
        userIds: joi_1.default.array().items(joi_1.default.string().trim()).max(200).optional(),
    }),
    nestShip: joi_1.default.object({
        parentShipId: joi_1.default.string().trim().allow(null).optional(),
        transportType: joi_1.default.string()
            .valid('hangar', 'cargo', 'tractor_beam', 'docking_collar')
            .allow(null)
            .optional(),
    }),
    initiateReadyCheck: joi_1.default.object({
        durationSeconds: joi_1.default.number().integer().min(30).max(600).default(120),
    }),
    respondReadyCheck: joi_1.default.object({
        response: joi_1.default.string().valid('ready', 'not_ready').required(),
    }),
    setCommandChain: joi_1.default.object({
        fleetCommanders: joi_1.default.array()
            .items(joi_1.default.object({
            userId: joi_1.default.string().trim().required(),
            userName: joi_1.default.string().trim().required(),
            fleetId: joi_1.default.string().trim().optional(),
            fleetName: joi_1.default.string().trim().optional(),
        }))
            .max(20)
            .required(),
        squadronLeaders: joi_1.default.array()
            .items(joi_1.default.object({
            userId: joi_1.default.string().trim().required(),
            userName: joi_1.default.string().trim().required(),
            squadronName: joi_1.default.string().trim().min(1).max(100).required(),
            reportsToUserId: joi_1.default.string().trim().required(),
        }))
            .max(50)
            .default([]),
    }),
    issueCommand: joi_1.default.object({
        type: joi_1.default.string()
            .valid('order', 'preflight_check', 'move_to', 'hold_position', 'engage', 'disengage', 'rally', 'refuel', 'form_up', 'weapons_free', 'weapons_hold', 'custom')
            .required(),
        priority: joi_1.default.string().valid('routine', 'urgent', 'critical').default('routine'),
        message: joi_1.default.string().trim().min(1).max(500).required(),
        targetScope: joi_1.default.object({
            type: joi_1.default.string().valid('all', 'fleet', 'squadron', 'individual').required(),
            fleetId: joi_1.default.string().trim().optional(),
            squadronName: joi_1.default.string().trim().optional(),
            userIds: joi_1.default.array().items(joi_1.default.string().trim()).max(100).optional(),
        }).required(),
        payload: joi_1.default.object().unknown(true).optional(),
    }),
    acknowledgeCommand: joi_1.default.object({
        response: joi_1.default.string().trim().max(200).optional(),
    }),
    provisionStarComms: joi_1.default.object({
        integrationId: joi_1.default.string().uuid().required(),
        dryRun: joi_1.default.boolean().default(false),
    }),
};
//# sourceMappingURL=activitySchemas.js.map