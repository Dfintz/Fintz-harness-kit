import { Request, Response, Router } from 'express';

import { authenticateToken } from '../middleware/auth';
import { validateSchema } from '../middleware/schemaValidation';
import { orgRelationshipSchemas } from '../schemas';
import { OrgRelationship } from '../types';
const router = Router();

// In-memory storage for relationships (replace with a database in production)
const relationships: OrgRelationship[] = [];

// Set or update a relationship
router.post(
  '/orgs/relationships',
  authenticateToken,
  validateSchema(orgRelationshipSchemas.createRelationship, 'body'),
  (req: Request, res: Response) => {
    const { orgId, targetOrgId, relationship } = req.body;

    // Check if the relationship already exists
    const existing = relationships.find(
      rel => rel.orgId === orgId && rel.targetOrgId === targetOrgId
    );

    if (existing) {
      existing.relationship = relationship; // Update the relationship
    } else {
      relationships.push({ orgId, targetOrgId, relationship }); // Add a new relationship
    }

    res.status(200).json({ message: 'Relationship updated successfully' });
  }
);

// Get relationships for an organization
router.get('/orgs/:orgId/relationships', authenticateToken, (req: Request, res: Response) => {
  const { orgId } = req.params;
  const orgRelationships = relationships.filter(rel => rel.orgId === orgId);
  res.status(200).json(orgRelationships);
});

export { router };
// eslint-disable-next-line import/no-default-export
export default router;
