import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFederationMemberAssociationType1825000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'federation_members',
      new TableColumn({
        name: 'associationType',
        type: 'varchar',
        length: '20',
        default: "'full_member'",
        isNullable: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('federation_members', 'associationType');
  }
}
