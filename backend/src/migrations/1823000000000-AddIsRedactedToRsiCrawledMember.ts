import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddIsRedactedToRsiCrawledMember1823000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'rsi_crawled_members',
      new TableColumn({
        name: 'isRedacted',
        type: 'boolean',
        default: false,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('rsi_crawled_members', 'isRedacted');
  }
}
