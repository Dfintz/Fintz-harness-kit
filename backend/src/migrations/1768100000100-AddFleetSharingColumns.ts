import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFleetSharingColumns1768100000100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasVisibility = await queryRunner.hasColumn('fleets', 'visibility');
    const hasAllowedOrganizations = await queryRunner.hasColumn('fleets', 'allowedOrganizations');
    const hasPublicViewEnabled = await queryRunner.hasColumn('fleets', 'publicViewEnabled');
    const hasAllowJoinRequests = await queryRunner.hasColumn('fleets', 'allowJoinRequests');

    const columnsToAdd: TableColumn[] = [];

    if (!hasVisibility) {
      columnsToAdd.push(
        new TableColumn({
          name: 'visibility',
          type: 'varchar',
          isNullable: false,
          default: "'private'",
        })
      );
    }

    if (!hasAllowedOrganizations) {
      columnsToAdd.push(
        new TableColumn({
          name: 'allowedOrganizations',
          type: 'text',
          isNullable: false,
          default: "''",
        })
      );
    }

    if (!hasPublicViewEnabled) {
      columnsToAdd.push(
        new TableColumn({
          name: 'publicViewEnabled',
          type: 'boolean',
          isNullable: false,
          default: false,
        })
      );
    }

    if (!hasAllowJoinRequests) {
      columnsToAdd.push(
        new TableColumn({
          name: 'allowJoinRequests',
          type: 'boolean',
          isNullable: false,
          default: false,
        })
      );
    }

    if (columnsToAdd.length > 0) {
      await queryRunner.addColumns('fleets', columnsToAdd);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('fleets', 'allowJoinRequests')) {
      await queryRunner.dropColumn('fleets', 'allowJoinRequests');
    }
    if (await queryRunner.hasColumn('fleets', 'publicViewEnabled')) {
      await queryRunner.dropColumn('fleets', 'publicViewEnabled');
    }
    if (await queryRunner.hasColumn('fleets', 'allowedOrganizations')) {
      await queryRunner.dropColumn('fleets', 'allowedOrganizations');
    }
    if (await queryRunner.hasColumn('fleets', 'visibility')) {
      await queryRunner.dropColumn('fleets', 'visibility');
    }
  }
}
