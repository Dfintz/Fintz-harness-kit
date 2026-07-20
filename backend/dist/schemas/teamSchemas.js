"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTeamMember = exports.addTeamMember = exports.reorderTeams = exports.moveTeam = exports.updateTeam = exports.createTeam = void 0;
const joi_1 = __importDefault(require("joi"));
exports.createTeam = joi_1.default.object({
    name: joi_1.default.string().min(1).max(100).required(),
    description: joi_1.default.string().max(1000).allow('', null).optional(),
    type: joi_1.default.string().valid('squadron', 'division', 'crew', 'platoon', 'custom').default('squadron'),
    parentTeamId: joi_1.default.string().uuid().allow(null).optional(),
    maxMembers: joi_1.default.number().integer().min(1).max(1000).default(20),
    joinPolicy: joi_1.default.string().valid('open', 'closed').default('closed'),
    emblem: joi_1.default.string().uri().max(500).allow('', null).optional(),
});
exports.updateTeam = joi_1.default.object({
    name: joi_1.default.string().min(1).max(100).optional(),
    description: joi_1.default.string().max(1000).allow('', null).optional(),
    type: joi_1.default.string().valid('squadron', 'division', 'crew', 'platoon', 'custom').optional(),
    parentTeamId: joi_1.default.string().uuid().allow(null).optional(),
    assignedShipId: joi_1.default.string().max(255).allow(null).optional(),
    assignedDivisionId: joi_1.default.string().uuid().allow(null).optional(),
    maxMembers: joi_1.default.number().integer().min(1).max(1000).optional(),
    isActive: joi_1.default.boolean().optional(),
    joinPolicy: joi_1.default.string().valid('open', 'closed').optional(),
    emblem: joi_1.default.string().uri().max(500).allow('', null).optional(),
}).min(1);
exports.moveTeam = joi_1.default.object({
    parentTeamId: joi_1.default.string().uuid().allow(null).required(),
});
exports.reorderTeams = joi_1.default.object({
    orderedIds: joi_1.default.array().items(joi_1.default.string().uuid()).min(1).max(500).required(),
    parentTeamId: joi_1.default.string().uuid().allow(null).optional(),
});
exports.addTeamMember = joi_1.default.object({
    userId: joi_1.default.string().required(),
    role: joi_1.default.string().valid('leader', 'officer', 'member').default('member'),
    rank: joi_1.default.string().max(50).allow('', null).optional(),
    shipType: joi_1.default.string().max(100).allow('', null).optional(),
    specialization: joi_1.default.string().max(500).allow('', null).optional(),
    certifications: joi_1.default.array().items(joi_1.default.string().max(100)).max(50).optional(),
    additionalRoles: joi_1.default.array().items(joi_1.default.string().max(100)).max(20).optional(),
});
const teamMemberStatsSchema = joi_1.default.object({
    missionsCompleted: joi_1.default.number().integer().min(0).optional(),
    hoursFlown: joi_1.default.number().min(0).optional(),
    creditsEarned: joi_1.default.number().min(0).optional(),
});
exports.updateTeamMember = joi_1.default.object({
    role: joi_1.default.string().valid('leader', 'officer', 'member').optional(),
    status: joi_1.default.string()
        .valid('active', 'inactive', 'pending', 'removed', 'on_leave', 'probation', 'deployed')
        .optional(),
    rank: joi_1.default.string().max(50).allow('', null).optional(),
    shipType: joi_1.default.string().max(100).allow('', null).optional(),
    specialization: joi_1.default.string().max(500).allow('', null).optional(),
    stats: teamMemberStatsSchema.optional(),
    certifications: joi_1.default.array().items(joi_1.default.string().max(100)).max(50).optional(),
    additionalRoles: joi_1.default.array().items(joi_1.default.string().max(100)).max(20).optional(),
    lastActiveAt: joi_1.default.string().isoDate().allow(null).optional(),
    departureReason: joi_1.default.string().max(1000).allow('', null).optional(),
}).min(1);
//# sourceMappingURL=teamSchemas.js.map