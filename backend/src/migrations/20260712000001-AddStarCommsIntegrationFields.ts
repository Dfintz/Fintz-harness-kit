import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddStarCommsIntegrationFields20260712000001 implements MigrationInterface {
  name = 'AddStarCommsIntegrationFields20260712000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasStarCommsConfig = await queryRunner.hasColumn(
      'external_integrations',
      'starCommsConfig'
    );
    if (!hasStarCommsConfig) {
      await queryRunner.addColumn(
        'external_integrations',
        new TableColumn({
          name: 'starCommsConfig',
          type: 'text',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasStarCommsConfig = await queryRunner.hasColumn(
      'external_integrations',
      'starCommsConfig'
    );
    if (hasStarCommsConfig) {
      await queryRunner.dropColumn('external_integrations', 'starCommsConfig');
    }
  }
}
