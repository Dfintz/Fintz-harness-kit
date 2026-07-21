import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates the price_alerts table for the trading price monitoring feature.
 * Entity: PriceAlert (backend/src/models/PriceAlert.ts)
 */
export class CreatePriceAlertsTable1855000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('price_alerts');
    if (tableExists) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'price_alerts',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            length: '64',
            isPrimary: true,
          },
          {
            name: 'userId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'commodity',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'location',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'condition',
            type: 'varchar',
            length: '32',
          },
          {
            name: 'threshold',
            type: 'float',
          },
          {
            name: 'enabled',
            type: 'boolean',
            default: true,
          },
          {
            name: 'lastTriggered',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    await queryRunner.createIndex(
      'price_alerts',
      new TableIndex({ name: 'IDX_price_alerts_userId', columnNames: ['userId'] })
    );

    await queryRunner.createIndex(
      'price_alerts',
      new TableIndex({ name: 'IDX_price_alerts_commodity', columnNames: ['commodity'] })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('price_alerts', 'IDX_price_alerts_commodity');
    await queryRunner.dropIndex('price_alerts', 'IDX_price_alerts_userId');
    await queryRunner.dropTable('price_alerts', true);
  }
}
