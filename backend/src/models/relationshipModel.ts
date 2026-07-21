export interface OrgRelationship {
    orgId: string; // ID of the organization setting the relationship
    targetOrgId: string; // ID of the target organization
    relationship: 'Neutral' | 'Cooperative' | 'Alliance' | 'Hostile'; // Relationship type
}