-- Cleanup old slug-based demo data before re-seeding with UUIDs
DELETE FROM organization_memberships WHERE "organizationId" LIKE 'demo-org-%';
DELETE FROM fleet_members WHERE "fleetId" LIKE 'demo-fleet-%';
DELETE FROM fleet_ships WHERE "fleetId" LIKE 'demo-fleet-%';
DELETE FROM fleets WHERE id LIKE 'demo-fleet-%';
DELETE FROM alliance_diplomacy WHERE "initiatorOrgId" LIKE 'demo-org-%' OR "targetOrgId" LIKE 'demo-org-%';
DELETE FROM organization_relationships WHERE "requestingOrgId" LIKE 'demo-org-%' OR "targetOrgId" LIKE 'demo-org-%';
DELETE FROM public_org_profiles WHERE "organizationId" LIKE 'demo-org-%';
DELETE FROM public_job_listings WHERE "organizationId" LIKE 'demo-org-%';
DELETE FROM activities WHERE "organizationId" LIKE 'demo-org-%';
DELETE FROM organizations WHERE id LIKE 'demo-org-%';
DELETE FROM user_ships WHERE "userId" LIKE 'demo-user-%';
UPDATE users SET "activeOrgId" = NULL WHERE id LIKE 'demo-user-%';
DELETE FROM users WHERE id LIKE 'demo-user-%';
