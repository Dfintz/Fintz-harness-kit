import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFormResponsesToJobApplications1839000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'job_applications',
      new TableColumn({
        name: 'formResponses',
        type: 'jsonb',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('job_applications', 'formResponses');
  }
}
