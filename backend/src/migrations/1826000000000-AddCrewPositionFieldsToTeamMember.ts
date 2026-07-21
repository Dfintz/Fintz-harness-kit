import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCrewPositionFieldsToTeamMember1826000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'team_members',
      new TableColumn({
        name: 'assigned_ship_id',
        type: 'uuid',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'team_members',
      new TableColumn({
        name: 'crew_role',
        type: 'varchar',
        length: '50',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('team_members', 'crew_role');
    await queryRunner.dropColumn('team_members', 'assigned_ship_id');
  }
}
