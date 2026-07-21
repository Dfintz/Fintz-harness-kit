import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddDescriptionToUserShips1840000000000 implements MigrationInterface {
  name = 'AddDescriptionToUserShips1840000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'user_ships',
      new TableColumn({
        name: 'description',
        type: 'text',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user_ships', 'description');
  }
}
