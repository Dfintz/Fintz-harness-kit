import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Add `formResponses` (JSONB) and `source` (VARCHAR) columns to org_applications
 * to support the unified adaptive application system.
 *
 * - formResponses: stores structured answers to org-defined application questions
 * - source: records where the application was submitted from (web, discord, api)
 */
export class AddApplicationFormColumns1813300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'org_applications',
      new TableColumn({
        name: 'formResponses',
        type: 'jsonb',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'org_applications',
      new TableColumn({
        name: 'source',
        type: 'varchar',
        length: '10',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('org_applications', 'source');
    await queryRunner.dropColumn('org_applications', 'formResponses');
  }
}
