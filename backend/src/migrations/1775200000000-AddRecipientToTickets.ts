import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddRecipientToTickets1775200000000 implements MigrationInterface {
  name = 'AddRecipientToTickets1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'tickets',
      new TableColumn({
        name: 'recipientId',
        type: 'varchar',
        isNullable: true,
      })
    );

    await queryRunner.addColumn(
      'tickets',
      new TableColumn({
        name: 'recipientName',
        type: 'varchar',
        isNullable: true,
      })
    );

    await queryRunner.createIndex(
      'tickets',
      new TableIndex({
        name: 'IDX_tickets_recipientId',
        columnNames: ['recipientId'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('tickets', 'IDX_tickets_recipientId');
    await queryRunner.dropColumn('tickets', 'recipientName');
    await queryRunner.dropColumn('tickets', 'recipientId');
  }
}
