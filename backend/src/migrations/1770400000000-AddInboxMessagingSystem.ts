import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Add messaging system enhancements to contact requests
 *
 * Changes:
 * - Add senderUserId column to contact_requests (links sender to authenticated user)
 * - Make senderEmail nullable (not required when user is authenticated)
 * - Create contact_request_replies table for conversation threads
 */
export class AddInboxMessagingSystem1770400000000 implements MigrationInterface {
  name = 'AddInboxMessagingSystem1770400000000';

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
    const senderUserIdColumn = await this.resolveColumnName(
      queryRunner,
      'contact_requests',
      'senderUserId'
    );
    const repliesTableExists = await queryRunner.hasTable('contact_request_replies');

    // Complete schema already includes the inbox messaging shape.
    if (senderUserIdColumn && repliesTableExists) {
      return;
    }

    // 1. Add senderUserId column to contact_requests
    await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            ADD COLUMN "senderUserId" varchar NULL
        `);

    // 2. Create index on senderUserId
    await queryRunner.createIndex(
      'contact_requests',
      new TableIndex({
        name: 'IDX_contact_requests_senderUserId',
        columnNames: ['senderUserId'],
      })
    );

    // 3. Add foreign key for senderUserId → users.id
    await queryRunner.createForeignKey(
      'contact_requests',
      new TableForeignKey({
        name: 'FK_contact_requests_senderUserId',
        columnNames: ['senderUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );

    // 4. Make senderEmail nullable (authenticated users don't need it)
    await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            ALTER COLUMN "senderEmail" DROP NOT NULL
        `);

    // 5. Create contact_request_replies table
    await queryRunner.createTable(
      new Table({
        name: 'contact_request_replies',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'contactRequestId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'senderUserId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'message',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'isOrgReply',
            type: 'boolean',
            default: false,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // 6. Create indexes for contact_request_replies
    await queryRunner.createIndex(
      'contact_request_replies',
      new TableIndex({
        name: 'IDX_contact_request_replies_contactRequestId',
        columnNames: ['contactRequestId'],
      })
    );

    await queryRunner.createIndex(
      'contact_request_replies',
      new TableIndex({
        name: 'IDX_contact_request_replies_senderUserId',
        columnNames: ['senderUserId'],
      })
    );

    await queryRunner.createIndex(
      'contact_request_replies',
      new TableIndex({
        name: 'IDX_contact_request_replies_contactRequestId_createdAt',
        columnNames: ['contactRequestId', 'createdAt'],
      })
    );

    // 7. Add foreign keys for contact_request_replies
    await queryRunner.createForeignKey(
      'contact_request_replies',
      new TableForeignKey({
        name: 'FK_contact_request_replies_contactRequestId',
        columnNames: ['contactRequestId'],
        referencedTableName: 'contact_requests',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      })
    );

    await queryRunner.createForeignKey(
      'contact_request_replies',
      new TableForeignKey({
        name: 'FK_contact_request_replies_senderUserId',
        columnNames: ['senderUserId'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop contact_request_replies table (cascades foreign keys)
    await queryRunner.dropTable('contact_request_replies', true, true);

    // Remove foreign key and index from contact_requests.senderUserId
    await queryRunner.dropForeignKey('contact_requests', 'FK_contact_requests_senderUserId');
    await queryRunner.dropIndex('contact_requests', 'IDX_contact_requests_senderUserId');

    // Drop senderUserId column
    await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            DROP COLUMN "senderUserId"
        `);

    // Re-add NOT NULL to senderEmail
    await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            ALTER COLUMN "senderEmail" SET NOT NULL
        `);
  }
}
