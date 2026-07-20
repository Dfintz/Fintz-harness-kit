"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fleetVisibilitySchemas = void 0;
const joi_1 = __importDefault(require("joi"));
exports.fleetVisibilitySchemas = {
    createRule: joi_1.default.object({
        scope: joi_1.default.string()
            .valid('organization', 'alliance', 'federation')
            .required()
            .description('Visibility scope type'),
        accessLevel: joi_1.default.string()
            .valid('summary', 'composition', 'full')
            .required()
            .description('Level of detail to expose'),
        minSecurityLevel: joi_1.default.number()
            .integer()
            .min(1)
            .max(100)
            .when('scope', {
            is: 'organization',
            then: joi_1.default.required(),
            otherwise: joi_1.default.forbidden(),
        })
            .description('Minimum member security level (rank) for organization scope'),
        targetAllianceOrgId: joi_1.default.string()
            .uuid()
            .when('scope', {
            is: 'alliance',
            then: joi_1.default.required(),
            otherwise: joi_1.default.forbidden(),
        })
            .description('Target allied org ID for alliance scope'),
        targetFederationId: joi_1.default.string()
            .uuid()
            .when('scope', {
            is: 'federation',
            then: joi_1.default.required(),
            otherwise: joi_1.default.forbidden(),
        })
            .description('Target federation ID for federation scope'),
    }),
    updateRule: joi_1.default.object({
        accessLevel: joi_1.default.string()
            .valid('summary', 'composition', 'full')
            .description('Level of detail to expose'),
        minSecurityLevel: joi_1.default.number()
            .integer()
            .min(1)
            .max(100)
            .description('Minimum security level (only for organization scope)'),
        isActive: joi_1.default.boolean().description('Whether the rule is active'),
    }).min(1),
    checkAccess: joi_1.default.object({
        targetOrgId: joi_1.default.string()
            .uuid()
            .optional()
            .description('Organization requesting access (defaults to caller org)'),
    }),
    ruleParam: joi_1.default.object({
        id: joi_1.default.string().uuid().required(),
        ruleId: joi_1.default.string().uuid().required(),
    }),
    fleetParam: joi_1.default.object({
        id: joi_1.default.string().uuid().required(),
    }),
};
//# sourceMappingURL=fleetVisibilitySchemas.js.map