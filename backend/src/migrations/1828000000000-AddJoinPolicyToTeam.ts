import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddJoinPolicyToTeam1828000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'teams',
      new TableColumn({
        name: 'joinPolicy',
        type: 'varchar',
        length: '10',
        default: "'closed'",
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('teams', 'joinPolicy');
  }
}
