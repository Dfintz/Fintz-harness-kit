import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddApprovedVehiclesToJobListing1824000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'public_job_listings',
      new TableColumn({
        name: 'approvedVehicles',
        type: 'jsonb',
        isNullable: true,
        default: "'[]'",
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('public_job_listings', 'approvedVehicles');
  }
}
