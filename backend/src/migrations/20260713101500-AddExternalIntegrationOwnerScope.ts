import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddExternalIntegrationOwnerScope20260713101500 implements MigrationInterface {
  name = 'AddExternalIntegrationOwnerScope20260713101500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasOwnerType = await queryRunner.hasColumn('external_integrations', 'ownerType');
    if (!hasOwnerType) {
      await queryRunner.addColumn(
        'external_integrations',
        new TableColumn({
          name: 'ownerType',
          type: 'varchar',
          isNullable: true,
        })
      );
    }

    const hasOwnerId = await queryRunner.hasColumn('external_integrations', 'ownerId');
    if (!hasOwnerId) {
      await queryRunner.addColumn(
        'external_integrations',
        new TableColumn({
          name: 'ownerId',
          type: 'varchar',
          isNullable: true,
        })
      );
    }

    await queryRunner.query(`
      UPDATE external_integrations
      SET "ownerType" = 'fleet', "ownerId" = "fleetId"
      WHERE "ownerType" IS NULL OR "ownerId" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasOwnerId = await queryRunner.hasColumn('external_integrations', 'ownerId');
    if (hasOwnerId) {
      await queryRunner.dropColumn('external_integrations', 'ownerId');
    }

    const hasOwnerType = await queryRunner.hasColumn('external_integrations', 'ownerType');
    if (hasOwnerType) {
      await queryRunner.dropColumn('external_integrations', 'ownerType');
    }
  }
}
