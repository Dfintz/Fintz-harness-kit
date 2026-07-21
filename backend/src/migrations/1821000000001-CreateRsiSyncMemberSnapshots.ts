import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateRsiSyncMemberSnapshots1821000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'rsi_sync_member_snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'syncLogId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'rsiHandle',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'displayName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'rank',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'stars',
            type: 'int',
            default: 0,
          },
          {
            name: 'isMain',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isAffiliate',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isHidden',
            type: 'boolean',
            default: false,
          },
          {
            name: 'isRedacted',
            type: 'boolean',
            default: false,
          },
          {
            name: 'avatar',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'enlisted',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            columnNames: ['syncLogId'],
            referencedTableName: 'rsi_sync_audit_log',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['organizationId'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rsi_sync_snapshots_sync_log" ON "rsi_sync_member_snapshots" ("syncLogId")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rsi_sync_snapshots_org_id" ON "rsi_sync_member_snapshots" ("organizationId")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rsi_sync_snapshots_org_handle" ON "rsi_sync_member_snapshots" ("organizationId", "rsiHandle")`
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_rsi_sync_snapshots_sync_handle" ON "rsi_sync_member_snapshots" ("syncLogId", "rsiHandle")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('rsi_sync_member_snapshots', true);
  }
}
