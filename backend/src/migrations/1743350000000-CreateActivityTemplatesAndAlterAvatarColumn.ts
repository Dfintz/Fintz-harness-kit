import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Creates the activity_templates table and alters the users.avatar column to text.
 */
export class CreateActivityTemplatesAndAlterAvatarColumn1743350000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alter users.avatar from varchar(255) to text
    const usersTable = await queryRunner.getTable('users');
    if (usersTable) {
      const avatarColumn = usersTable.findColumnByName('avatar');
      if (avatarColumn && avatarColumn.type !== 'text') {
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar" TYPE text`);
      }
    }

    // 2. Create activity_templates table (if not exists)
    const templateTable = await queryRunner.getTable('activity_templates');
    if (!templateTable) {
      await queryRunner.createTable(
        new Table({
          name: 'activity_templates',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'organizationId', type: 'uuid', isNullable: false },
            { name: 'name', type: 'varchar', length: '150', isNullable: false },
            { name: 'description', type: 'text', isNullable: true },
            {
              name: 'activityType',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'category',
              type: 'varchar',
              length: '50',
              default: "'custom'",
              isNullable: false,
            },
            { name: 'templateData', type: 'jsonb', default: "'{}'" },
            { name: 'isPublic', type: 'boolean', default: false },
            { name: 'isActive', type: 'boolean', default: true },
            { name: 'usageCount', type: 'integer', default: 0 },
            { name: 'tags', type: 'text', isNullable: true },
            { name: 'createdBy', type: 'uuid', isNullable: false },
            { name: 'createdByName', type: 'varchar', length: '255', isNullable: true },
            { name: 'sharedWithOrgs', type: 'text', isNullable: true, default: "''" },
            { name: 'deletedAt', type: 'timestamp', isNullable: true },
            { name: 'deletedBy', type: 'varchar', length: '255', isNullable: true },
            { name: 'createdAt', type: 'timestamp', default: 'now()' },
            { name: 'updatedAt', type: 'timestamp', default: 'now()' },
          ],
          foreignKeys: [
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

      await queryRunner.createIndices('activity_templates', [
        new TableIndex({
          name: 'IDX_activity_templates_org_category',
          columnNames: ['organizationId', 'category'],
        }),
        new TableIndex({
          name: 'IDX_activity_templates_org_createdBy',
          columnNames: ['organizationId', 'createdBy'],
        }),
        new TableIndex({
          name: 'IDX_activity_templates_public_active',
          columnNames: ['isPublic', 'isActive'],
        }),
      ]);
    }

    // 3. Add sharedWithOrgs column if missing (TenantEntity requirement)
    const existingTable = await queryRunner.getTable('activity_templates');
    if (existingTable && !existingTable.findColumnByName('sharedWithOrgs')) {
      await queryRunner.query(
        `ALTER TABLE "activity_templates" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('activity_templates', true);
    // Revert avatar column (optional — text is backward compatible)
    const usersTable = await queryRunner.getTable('users');
    if (usersTable) {
      await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "avatar" TYPE varchar(255)`);
    }
  }
}
