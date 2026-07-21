import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add a case-insensitive unique index on organization names
 *
 * Prevents TOCTOU races in the service-layer uniqueness check by enforcing
 * uniqueness at the database level via a functional index on LOWER(name).
 * The service layer still provides a friendly error message; the DB constraint
 * is a hard safety net.
 *
 * Pre-condition: This migration assumes no duplicate organization names
 * (case-insensitively) already exist in the database. The service-layer check
 * added in e2f1392 should have prevented any from being created.
 * If duplicates do exist, the migration will fail; resolve them manually before
 * re-running. Query to identify duplicates:
 *   SELECT LOWER(name), COUNT(*) FROM organizations GROUP BY LOWER(name) HAVING COUNT(*) > 1;
 */
export class AddOrganizationNameUniqueIndex1813200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_organizations_name_lower" ON "organizations" (LOWER("name"))`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_organizations_name_lower"`);
  }
}
