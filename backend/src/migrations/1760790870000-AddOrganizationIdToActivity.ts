import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

import { logger } from '../utils/logger';

/**
 * Migration to add multi-tenancy support to Activity entity
 *
 * This migration:
 * 1. Adds organizationId column to activities table (already exists but may be nullable)
 * 2. Adds sharedWithOrgs column for cross-tenant sharing
 * 3. Migrates existing data based on creator's active organization
 * 4. Makes organizationId non-nullable
 * 5. Adds foreign key constraint
 * 6. Adds performance indexes for tenant-scoped queries
 *
 * IMPORTANT: Run this migration during low-traffic period
 * Estimated time: Depends on number of activities (expect ~1 second per 1000 records)
 */
export class AddOrganizationIdToActivity1760790870000 implements MigrationInterface {
  name = 'AddOrganizationIdToActivity1760790870000';

  private quoteIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

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

  private async resolveColumnType(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string
  ): Promise<string | null> {
    const rows = await queryRunner.query(
      `SELECT udt_name
             FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = $1
               AND column_name = $2
             LIMIT 1`,
      [tableName, columnName]
    );

    return rows[0]?.udt_name ?? null;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    logger.info('==================================================');
    logger.info('Starting migration: Add Multi-Tenancy to Activity');
    logger.info('==================================================');

    // Step 1: Check if activities table exists
    logger.info('\nStep 1: Checking existing schema...');
    const table = await queryRunner.getTable('activities');

    if (!table) {
      logger.warn('activities table does not exist, skipping migration');
      logger.info('   (Table will be created by TypeORM synchronize or future migration)');
      logger.info('==================================================');
      return;
    }

    const orgIdColumn = await this.resolveColumnName(queryRunner, 'activities', 'organizationId');

    if (!orgIdColumn) {
      // Add organizationId column if it doesn't exist (nullable initially)
      logger.info('  Adding organizationId column...');
      await queryRunner.addColumn(
        'activities',
        new TableColumn({
          name: 'organizationId',
          type: 'varchar',
          isNullable: true,
        })
      );
    } else {
      logger.info('  organizationId column already exists');
    }

    // Step 2: Add sharedWithOrgs column for cross-tenant sharing
    logger.info('\nStep 2: Adding sharedWithOrgs column...');
    const sharedColumn = await this.resolveColumnName(queryRunner, 'activities', 'sharedWithOrgs');

    if (!sharedColumn) {
      await queryRunner.addColumn(
        'activities',
        new TableColumn({
          name: 'sharedWithOrgs',
          type: 'text',
          isNullable: true,
          default: "''",
        })
      );
      logger.info('  sharedWithOrgs column added');
    } else {
      logger.info('  sharedWithOrgs column already exists');
    }

    // Step 3: Migrate existing data
    logger.info('\nStep 3: Migrating existing data...');

    const activitiesOrganizationIdColumn =
      (await this.resolveColumnName(queryRunner, 'activities', 'organizationId')) ??
      'organizationId';
    const activitiesCreatorIdColumn =
      (await this.resolveColumnName(queryRunner, 'activities', 'creatorId')) ?? 'creatorId';
    const usersActiveOrgIdColumn =
      (await this.resolveColumnName(queryRunner, 'users', 'activeOrgId')) ?? 'activeOrgId';
    const activitiesOrganizationIdType =
      (await this.resolveColumnType(queryRunner, 'activities', activitiesOrganizationIdColumn)) ??
      'varchar';
    const organizationsIdType =
      (await this.resolveColumnType(queryRunner, 'organizations', 'id')) ?? 'uuid';
    const activeOrganizationTextExpression = `NULLIF(u.${this.quoteIdentifier(usersActiveOrgIdColumn)}::text, '')`;
    const setOrganizationExpression =
      activitiesOrganizationIdType === 'uuid'
        ? `${activeOrganizationTextExpression}::uuid`
        : activeOrganizationTextExpression;
    const activeOrganizationPredicate =
      activitiesOrganizationIdType === 'uuid'
        ? `${activeOrganizationTextExpression} IS NOT NULL AND ${activeOrganizationTextExpression} ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`
        : `${activeOrganizationTextExpression} IS NOT NULL`;
    const missingOrganizationPredicateForAlias =
      activitiesOrganizationIdType === 'uuid'
        ? `a.${this.quoteIdentifier(activitiesOrganizationIdColumn)} IS NULL`
        : `(
                    a.${this.quoteIdentifier(activitiesOrganizationIdColumn)} IS NULL
                    OR a.${this.quoteIdentifier(activitiesOrganizationIdColumn)} = ''
                )`;
    const missingOrganizationPredicate =
      activitiesOrganizationIdType === 'uuid'
        ? `${this.quoteIdentifier(activitiesOrganizationIdColumn)} IS NULL`
        : `(
                    ${this.quoteIdentifier(activitiesOrganizationIdColumn)} IS NULL
                    OR ${this.quoteIdentifier(activitiesOrganizationIdColumn)} = ''
                )`;

    // Update activities where creator has an active org
    const result = await queryRunner.query(`
            UPDATE activities a
            SET ${this.quoteIdentifier(activitiesOrganizationIdColumn)} = ${setOrganizationExpression}
            FROM users u
            WHERE a.${this.quoteIdentifier(activitiesCreatorIdColumn)}::text = u.id::text
            AND ${activeOrganizationPredicate}
            AND ${missingOrganizationPredicateForAlias}
        `);
    logger.info(`  Updated ${result[1]} activities with creator's active org`);

    // Step 4: Handle activities without a clear organization
    logger.info('\nStep 4: Handling activities without organization...');

    // Find activities still without organizationId
    const orphanedActivities = await queryRunner.query(`
            SELECT a.id, a.${this.quoteIdentifier(activitiesCreatorIdColumn)} AS "creatorId"
            FROM activities a
            WHERE ${missingOrganizationPredicateForAlias}
        `);

    if (orphanedActivities.length > 0) {
      logger.info(`  Found ${orphanedActivities.length} orphaned activities`);

      const hasUserOrganizationsTable = await queryRunner.hasTable('user_organizations');
      const hasOrganizationMembershipsTable = await queryRunner.hasTable(
        'organization_memberships'
      );
      const userOrganizationsUserIdColumn = hasUserOrganizationsTable
        ? await this.resolveColumnName(queryRunner, 'user_organizations', 'userId')
        : null;
      const userOrganizationsOrganizationIdColumn = hasUserOrganizationsTable
        ? await this.resolveColumnName(queryRunner, 'user_organizations', 'organizationId')
        : null;
      const userOrganizationsJoinedAtColumn = hasUserOrganizationsTable
        ? await this.resolveColumnName(queryRunner, 'user_organizations', 'joinedAt')
        : null;
      const orgMembershipUserIdColumn = hasOrganizationMembershipsTable
        ? await this.resolveColumnName(queryRunner, 'organization_memberships', 'userId')
        : null;
      const orgMembershipOrganizationIdColumn = hasOrganizationMembershipsTable
        ? await this.resolveColumnName(queryRunner, 'organization_memberships', 'organizationId')
        : null;
      const orgMembershipJoinedAtColumn = hasOrganizationMembershipsTable
        ? await this.resolveColumnName(queryRunner, 'organization_memberships', 'joinedAt')
        : null;

      // For each orphaned activity, try to find user's first organization
      for (const activity of orphanedActivities) {
        let userOrg: Array<{ organizationId: string }> = [];

        if (
          hasUserOrganizationsTable &&
          userOrganizationsUserIdColumn &&
          userOrganizationsOrganizationIdColumn &&
          userOrganizationsJoinedAtColumn
        ) {
          userOrg = await queryRunner.query(
            `
                        SELECT ${this.quoteIdentifier(userOrganizationsOrganizationIdColumn)} AS "organizationId"
                        FROM user_organizations
                        WHERE ${this.quoteIdentifier(userOrganizationsUserIdColumn)} = $1
                        ORDER BY ${this.quoteIdentifier(userOrganizationsJoinedAtColumn)} ASC
                        LIMIT 1
                    `,
            [activity.creatorId]
          );
        } else if (
          hasOrganizationMembershipsTable &&
          orgMembershipUserIdColumn &&
          orgMembershipOrganizationIdColumn &&
          orgMembershipJoinedAtColumn
        ) {
          userOrg = await queryRunner.query(
            `
                        SELECT ${this.quoteIdentifier(orgMembershipOrganizationIdColumn)} AS "organizationId"
                        FROM organization_memberships
                        WHERE ${this.quoteIdentifier(orgMembershipUserIdColumn)} = $1
                        ORDER BY ${this.quoteIdentifier(orgMembershipJoinedAtColumn)} ASC
                        LIMIT 1
                    `,
            [activity.creatorId]
          );
        }

        if (userOrg.length > 0) {
          await queryRunner.query(
            `
                        UPDATE activities
                        SET ${this.quoteIdentifier(activitiesOrganizationIdColumn)} = $1
                        WHERE id = $2
                    `,
            [userOrg[0].organizationId, activity.id]
          );
        }
      }
    } else {
      logger.info('  No orphaned activities found');
    }

    // Step 5: Create a default organization for any remaining null values
    logger.info('\nStep 5: Creating default organization for remaining activities...');

    // Check if default org exists
    const defaultOrganizationId =
      organizationsIdType === 'uuid' ? '00000000-0000-0000-0000-000000000000' : 'default-org';
    const defaultOrg = await queryRunner.query(`SELECT id FROM organizations WHERE id = $1`, [
      defaultOrganizationId,
    ]);

    if (defaultOrg.length === 0) {
      // Create default organization
      await queryRunner.query(
        `
                INSERT INTO organizations (id, name, members, description, type, status, level, path)
                VALUES (
                    $1,
                    'Default Organization',
                    '{}',
                    'Default organization for migrated data without clear ownership',
                    'root',
                    'active',
                    0,
                    $2
                )
            `,
        [defaultOrganizationId, defaultOrganizationId]
      );
      logger.info('  Created default organization');
    }

    // Assign remaining activities to default org
    const remainingResult = await queryRunner.query(
      `
            UPDATE activities
            SET ${this.quoteIdentifier(activitiesOrganizationIdColumn)} = $1
            WHERE ${missingOrganizationPredicate}
        `,
      [defaultOrganizationId]
    );
    logger.info(`  Assigned ${remainingResult[1]} activities to default organization`);

    // Step 6: Make organizationId non-nullable
    logger.info('\nStep 6: Making organizationId non-nullable...');
    await queryRunner.query(`
            ALTER TABLE activities
            ALTER COLUMN ${this.quoteIdentifier(activitiesOrganizationIdColumn)} SET NOT NULL
        `);
    logger.info('  organizationId is now required');

    // Step 7: Add foreign key constraint
    logger.info('\nStep 7: Adding foreign key constraint...');

    // Check if FK already exists
    const existingFK = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'activities'
            AND constraint_name = 'FK_activities_organizationId'
        `);

    if (existingFK.length === 0) {
      await queryRunner.createForeignKey(
        'activities',
        new TableForeignKey({
          name: 'FK_activities_organizationId',
          columnNames: [activitiesOrganizationIdColumn],
          referencedTableName: 'organizations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );
      logger.info('  Foreign key constraint added');
    } else {
      logger.info('  Foreign key already exists');
    }

    // Step 8: Add indexes for performance
    logger.info('\nStep 8: Adding performance indexes...');

    // Helper to check if index exists
    const indexExists = async (indexName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'activities'
                AND indexname = $1
            `,
        [indexName]
      );
      return result.length > 0;
    };

    // Index on organizationId alone
    if (!(await indexExists('IDX_activities_organizationId'))) {
      await queryRunner.createIndex(
        'activities',
        new TableIndex({
          name: 'IDX_activities_organizationId',
          columnNames: [activitiesOrganizationIdColumn],
        })
      );
      logger.info('  ✓ Created index: IDX_activities_organizationId');
    }

    const activitiesCreatedAtColumn =
      (await this.resolveColumnName(queryRunner, 'activities', 'createdAt')) ?? 'createdAt';
    const activitiesTypeColumn =
      (await this.resolveColumnName(queryRunner, 'activities', 'activityType')) ?? 'activityType';
    const activitiesStatusColumn =
      (await this.resolveColumnName(queryRunner, 'activities', 'status')) ?? 'status';

    // Composite index for organizationId + createdAt (common query pattern)
    if (!(await indexExists('IDX_activities_org_created'))) {
      await queryRunner.createIndex(
        'activities',
        new TableIndex({
          name: 'IDX_activities_org_created',
          columnNames: [activitiesOrganizationIdColumn, activitiesCreatedAtColumn],
        })
      );
      logger.info('  ✓ Created index: IDX_activities_org_created');
    }

    // Composite index for organizationId + activityType
    if (!(await indexExists('IDX_activities_org_type'))) {
      await queryRunner.createIndex(
        'activities',
        new TableIndex({
          name: 'IDX_activities_org_type',
          columnNames: [activitiesOrganizationIdColumn, activitiesTypeColumn],
        })
      );
      logger.info('  ✓ Created index: IDX_activities_org_type');
    }

    // Composite index for organizationId + status
    if (!(await indexExists('IDX_activities_org_status'))) {
      await queryRunner.createIndex(
        'activities',
        new TableIndex({
          name: 'IDX_activities_org_status',
          columnNames: [activitiesOrganizationIdColumn, activitiesStatusColumn],
        })
      );
      logger.info('  ✓ Created index: IDX_activities_org_status');
    }

    logger.info('\n==================================================');
    logger.info('✅ Migration completed successfully!');
    logger.info('==================================================');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    logger.info('==================================================');
    logger.info('Reverting migration: Add Multi-Tenancy to Activity');
    logger.info('==================================================');

    // Drop indexes
    logger.info('\nDropping indexes...');
    const indexExists = async (indexName: string): Promise<boolean> => {
      const result = await queryRunner.query(
        `
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'activities'
                AND indexname = $1
            `,
        [indexName]
      );
      return result.length > 0;
    };

    if (await indexExists('IDX_activities_org_status')) {
      await queryRunner.dropIndex('activities', 'IDX_activities_org_status');
      logger.info('  ✓ Dropped: IDX_activities_org_status');
    }

    if (await indexExists('IDX_activities_org_type')) {
      await queryRunner.dropIndex('activities', 'IDX_activities_org_type');
      logger.info('  ✓ Dropped: IDX_activities_org_type');
    }

    if (await indexExists('IDX_activities_org_created')) {
      await queryRunner.dropIndex('activities', 'IDX_activities_org_created');
      logger.info('  ✓ Dropped: IDX_activities_org_created');
    }

    if (await indexExists('IDX_activities_organizationId')) {
      await queryRunner.dropIndex('activities', 'IDX_activities_organizationId');
      logger.info('  ✓ Dropped: IDX_activities_organizationId');
    }

    // Drop foreign key
    logger.info('\nDropping foreign key...');
    const existingFK = await queryRunner.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'activities'
            AND constraint_name = 'FK_activities_organizationId'
        `);

    if (existingFK.length > 0) {
      await queryRunner.dropForeignKey('activities', 'FK_activities_organizationId');
      logger.info('  ✓ Foreign key dropped');
    }

    // Drop sharedWithOrgs column
    logger.info('\nDropping sharedWithOrgs column...');
    const table = await queryRunner.getTable('activities');
    const sharedColumn = table?.findColumnByName('sharedWithOrgs');

    if (sharedColumn) {
      await queryRunner.dropColumn('activities', 'sharedWithOrgs');
      logger.info('  ✓ sharedWithOrgs column dropped');
    }

    // Note: We do NOT drop organizationId as it may have existed before this migration
    logger.info(
      '\n⚠️  Note: organizationId column not dropped (may have existed before migration)'
    );

    logger.info('\n==================================================');
    logger.info('✅ Rollback completed successfully!');
    logger.info('==================================================');
  }
}
