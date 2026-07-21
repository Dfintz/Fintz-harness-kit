import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Adds internal role bridging and auto team assignment to RSI role mappings.
 *
 * - internalRoleId: FK to roles table, allowing RSI rank → internal Role mapping
 * - autoAssignTeamIds: JSONB array of team IDs for automatic team placement
 *
 * This bridges the gap between RSI sync (external ranks) and the internal
 * role/team system, enabling:
 * - RSI rank changes to update OrganizationMembership.roleId
 * - RSI rank-based automatic team assignment
 * - Discord roles connected to internal roles through RSI mappings
 */
export class AddInternalRoleAndTeamAssignToRsiMapping1806000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add internalRoleId column
    await queryRunner.addColumn(
      'rsi_role_mappings',
      new TableColumn({
        name: 'internalRoleId',
        type: 'uuid',
        isNullable: true,
      })
    );

    // Add autoAssignTeamIds column
    await queryRunner.addColumn(
      'rsi_role_mappings',
      new TableColumn({
        name: 'autoAssignTeamIds',
        type: 'jsonb',
        isNullable: true,
      })
    );

    // Add foreign key to roles table
    await queryRunner.createForeignKey(
      'rsi_role_mappings',
      new TableForeignKey({
        name: 'FK_rsi_role_mappings_internal_role',
        columnNames: ['internalRoleId'],
        referencedTableName: 'roles',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );

    // Add index on internalRoleId for efficient lookup
    await queryRunner.createIndex(
      'rsi_role_mappings',
      new TableIndex({
        name: 'IDX_rsi_role_mappings_internal_role',
        columnNames: ['internalRoleId'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('rsi_role_mappings', 'IDX_rsi_role_mappings_internal_role');
    await queryRunner.dropForeignKey('rsi_role_mappings', 'FK_rsi_role_mappings_internal_role');
    await queryRunner.dropColumn('rsi_role_mappings', 'autoAssignTeamIds');
    await queryRunner.dropColumn('rsi_role_mappings', 'internalRoleId');
  }
}
