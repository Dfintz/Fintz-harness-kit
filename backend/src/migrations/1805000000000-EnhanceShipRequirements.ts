import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Enhance ship requirements for Activities and Job Listings
 *
 * Activities:
 * - Add shipRequirementType column ('none'|'required'|'preferred')
 * - Add requiredShips JSONB column (structured ShipRequirement[] with quantity)
 *
 * PublicJobListings:
 * - Migrate requiredShips data from string[] → ShipRequirement[] format
 *
 * Both changes are backward-compatible:
 * - New columns are nullable with sensible defaults
 * - Existing string[] data is migrated to { requirementType, shipName, count, crewPerShip }
 */
export class EnhanceShipRequirements1805000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── Activities: add new columns ──

    // Check if shipRequirementType already exists (DB_SYNCHRONIZE may have created it)
    const activityTable = await queryRunner.getTable('activities');
    const hasShipReqType = activityTable?.columns.some(c => c.name === 'shipRequirementType');
    const hasRequiredShips = activityTable?.columns.some(c => c.name === 'requiredShips');

    if (!hasShipReqType) {
      await queryRunner.addColumn(
        'activities',
        new TableColumn({
          name: 'shipRequirementType',
          type: 'varchar',
          length: '20',
          isNullable: true,
          default: "'none'",
        })
      );
    }

    if (!hasRequiredShips) {
      await queryRunner.addColumn(
        'activities',
        new TableColumn({
          name: 'requiredShips',
          type: 'jsonb',
          isNullable: true,
        })
      );
    }

    // ── PublicJobListings: migrate existing string[] data to ShipRequirement[] ──
    // Only migrate if there is existing data in the old string[] format
    await queryRunner.query(`
      UPDATE public_job_listings
      SET "requiredShips" = (
        SELECT jsonb_agg(
          jsonb_build_object(
            'requirementType', 'specific',
            'shipName', elem::text,
            'count', 1,
            'crewPerShip', 1
          )
        )
        FROM jsonb_array_elements_text("requiredShips") AS elem
      )
      WHERE "requiredShips" IS NOT NULL
        AND jsonb_typeof("requiredShips") = 'array'
        AND jsonb_array_length("requiredShips") > 0
        AND jsonb_typeof("requiredShips"->0) = 'string'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // ── Revert PublicJobListings data back to string[] ──
    await queryRunner.query(`
      UPDATE public_job_listings
      SET "requiredShips" = (
        SELECT jsonb_agg(elem->>'shipName')
        FROM jsonb_array_elements("requiredShips") AS elem
      )
      WHERE "requiredShips" IS NOT NULL
        AND jsonb_typeof("requiredShips") = 'array'
        AND jsonb_array_length("requiredShips") > 0
        AND jsonb_typeof("requiredShips"->0) = 'object'
    `);

    // ── Activities: drop new columns ──
    const activityTable = await queryRunner.getTable('activities');

    if (activityTable?.columns.some(c => c.name === 'requiredShips')) {
      await queryRunner.dropColumn('activities', 'requiredShips');
    }

    if (activityTable?.columns.some(c => c.name === 'shipRequirementType')) {
      await queryRunner.dropColumn('activities', 'shipRequirementType');
    }
  }
}
