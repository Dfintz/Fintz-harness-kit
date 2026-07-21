import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFleetCrewMode1821000000000 implements MigrationInterface {
  name = 'AddFleetCrewMode1821000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fleets',
      new TableColumn({
        name: 'crewMode',
        type: 'varchar',
        length: '20',
        default: "'conservative'",
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fleets', 'crewMode');
  }
}
