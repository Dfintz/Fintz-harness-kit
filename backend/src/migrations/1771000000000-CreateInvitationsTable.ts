import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Create invitations table for the push-based invitation workflow.
 */
export class CreateInvitationsTable1771000000000 implements MigrationInterface {
  private async resolveColumnName(
    queryRunner: QueryRunner,
    tableName: string,
    preferredName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`,
      [tableName, preferredName]
    );

    return rows[0]?.column_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('invitations');
    if (tableExists) {
      const organizationIdColumn = await this.resolveColumnName(
        queryRunner,
        'invitations',
        'organizationId'
      );
      const inviteeUserIdColumn = await this.resolveColumnName(
        queryRunner,
        'invitations',
        'inviteeUserId'
      );

      if (organizationIdColumn && inviteeUserIdColumn) {
        return;
      }
    }

    // Create enum type (idempotent)
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE invitation_status_enum AS ENUM ('pending','approved','accepted','rejected','declined','expired');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);

    await queryRunner.createTable(
      new Table({
        name: 'invitations',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
          { name: 'organizationId', type: 'varchar', length: '255', isNullable: false },
          { name: 'inviteeUserId', type: 'varchar', length: '255', isNullable: false },
          { name: 'inviterId', type: 'varchar', length: '255', isNullable: true },
          { name: 'inviterRole', type: 'varchar', length: '20', isNullable: false },
          {
            name: 'status',
            type: 'invitation_status_enum',
            default: `'pending'`,
          },
          { name: 'message', type: 'text', isNullable: true },
          { name: 'token', type: 'varchar', length: '255', isNullable: false },
          { name: 'expiresAt', type: 'timestamp', isNullable: false },
          { name: 'createdAt', type: 'timestamp', default: 'NOW()' },
        ],
      }),
      true
    );

    // Indexes
    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'IDX_invitations_organizationId',
        columnNames: ['organizationId'],
      })
    );
    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'IDX_invitations_inviteeUserId',
        columnNames: ['inviteeUserId'],
      })
    );
    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'IDX_invitations_status',
        columnNames: ['status'],
      })
    );
    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'IDX_invitations_org_status',
        columnNames: ['organizationId', 'status'],
      })
    );
    await queryRunner.createIndex(
      'invitations',
      new TableIndex({
        name: 'IDX_invitations_token',
        columnNames: ['token'],
        isUnique: true,
      })
    );

    // Foreign keys
    await queryRunner.createForeignKey(
      'invitations',
      new TableForeignKey({
        name: 'FK_invitations_organization',
        columnNames: ['organizationId'],
        referencedTableName: 'organizations',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
    await queryRunner.createForeignKey(
      'invitations',
      new TableForeignKey({
        name: 'FK_invitations_invitee',
        columnNames: ['inviteeUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );
    await queryRunner.createForeignKey(
      'invitations',
      new TableForeignKey({
        name: 'FK_invitations_inviter',
        columnNames: ['inviterId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('invitations', true);
    await queryRunner.query(`DROP TYPE IF EXISTS invitation_status_enum`);
  }
}
