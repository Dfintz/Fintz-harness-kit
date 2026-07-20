"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cargoSchemas = exports.diplomacySchemas = exports.orgRelationshipSchemas = exports.shipLoanSchemas = exports.crewSchemas = exports.reputationSchemas = exports.tournamentSchemas = void 0;
const joi_1 = __importDefault(require("joi"));
const common_1 = require("./common");
exports.tournamentSchemas = {
    create: joi_1.default.object({
        name: joi_1.default.string().trim().min(3).max(200).required(),
        description: common_1.description,
        tournamentType: joi_1.default.string()
            .valid('single_elimination', 'double_elimination', 'round_robin', 'swiss')
            .required(),
        startDate: joi_1.default.date().iso().required(),
        endDate: joi_1.default.date().iso().min(joi_1.default.ref('startDate')).required(),
        maxParticipants: joi_1.default.number().integer().min(2).max(256).required(),
        entryFee: joi_1.default.number().min(0).default(0),
        prizePool: joi_1.default.number().min(0).default(0),
        rules: joi_1.default.string().trim().max(5000).optional(),
    }),
    register: joi_1.default.object({
        teamId: joi_1.default.string().trim().optional(),
        players: joi_1.default.array().items(common_1.id).min(1).max(10).required(),
    }),
    updateMatch: joi_1.default.object({
        winnerId: common_1.id,
        score: joi_1.default.object({
            team1: joi_1.default.number().integer().min(0).required(),
            team2: joi_1.default.number().integer().min(0).required(),
        }).required(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
exports.reputationSchemas = {
    update: joi_1.default.object({
        reputation: joi_1.default.number().integer().min(-100).max(100).required(),
        reason: joi_1.default.string().trim().min(10).max(500).required(),
    }),
    query: joi_1.default.object({
        userId: common_1.id,
        organizationId: joi_1.default.string().trim().optional(),
    }),
};
exports.crewSchemas = {
    create: joi_1.default.object({
        shipId: common_1.id,
        missionId: common_1.id.optional(),
        crew: joi_1.default.array()
            .items(joi_1.default.object({
            userId: common_1.id,
            role: joi_1.default.string().trim().min(1).max(50).required(),
            station: joi_1.default.string().trim().optional(),
        }))
            .min(1)
            .max(20)
            .optional(),
        startDate: joi_1.default.string().isoDate().optional(),
        endDate: joi_1.default.string().isoDate().optional(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    addMember: joi_1.default.object({
        userId: common_1.id,
        role: joi_1.default.string().trim().min(1).max(50).required(),
        station: joi_1.default.string().trim().optional(),
    }),
    removeMember: joi_1.default.object({
        userId: common_1.id,
    }),
    removeCrewParams: joi_1.default.object({
        id: common_1.id,
        userId: common_1.id,
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string().valid('active', 'inactive', 'completed').required(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
exports.shipLoanSchemas = {
    request: joi_1.default.object({
        shipId: common_1.id,
        shipName: joi_1.default.string().trim().min(1).max(200).required(),
        borrowerId: common_1.id,
        borrowerName: joi_1.default.string().trim().min(1).max(100).required(),
        duration: joi_1.default.number().integer().min(1).max(365).required(),
        purpose: joi_1.default.string().trim().min(10).max(1000).required(),
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string().valid('pending', 'approved', 'active', 'returned', 'declined').required(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    param: joi_1.default.object({ id: common_1.id.description('Ship loan ID') }),
};
exports.orgRelationshipSchemas = {
    createRelationship: joi_1.default.object({
        orgId: common_1.id.required(),
        targetOrgId: common_1.id.required(),
        relationship: joi_1.default.string().valid('allied', 'neutral', 'hostile').required(),
    }),
    create: joi_1.default.object({
        targetOrganizationId: common_1.id,
        type: joi_1.default.string().valid('allied', 'neutral', 'hostile', 'partner', 'subsidiary').required(),
        description: common_1.description,
    }),
    update: joi_1.default.object({
        type: joi_1.default.string().valid('allied', 'neutral', 'hostile', 'partner', 'subsidiary').optional(),
        status: joi_1.default.string().valid('active', 'inactive', 'terminated').optional(),
        description: common_1.description,
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
exports.diplomacySchemas = {
    proposal: joi_1.default.object({
        targetOrgId: common_1.id,
        allianceType: joi_1.default.string()
            .valid('trade', 'military', 'mutual_defense', 'non_aggression', 'full_alliance')
            .required(),
        terms: joi_1.default.string().trim().max(5000).optional().allow(''),
        notes: joi_1.default.string().trim().max(5000).optional().allow(''),
        name: joi_1.default.string().trim().max(200).optional(),
    }),
    incident: joi_1.default.object({
        description: joi_1.default.string().trim().min(20).max(5000).required(),
        severity: joi_1.default.string().valid('low', 'medium', 'high', 'critical').required(),
        reportedBy: joi_1.default.string().uuid().optional(),
    }),
    resolution: joi_1.default.object({
        resolution: joi_1.default.string().trim().min(20).max(5000).required(),
        status: joi_1.default.string().valid('resolved', 'escalated', 'ongoing').required(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
exports.cargoSchemas = {
    create: joi_1.default.object({
        shipId: common_1.id,
        items: joi_1.default.array()
            .items(joi_1.default.object({
            name: joi_1.default.string().trim().required(),
            quantity: joi_1.default.number().integer().min(1).required(),
            weight: joi_1.default.number().min(0).optional(),
            value: joi_1.default.number().min(0).optional(),
        }))
            .min(1)
            .max(100)
            .required(),
        destination: joi_1.default.string().trim().required(),
        notes: joi_1.default.string().trim().max(1000).optional(),
    }),
    update: joi_1.default.object({
        items: joi_1.default.array()
            .items(joi_1.default.object({
            name: joi_1.default.string().trim().required(),
            quantity: joi_1.default.number().integer().min(1).required(),
        }))
            .optional(),
        status: joi_1.default.string().valid('loading', 'in_transit', 'delivered', 'cancelled').optional(),
    }),
    addItem: joi_1.default.object({
        name: joi_1.default.string().trim().required(),
        quantity: joi_1.default.number().integer().min(1).required(),
        weight: joi_1.default.number().min(0).optional(),
        value: joi_1.default.number().min(0).optional(),
    }),
    updateStatus: joi_1.default.object({
        status: joi_1.default.string().valid('loading', 'in_transit', 'delivered', 'cancelled').required(),
        notes: joi_1.default.string().trim().max(500).optional(),
    }),
    updateSharing: joi_1.default.object({
        sharedWith: joi_1.default.array().items(common_1.id).optional(),
        isPublic: joi_1.default.boolean().optional(),
    }),
    param: joi_1.default.object({ id: common_1.id }),
};
//# sourceMappingURL=additionalSchemas.js.map