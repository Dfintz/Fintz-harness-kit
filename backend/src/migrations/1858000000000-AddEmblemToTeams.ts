import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEmblemToTeams1858000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasEmblem = await queryRunner.hasColumn('teams', 'emblem');
    if (!hasEmblem) {
      await queryRunner.addColumn(
        'teams',
        new TableColumn({
          name: 'emblem',
          type: 'text',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasEmblem = await queryRunner.hasColumn('teams', 'emblem');
    if (hasEmblem) {
      await queryRunner.dropColumn('teams', 'emblem');
    }
  }
}
