import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds missing sharedWithOrgs column to activity_templates table.
 * The TenantEntity base class requires this column but it was omitted
 * from the original table creation migration.
 */
export class AddSharedWithOrgsToActivityTemplates1743370000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('activity_templates');
    if (table && !table.findColumnByName('sharedWithOrgs')) {
      await queryRunner.query(
        `ALTER TABLE "activity_templates" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('activity_templates');
    if (table?.findColumnByName('sharedWithOrgs')) {
      await queryRunner.query(`ALTER TABLE "activity_templates" DROP COLUMN "sharedWithOrgs"`);
    }
  }
}
