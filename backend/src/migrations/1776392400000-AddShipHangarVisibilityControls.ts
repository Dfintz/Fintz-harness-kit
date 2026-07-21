import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add Ship Hangar Visibility Controls
 *
 * Adds comprehensive visibility controls for user and organization ship hangars:
 *
 * UserShips:
 * - Add PUBLIC option to ShipSharingLevel enum
 * - Add useCustomVisibility flag for per-ship override
 * - Change default from PERSONAL to ORGANIZATION
 *
 * OrganizationShips:
 * - Add sharingLevel column (organization, alliance, public)
 * - Add minRequiredRank for rank-based visibility
 * - Add useCustomVisibility flag for per-ship override
 *
 * This enables:
 * - Default org sharing when users join organizations
 * - Granular rank-based access control for org ships
 * - Per-ship visibility overrides in custom mode
 * - Public hangars for recruitment/showcase
 */
export class AddShipHangarVisibilityControls1776392400000 implements MigrationInterface {
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
    const userUseCustomColumn = await this.resolveColumnName(
      queryRunner,
      'user_ships',
      'useCustomVisibility'
    );
    const orgSharingLevelColumn = await this.resolveColumnName(
      queryRunner,
      'organization_ships',
      'sharingLevel'
    );
    const orgMinRequiredRankColumn = await this.resolveColumnName(
      queryRunner,
      'organization_ships',
      'minRequiredRank'
    );
    const orgUseCustomColumn = await this.resolveColumnName(
      queryRunner,
      'organization_ships',
      'useCustomVisibility'
    );

    // Complete schema already contains these visibility controls.
    if (
      userUseCustomColumn &&
      orgSharingLevelColumn &&
      orgMinRequiredRankColumn &&
      orgUseCustomColumn
    ) {
      return;
    }

    // ==================== USER SHIPS ====================

    // Add PUBLIC to ShipSharingLevel enum (requires recreating enum with new value)
    // Note: PostgreSQL requires ALTER TYPE to add enum values
    await queryRunner.query(`
      ALTER TYPE "ship_sharing_level" ADD VALUE IF NOT EXISTS 'public';
    `);

    // Add PRIVATE as alias for PERSONAL (for consistency)
    await queryRunner.query(`
      ALTER TYPE "ship_sharing_level" ADD VALUE IF NOT EXISTS 'private';
    `);

    // Add useCustomVisibility flag to user_ships
    await queryRunner.addColumn(
      'user_ships',
      new TableColumn({
        name: 'useCustomVisibility',
        type: 'boolean',
        default: false,
        isNullable: false,
        comment: 'Use custom per-ship visibility instead of global sharingLevel default',
      })
    );

    // Update default sharingLevel for new ships to ORGANIZATION
    // Note: Existing ships keep their current sharingLevel
    await queryRunner.query(`
      ALTER TABLE user_ships 
      ALTER COLUMN "sharingLevel" SET DEFAULT 'organization';
    `);

    // ==================== ORGANIZATION SHIPS ====================

    // Add sharingLevel column to organization_ships
    await queryRunner.addColumn(
      'organization_ships',
      new TableColumn({
        name: 'sharingLevel',
        type: 'enum',
        enum: ['private', 'personal', 'shared_users', 'organization', 'alliance', 'public'],
        default: "'organization'",
        isNullable: false,
        comment: 'Visibility level for this organization ship',
      })
    );

    // Add index on sharingLevel for efficient queries
    await queryRunner.query(`
      CREATE INDEX "IDX_organization_ships_sharingLevel" 
      ON organization_ships ("sharingLevel");
    `);

    // Add minRequiredRank for rank-based visibility
    await queryRunner.addColumn(
      'organization_ships',
      new TableColumn({
        name: 'minRequiredRank',
        type: 'int',
        isNullable: true,
        comment: 'Minimum member rank required to view/use this ship (null = no restriction)',
      })
    );

    // Add useCustomVisibility flag to organization_ships
    await queryRunner.addColumn(
      'organization_ships',
      new TableColumn({
        name: 'useCustomVisibility',
        type: 'boolean',
        default: false,
        isNullable: false,
        comment: 'Use custom per-ship visibility instead of organization default policy',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove organization_ships columns
    await queryRunner.dropColumn('organization_ships', 'useCustomVisibility');
    await queryRunner.dropColumn('organization_ships', 'minRequiredRank');
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_organization_ships_sharingLevel";`);
    await queryRunner.dropColumn('organization_ships', 'sharingLevel');

    // Remove user_ships columns
    await queryRunner.query(`
      ALTER TABLE user_ships 
      ALTER COLUMN "sharingLevel" SET DEFAULT 'personal';
    `);
    await queryRunner.dropColumn('user_ships', 'useCustomVisibility');

    // Note: Cannot remove enum values in PostgreSQL without recreating the entire enum
    // The 'public' and 'private' values will remain in the enum after rollback
    // This is acceptable as they won't break existing code
  }
}
