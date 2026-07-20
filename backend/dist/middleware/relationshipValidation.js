"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTerminateRelationship = exports.validateUUID = exports.validateUpdateTrustScore = exports.validateRecordInteraction = exports.validateUpdateRelationship = exports.validateCreateRelationship = void 0;
const OrganizationRelationship_1 = require("../models/OrganizationRelationship");
const RelationshipHistory_1 = require("../models/RelationshipHistory");
const validateCreateRelationship = (req, res, next) => {
    const { organizationId, targetOrganizationId, type } = req.body;
    const errors = [];
    if (!organizationId || typeof organizationId !== 'string') {
        errors.push('organizationId is required and must be a string');
    }
    if (!targetOrganizationId || typeof targetOrganizationId !== 'string') {
        errors.push('targetOrganizationId is required and must be a string');
    }
    if (organizationId === targetOrganizationId) {
        errors.push('Cannot create relationship with self');
    }
    if (!type || !Object.values(OrganizationRelationship_1.RelationshipType).includes(type)) {
        errors.push(`type must be one of: ${Object.values(OrganizationRelationship_1.RelationshipType).join(', ')}`);
    }
    if (req.body.status && !Object.values(OrganizationRelationship_1.RelationshipStatus).includes(req.body.status)) {
        errors.push(`status must be one of: ${Object.values(OrganizationRelationship_1.RelationshipStatus).join(', ')}`);
    }
    if (req.body.contactEmail && !isValidEmail(req.body.contactEmail)) {
        errors.push('contactEmail must be a valid email address');
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }
    next();
};
exports.validateCreateRelationship = validateCreateRelationship;
const validateUpdateRelationship = (req, res, next) => {
    const errors = [];
    if (req.body.type && !Object.values(OrganizationRelationship_1.RelationshipType).includes(req.body.type)) {
        errors.push(`type must be one of: ${Object.values(OrganizationRelationship_1.RelationshipType).join(', ')}`);
    }
    if (req.body.status && !Object.values(OrganizationRelationship_1.RelationshipStatus).includes(req.body.status)) {
        errors.push(`status must be one of: ${Object.values(OrganizationRelationship_1.RelationshipStatus).join(', ')}`);
    }
    if (req.body.contactEmail && !isValidEmail(req.body.contactEmail)) {
        errors.push('contactEmail must be a valid email address');
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }
    next();
};
exports.validateUpdateRelationship = validateUpdateRelationship;
const validateRecordInteraction = (req, res, next) => {
    const { sentiment, description } = req.body;
    const errors = [];
    if (!sentiment || !Object.values(RelationshipHistory_1.InteractionSentiment).includes(sentiment)) {
        errors.push(`sentiment must be one of: ${Object.values(RelationshipHistory_1.InteractionSentiment).join(', ')}`);
    }
    if (!description || typeof description !== 'string' || description.trim().length === 0) {
        errors.push('description is required and must be a non-empty string');
    }
    if (description && description.length > 1000) {
        errors.push('description must not exceed 1000 characters');
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }
    next();
};
exports.validateRecordInteraction = validateRecordInteraction;
const validateUpdateTrustScore = (req, res, next) => {
    const { delta, reason } = req.body;
    const errors = [];
    if (delta === undefined || typeof delta !== 'number') {
        errors.push('delta is required and must be a number');
    }
    if (delta && (delta < -100 || delta > 100)) {
        errors.push('delta must be between -100 and 100');
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        errors.push('reason is required and must be a non-empty string');
    }
    if (reason && reason.length > 500) {
        errors.push('reason must not exceed 500 characters');
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }
    next();
};
exports.validateUpdateTrustScore = validateUpdateTrustScore;
const validateUUID = (paramName) => (req, res, next) => {
    const uuid = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuid || !uuidRegex.test(uuid)) {
        return res.status(400).json({
            success: false,
            error: `Invalid ${paramName} format. Must be a valid UUID.`
        });
    }
    next();
};
exports.validateUUID = validateUUID;
const validateTerminateRelationship = (req, res, next) => {
    const { reason } = req.body;
    const errors = [];
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        errors.push('reason is required for terminating a relationship');
    }
    if (reason && reason.length > 500) {
        errors.push('reason must not exceed 500 characters');
    }
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors
        });
    }
    next();
};
exports.validateTerminateRelationship = validateTerminateRelationship;
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
//# sourceMappingURL=relationshipValidation.js.map