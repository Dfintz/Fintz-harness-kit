import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Create the hunter_profiles table.
 *
 * The entity and service have existed since Phase 4, but no migration ever
 * created the table.  In development environments with DB_SYNCHRONIZE=true
 * the table was auto-created; in production (migrations-only) it was missing,
 * causing "Failed to load hunter profile" errors.
 */
export class CreateHunterProfilesTable1853000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Guard: skip if the table already exists (dev environments with synchronize)
    const tableExists = await queryRunner.hasTable('hunter_profiles');
    if (tableExists) {
      return;
    }

    await queryRunner.createTable(
      new Table({
        name: 'hunter_profiles',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'userName',
            type: 'varchar',
            length: '100',
            isNullable: true,
          },
          {
            name: 'organizationId',
            type: 'uuid',
            isNullable: false,
          },
          // Bounty Statistics
          {
            name: 'totalBountiesCompleted',
            type: 'integer',
            default: 0,
          },
          {
            name: 'totalBountiesClaimed',
            type: 'integer',
            default: 0,
          },
          {
            name: 'totalBountiesAbandoned',
            type: 'integer',
            default: 0,
          },
          {
            name: 'totalBountiesRejected',
            type: 'integer',
            default: 0,
          },
          // Reward Statistics
          {
            name: 'totalRewardsEarned',
            type: 'bigint',
            default: 0,
          },
          // Performance Metrics
          {
            name: 'successRate',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: 0,
          },
          {
            name: 'averageCompletionTimeMinutes',
            type: 'integer',
            default: 0,
          },
          // Rank and Reputation
          {
            name: 'rank',
            type: 'varchar',
            length: '50',
            default: "'rookie'",
          },
          {
            name: 'reputationScore',
            type: 'integer',
            default: 0,
          },
          // Specializations
          {
            name: 'killBountiesCompleted',
            type: 'integer',
            default: 0,
          },
          {
            name: 'captureBountiesCompleted',
            type: 'integer',
            default: 0,
          },
          {
            name: 'intelBountiesCompleted',
            type: 'integer',
            default: 0,
          },
          {
            name: 'transportBountiesCompleted',
            type: 'integer',
            default: 0,
          },
          {
            name: 'rescueBountiesCompleted',
            type: 'integer',
            default: 0,
          },
          {
            name: 'customBountiesCompleted',
            type: 'integer',
            default: 0,
          },
          // Activity Tracking
          {
            name: 'lastBountyCompletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'currentStreak',
            type: 'integer',
            default: 0,
          },
          {
            name: 'longestStreak',
            type: 'integer',
            default: 0,
          },
          // Timestamps
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'now()',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'now()',
          },
        ],
      }),
      true
    );

    // Unique composite index: one profile per user per org
    await queryRunner.createIndex(
      'hunter_profiles',
      new TableIndex({
        name: 'IDX_hunter_profiles_userId_organizationId',
        columnNames: ['userId', 'organizationId'],
        isUnique: true,
      })
    );

    // Leaderboard indexes (matching entity @Index decorators)
    await queryRunner.createIndex(
      'hunter_profiles',
      new TableIndex({
        name: 'IDX_hunter_profiles_org_completed',
        columnNames: ['organizationId', 'totalBountiesCompleted'],
      })
    );

    await queryRunner.createIndex(
      'hunter_profiles',
      new TableIndex({
        name: 'IDX_hunter_profiles_org_rewards',
        columnNames: ['organizationId', 'totalRewardsEarned'],
      })
    );

    await queryRunner.createIndex(
      'hunter_profiles',
      new TableIndex({
        name: 'IDX_hunter_profiles_org_reputation',
        columnNames: ['organizationId', 'reputationScore'],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('hunter_profiles', true);
  }
}
