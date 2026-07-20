"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateContactRequestsTable1763300000000 = void 0;
const logger_1 = require("../utils/logger");
class CreateContactRequestsTable1763300000000 {
    name = 'CreateContactRequestsTable1763300000000';
    async up(queryRunner) {
        const tableExists = await queryRunner.hasTable('contact_requests');
        if (tableExists) {
            logger_1.logger.info('Table contact_requests already exists, skipping creation');
            return;
        }
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "contact_request_status_enum" AS ENUM (
                    'pending', 'read', 'replied', 'archived', 'spam'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            DO $$ BEGIN
                CREATE TYPE "contact_target_type_enum" AS ENUM (
                    'organization', 'alliance'
                );
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        await queryRunner.query(`
            CREATE TABLE "contact_requests" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "targetType" "contact_target_type_enum" NOT NULL DEFAULT 'organization',
                "organizationId" character varying,
                "allianceId" character varying,
                "senderName" character varying(100) NOT NULL,
                "senderEmail" character varying(255) NOT NULL,
                "rsiHandle" character varying(100),
                "discordUsername" character varying(100),
                "subject" character varying(255) NOT NULL,
                "message" text NOT NULL,
                "contactType" character varying(50) NOT NULL DEFAULT 'general',
                "status" "contact_request_status_enum" NOT NULL DEFAULT 'pending',
                "internalNotes" text,
                "handledBy" character varying,
                "handledAt" TIMESTAMP,
                "senderIp" character varying(45),
                "userAgent" character varying(500),
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_contact_requests" PRIMARY KEY ("id")
            )
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_organizationId" 
            ON "contact_requests" ("organizationId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_allianceId" 
            ON "contact_requests" ("allianceId")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_targetType" 
            ON "contact_requests" ("targetType")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_org_status" 
            ON "contact_requests" ("organizationId", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_org_createdAt" 
            ON "contact_requests" ("organizationId", "createdAt")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_alliance_status" 
            ON "contact_requests" ("allianceId", "status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_alliance_createdAt" 
            ON "contact_requests" ("allianceId", "createdAt")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_status" 
            ON "contact_requests" ("status")
        `);
        await queryRunner.query(`
            CREATE INDEX "IDX_contact_requests_senderEmail" 
            ON "contact_requests" ("senderEmail")
        `);
        await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            ADD CONSTRAINT "FK_contact_requests_organization" 
            FOREIGN KEY ("organizationId") 
            REFERENCES "organizations"("id") 
            ON DELETE CASCADE 
            ON UPDATE NO ACTION
        `);
    }
    async down(queryRunner) {
        const tableExists = await queryRunner.hasTable('contact_requests');
        if (!tableExists) {
            logger_1.logger.info('Table contact_requests does not exist, skipping drop');
            return;
        }
        await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            DROP CONSTRAINT IF EXISTS "FK_contact_requests_organization"
        `);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_senderEmail"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_alliance_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_alliance_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_org_createdAt"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_org_status"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_targetType"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_allianceId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_contact_requests_organizationId"`);
        await queryRunner.query(`DROP TABLE "contact_requests"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "contact_target_type_enum"`);
        await queryRunner.query(`DROP TYPE IF EXISTS "contact_request_status_enum"`);
    }
}
exports.CreateContactRequestsTable1763300000000 = CreateContactRequestsTable1763300000000;
//# sourceMappingURL=1763300000000-CreateContactRequestsTable.js.map