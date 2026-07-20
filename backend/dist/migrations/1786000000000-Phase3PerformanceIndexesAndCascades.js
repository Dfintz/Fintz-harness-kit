"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Phase3PerformanceIndexesAndCascades1786000000000 = void 0;
class Phase3PerformanceIndexesAndCascades1786000000000 {
    name = 'Phase3PerformanceIndexesAndCascades1786000000000';
    async hasIndex(queryRunner, indexName) {
        const rows = await queryRunner.query(`SELECT 1
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND LOWER(indexname) = LOWER($1)
       LIMIT 1`, [indexName]);
        return rows.length > 0;
    }
    async up(queryRunner) {
        if (await this.hasIndex(queryRunner, 'IDX_alliance_diplomacy_orgId1')) {
            return;
        }
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_activities_organizationId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cd38ac021bee5187c2576b3ef4"`);
        await queryRunner.query(`CREATE INDEX "IDX_alliance_diplomacy_orgId1" ON "alliance_diplomacy" ("orgId1")`);
        await queryRunner.query(`CREATE INDEX "IDX_alliance_diplomacy_orgId2" ON "alliance_diplomacy" ("orgId2")`);
        await queryRunner.query(`CREATE INDEX "IDX_alliance_diplomacy_status" ON "alliance_diplomacy" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_briefings_creatorId" ON "briefings" ("creatorId")`);
        await queryRunner.query(`CREATE INDEX "IDX_briefings_status" ON "briefings" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_cargo_manifests_shipId" ON "cargo_manifests" ("shipId")`);
        await queryRunner.query(`CREATE INDEX "IDX_cargo_manifests_ownerId" ON "cargo_manifests" ("ownerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_cargo_manifests_status" ON "cargo_manifests" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_data_breach_notifications_severity" ON "data_breach_notifications" ("severity")`);
        await queryRunner.query(`CREATE INDEX "IDX_data_breach_notifications_status" ON "data_breach_notifications" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_logistics_fleetId" ON "fleet_logistics" ("fleetId")`);
        await queryRunner.query(`CREATE INDEX "IDX_fleet_logistics_status" ON "fleet_logistics" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_ship_maintenance_shipId" ON "ship_maintenance" ("shipId")`);
        await queryRunner.query(`CREATE INDEX "IDX_ship_maintenance_ownerId" ON "ship_maintenance" ("ownerId")`);
        await queryRunner.query(`CREATE INDEX "IDX_ship_maintenance_status" ON "ship_maintenance" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_bounty_evidence_submittedBy" ON "bounty_evidence" ("submittedBy")`);
        await queryRunner.query(`CREATE INDEX "IDX_external_integrations_type" ON "external_integrations" ("type")`);
        await queryRunner.query(`CREATE INDEX "IDX_external_integrations_status" ON "external_integrations" ("status")`);
        await queryRunner.query(`CREATE INDEX "IDX_legal_holds_isActive" ON "legal_holds" ("isActive")`);
        await queryRunner.query(`CREATE INDEX "IDX_shared_accounts_createdBy" ON "shared_accounts" ("createdBy")`);
        await queryRunner.query(`CREATE INDEX "IDX_ship_loadouts_shipId" ON "ship_loadouts" ("shipId")`);
        await queryRunner.query(`CREATE INDEX "IDX_organization_templates_category" ON "organization_templates" ("category")`);
        await queryRunner.query(`CREATE INDEX "IDX_organization_templates_isPublic" ON "organization_templates" ("isPublic")`);
        await queryRunner.query(`CREATE INDEX "IDX_organization_analytics_org_period" ON "organization_analytics" ("organizationId", "periodStart")`);
        await queryRunner.query(`ALTER TABLE "announcements" DROP CONSTRAINT "FK_9f7aad9ecbc4e6f88f1a092c6bb"`);
        await queryRunner.query(`ALTER TABLE "announcements" ADD CONSTRAINT "FK_announcements_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config" DROP CONSTRAINT "FK_47e7f43a0f30af2bb0f57f27438"`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config" ADD CONSTRAINT "FK_blacklist_sharing_config_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bounties" DROP CONSTRAINT "FK_fc2ce2a4b57fa19e3c59a918d9e"`);
        await queryRunner.query(`ALTER TABLE "bounties" ADD CONSTRAINT "FK_bounties_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_attendance_confirmations" DROP CONSTRAINT "FK_ff407a1b0695f94f9fa291e99dd"`);
        await queryRunner.query(`ALTER TABLE "event_attendance_confirmations" ADD CONSTRAINT "FK_event_attendance_confirmations_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mirror_actions" DROP CONSTRAINT "FK_81fca3dc1382d9f50ebe2cf7064"`);
        await queryRunner.query(`ALTER TABLE "mirror_actions" ADD CONSTRAINT "FK_mirror_actions_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "moderation_incidents" DROP CONSTRAINT "FK_6d23198e36b7f7bd398f57a3dc9"`);
        await queryRunner.query(`ALTER TABLE "moderation_incidents" ADD CONSTRAINT "FK_moderation_incidents_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operations" DROP CONSTRAINT "FK_5bd6df80755a7e7256bc7138719"`);
        await queryRunner.query(`ALTER TABLE "operations" ADD CONSTRAINT "FK_operations_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_98f00985a13412ab11f4d1c1000"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_tickets_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "webhooks" DROP CONSTRAINT "FK_dbecd97048eef1ff16f24a01313"`);
        await queryRunner.query(`ALTER TABLE "webhooks" ADD CONSTRAINT "FK_webhooks_organizationId" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE "webhooks" DROP CONSTRAINT "FK_webhooks_organizationId"`);
        await queryRunner.query(`ALTER TABLE "webhooks" ADD CONSTRAINT "FK_dbecd97048eef1ff16f24a01313" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_tickets_organizationId"`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_98f00985a13412ab11f4d1c1000" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "operations" DROP CONSTRAINT "FK_operations_organizationId"`);
        await queryRunner.query(`ALTER TABLE "operations" ADD CONSTRAINT "FK_5bd6df80755a7e7256bc7138719" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "moderation_incidents" DROP CONSTRAINT "FK_moderation_incidents_organizationId"`);
        await queryRunner.query(`ALTER TABLE "moderation_incidents" ADD CONSTRAINT "FK_6d23198e36b7f7bd398f57a3dc9" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mirror_actions" DROP CONSTRAINT "FK_mirror_actions_organizationId"`);
        await queryRunner.query(`ALTER TABLE "mirror_actions" ADD CONSTRAINT "FK_81fca3dc1382d9f50ebe2cf7064" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_attendance_confirmations" DROP CONSTRAINT "FK_event_attendance_confirmations_organizationId"`);
        await queryRunner.query(`ALTER TABLE "event_attendance_confirmations" ADD CONSTRAINT "FK_ff407a1b0695f94f9fa291e99dd" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bounties" DROP CONSTRAINT "FK_bounties_organizationId"`);
        await queryRunner.query(`ALTER TABLE "bounties" ADD CONSTRAINT "FK_fc2ce2a4b57fa19e3c59a918d9e" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config" DROP CONSTRAINT "FK_blacklist_sharing_config_organizationId"`);
        await queryRunner.query(`ALTER TABLE "blacklist_sharing_config" ADD CONSTRAINT "FK_47e7f43a0f30af2bb0f57f27438" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "announcements" DROP CONSTRAINT "FK_announcements_organizationId"`);
        await queryRunner.query(`ALTER TABLE "announcements" ADD CONSTRAINT "FK_9f7aad9ecbc4e6f88f1a092c6bb" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organization_analytics_org_period"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organization_templates_isPublic"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organization_templates_category"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ship_loadouts_shipId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_shared_accounts_createdBy"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_legal_holds_isActive"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_external_integrations_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_external_integrations_type"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_bounty_evidence_submittedBy"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ship_maintenance_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ship_maintenance_ownerId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_ship_maintenance_shipId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_logistics_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_fleet_logistics_fleetId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_data_breach_notifications_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_data_breach_notifications_severity"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cargo_manifests_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cargo_manifests_ownerId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_cargo_manifests_shipId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_briefings_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_briefings_creatorId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alliance_diplomacy_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alliance_diplomacy_orgId2"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_alliance_diplomacy_orgId1"`);
        await queryRunner.query(`CREATE INDEX "IDX_activities_organizationId" ON "activities" ("organizationId")`);
        await queryRunner.query(`CREATE INDEX "IDX_cd38ac021bee5187c2576b3ef4" ON "activities" ("activityType", "status")`);
    }
}
exports.Phase3PerformanceIndexesAndCascades1786000000000 = Phase3PerformanceIndexesAndCascades1786000000000;
//# sourceMappingURL=1786000000000-Phase3PerformanceIndexesAndCascades.js.map