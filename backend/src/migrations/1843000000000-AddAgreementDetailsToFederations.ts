import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddAgreementDetailsToFederations1843000000000 implements MigrationInterface {
  name = 'AddAgreementDetailsToFederations1843000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('federations', [
      new TableColumn({
        name: 'reviewDate',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'expiryDate',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'autoRenew',
        type: 'boolean',
        default: false,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('federations', 'autoRenew');
    await queryRunner.dropColumn('federations', 'expiryDate');
    await queryRunner.dropColumn('federations', 'reviewDate');
  }
}
