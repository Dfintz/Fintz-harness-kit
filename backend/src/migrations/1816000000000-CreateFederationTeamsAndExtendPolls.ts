import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * CreateFederationTeamsAndExtendPolls
 *
 * Federation Phase 3 — Polls + Cross-Org Teams
 *
 * 1. Adds `federationId` + `votingMode` to `polls` table
 * 2. Creates `federation_teams` table for cross-org operational groups
 *
 * Idempotent: guards DDL statements to allow safe re-runs.
 */
export class CreateFederationTeamsAndExtendPolls1816000000000 implements MigrationInterface {
  name = 'CreateFederationTeamsAndExtendPolls1816000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ────── 1. polls: Add federationId + votingMode ───────────────

    const pollsTable = await queryRunner.getTable('polls');
    if (pollsTable) {
      const hasFedCol = pollsTable.columns.some(c => c.name === 'federationId');
      if (!hasFedCol) {
        await queryRunner.addColumn(
          'polls',
          new TableColumn({
            name: 'federationId',
            type: 'uuid',
            isNullable: true,
          })
        );

        await queryRunner.createIndex(
          'polls',
          new TableIndex({
            name: 'idx_poll_federation',
            columnNames: ['federationId'],
          })
        );

        await queryRunner.createIndex(
          'polls',
          new TableIndex({
            name: 'idx_poll_federation_status',
            columnNames: ['federationId', 'status'],
          })
        );
      }

      const hasVotingMode = pollsTable.columns.some(c => c.name === 'votingMode');
      if (!hasVotingMode) {
        await queryRunner.addColumn(
          'polls',
          new TableColumn({
            name: 'votingMode',
            type: 'varchar',
            length: '20',
            isNullable: true,
            default: "'equal'",
          })
        );
      }
    }

    // ────── 2. federation_teams table ─────────────────────────────

    const teamsTable = await queryRunner.getTable('federation_teams');
    if (!teamsTable) {
      await queryRunner.createTable(
        new Table({
          name: 'federation_teams',
          columns: [
            {
              name: 'id',
              type: 'uuid',
              isPrimary: true,
              generationStrategy: 'uuid',
              default: 'uuid_generate_v4()',
            },
            { name: 'federationId', type: 'uuid', isNullable: false },
            { name: 'name', type: 'varchar', length: '100', isNullable: false },
            { name: 'description', type: 'text', isNullable: true },
            {
              name: 'type',
              type: 'varchar',
              length: '30',
              isNullable: false,
              default: "'task_force'",
            },
            { name: 'leaderId', type: 'varchar', isNullable: true },
            { name: 'leaderName', type: 'varchar', length: '200', isNullable: true },
            { name: 'leaderOrgId', type: 'varchar', isNullable: true },
            {
              name: 'members',
              type: 'jsonb',
              isNullable: false,
              default: "'[]'",
            },
            {
              name: 'status',
              type: 'varchar',
              length: '20',
              isNullable: false,
              default: "'active'",
            },
            {
              name: 'maxMembers',
              type: 'int',
              isNullable: false,
              default: 20,
            },
            {
              name: 'createdAt',
              type: 'timestamptz',
              isNullable: false,
              default: 'now()',
            },
            {
              name: 'updatedAt',
              type: 'timestamptz',
              isNullable: false,
              default: 'now()',
            },
          ],
        }),
        true
      );

      await queryRunner.createForeignKey(
        'federation_teams',
        new TableForeignKey({
          name: 'FK_fed_team_federation',
          columnNames: ['federationId'],
          referencedTableName: 'federations',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        })
      );

      await queryRunner.createIndex(
        'federation_teams',
        new TableIndex({
          name: 'idx_fed_team_federation',
          columnNames: ['federationId'],
        })
      );

      await queryRunner.createIndex(
        'federation_teams',
        new TableIndex({
          name: 'idx_fed_team_status',
          columnNames: ['federationId', 'status'],
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop federation_teams
    const teamsTable = await queryRunner.getTable('federation_teams');
    if (teamsTable) {
      await queryRunner.dropTable('federation_teams');
    }

    // Remove polls columns
    const pollsTable = await queryRunner.getTable('polls');
    if (pollsTable) {
      if (pollsTable.columns.some(c => c.name === 'votingMode')) {
        await queryRunner.dropColumn('polls', 'votingMode');
      }
      const fedStatusIdx = pollsTable.indices.find(i => i.name === 'idx_poll_federation_status');
      if (fedStatusIdx) {
        await queryRunner.dropIndex('polls', 'idx_poll_federation_status');
      }
      const fedIdx = pollsTable.indices.find(i => i.name === 'idx_poll_federation');
      if (fedIdx) {
        await queryRunner.dropIndex('polls', 'idx_poll_federation');
      }
      if (pollsTable.columns.some(c => c.name === 'federationId')) {
        await queryRunner.dropColumn('polls', 'federationId');
      }
    }
  }
}
