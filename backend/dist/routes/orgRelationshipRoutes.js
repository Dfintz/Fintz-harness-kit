"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const schemaValidation_1 = require("../middleware/schemaValidation");
const schemas_1 = require("../schemas");
const router = (0, express_1.Router)();
exports.router = router;
const relationships = [];
router.post('/orgs/relationships', auth_1.authenticateToken, (0, schemaValidation_1.validateSchema)(schemas_1.orgRelationshipSchemas.createRelationship, 'body'), (req, res) => {
    const { orgId, targetOrgId, relationship } = req.body;
    const existing = relationships.find(rel => rel.orgId === orgId && rel.targetOrgId === targetOrgId);
    if (existing) {
        existing.relationship = relationship;
    }
    else {
        relationships.push({ orgId, targetOrgId, relationship });
    }
    res.status(200).json({ message: 'Relationship updated successfully' });
});
router.get('/orgs/:orgId/relationships', auth_1.authenticateToken, (req, res) => {
    const { orgId } = req.params;
    const orgRelationships = relationships.filter(rel => rel.orgId === orgId);
    res.status(200).json(orgRelationships);
});
exports.default = router;
//# sourceMappingURL=orgRelationshipRoutes.js.map