import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateRsiChangeHistory1811000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'rsi_change_history',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'entityType',
            type: 'varchar',
            length: '20',
          },
          {
            name: 'entityId',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'fieldName',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'oldValue',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'newValue',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'detectedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true
    );

    // Use raw SQL with IF NOT EXISTS to make migration idempotent
    // (handles partial prior runs where indexes were created but migration wasn't recorded)
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rsi_change_history_entity" ON "rsi_change_history" ("entityType", "entityId")`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rsi_change_history_entity_field" ON "rsi_change_history" ("entityType", "entityId", "fieldName")`
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rsi_change_history_detected_at" ON "rsi_change_history" ("detectedAt")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('rsi_change_history');
  }
}
