import { MigrationInterface, QueryRunner } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration: Make UserShips User-Owned (Independent of Organizations)
 *
 * Changes:
 * 1. Removes organizationId foreign key constraint from user_ships
 * 2. Makes organizationId nullable (for backward compatibility during transition)
 * 3. Adds deletedAt column for soft delete support
 * 4. Drops organization-related indexes
 * 5. Creates new user-focused indexes
 *
 * Rationale:
 * - Ships belong to users, not organizations
 * - Organizations view their members' ships through member relationships
 * - OrganizationShip table remains for org-owned ships
 *
 * Migration Strategy:
 * - Phase 1 (this migration): Make organizationId nullable, add indexes
 * - Phase 2 (future): Application code stops writing organizationId
 * - Phase 3 (future): Drop organizationId column entirely
 */
export class MakeUserShipsUserOwned1734042000000 implements MigrationInterface {
  name = 'MakeUserShipsUserOwned1734042000000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    preferredName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [tableName, preferredName]
    );

    return rows[0]?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableName = 'user_ships';
    const resolveOrDefault = async (preferredName: string): Promise<string> =>
      (await this.resolveColumnName(queryRunner, tableName, preferredName)) ?? preferredName;

    // If organizationId column doesn't exist (case-insensitive), skip org-specific mutation.
    const organizationIdColumn = await this.resolveColumnName(
      queryRunner,
      tableName,
      'organizationId'
    );
    const hasOrganizationId = organizationIdColumn !== null;

    const deletedAtColumn = await resolveOrDefault('deletedAt');
    const visibleToOrganizationColumn = await resolveOrDefault('visibleToOrganization');
    const classificationChangedByColumn = await resolveOrDefault('classificationChangedBy');
    const classificationChangedAtColumn = await resolveOrDefault('classificationChangedAt');
    const classificationReasonColumn = await resolveOrDefault('classificationReason');

    // Add deletedAt column for soft delete support (if it doesn't exist)
    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(deletedAtColumn)} TIMESTAMP DEFAULT NULL
        `);

    // Add classification/visibility control columns (if they don't exist)
    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(visibleToOrganizationColumn)} BOOLEAN DEFAULT true
        `);

    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(classificationChangedByColumn)} VARCHAR(255) DEFAULT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(classificationChangedAtColumn)} TIMESTAMP DEFAULT NULL
        `);

    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD COLUMN IF NOT EXISTS ${this.quoteIdentifier(classificationReasonColumn)} TEXT DEFAULT NULL
        `);

    if (hasOrganizationId) {
      // Drop organization-related indexes (they might not all exist, so we check first)
      const indexQueries = [
        'DROP INDEX IF EXISTS "IDX_user_ships_organizationId_userId"',
        'DROP INDEX IF EXISTS "IDX_user_ships_organizationId_shipId"',
        'DROP INDEX IF EXISTS "IDX_user_ships_organizationId_status"',
      ];

      for (const query of indexQueries) {
        try {
          await queryRunner.query(query);
        } catch (_error) {
          // Index might not exist, continue
          logger.info(`Index drop skipped (might not exist): ${query}`);
        }
      }

      // Drop foreign key constraint if it exists
      try {
        await queryRunner.query(`
                ALTER TABLE "user_ships" 
                DROP CONSTRAINT IF EXISTS "FK_user_ships_organizationId"
            `);
      } catch (_error) {
        logger.info('Foreign key constraint drop skipped (might not exist)');
      }

      // Make organizationId nullable (for transition period) - only if it's currently NOT NULL
      try {
        await queryRunner.query(`
                ALTER TABLE "user_ships" 
                ALTER COLUMN ${this.quoteIdentifier(organizationIdColumn)} DROP NOT NULL
            `);
      } catch (_error) {
        logger.info('organizationId is already nullable');
      }
    } else {
      logger.info(
        'organizationId column not present on user_ships; skipping org-specific mutations'
      );
    }

    const userIdColumn = await resolveOrDefault('userId');
    const shipIdColumn = await resolveOrDefault('shipId');
    const statusColumn = await resolveOrDefault('status');
    const sharingLevelColumn = await resolveOrDefault('sharingLevel');
    const deletedAtColumnForIndex = await resolveOrDefault('deletedAt');

    // Create new user-focused indexes (only if they don't exist)
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_status" 
        ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(statusColumn)}) 
        WHERE ${this.quoteIdentifier(deletedAtColumnForIndex)} IS NULL
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_shipId" 
        ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(shipIdColumn)}) 
        WHERE ${this.quoteIdentifier(deletedAtColumnForIndex)} IS NULL
        `);

    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_user_ships_userId_sharingLevel" 
        ON "user_ships" (${this.quoteIdentifier(userIdColumn)}, ${this.quoteIdentifier(sharingLevelColumn)}) 
        WHERE ${this.quoteIdentifier(deletedAtColumnForIndex)} IS NULL
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop new indexes
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_shipId"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_user_ships_userId_sharingLevel"');

    // Restore organizationId as NOT NULL (this will fail if there are null values)
    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ALTER COLUMN "organizationId" SET NOT NULL
        `);

    // Recreate foreign key constraint
    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            ADD CONSTRAINT "FK_user_ships_organizationId" 
            FOREIGN KEY ("organizationId") 
            REFERENCES "organizations"("id") 
            ON DELETE CASCADE
        `);

    // Recreate organization-related indexes
    await queryRunner.query(`
            CREATE INDEX "IDX_user_ships_organizationId_userId" 
            ON "user_ships" ("organizationId", "userId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_user_ships_organizationId_shipId" 
            ON "user_ships" ("organizationId", "shipId")
        `);

    await queryRunner.query(`
            CREATE INDEX "IDX_user_ships_organizationId_status" 
            ON "user_ships" ("organizationId", "status")
        `);

    // Remove classification columns
    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            DROP COLUMN "classificationReason",
            DROP COLUMN "classificationChangedAt",
            DROP COLUMN "classificationChangedBy",
            DROP COLUMN "visibleToOrganization"
        `);

    // Remove deletedAt column
    await queryRunner.query(`
            ALTER TABLE "user_ships" 
            DROP COLUMN "deletedAt"
        `);
  }
}
