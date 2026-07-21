import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * AddSCStatsColumns
 *
 * Wave 2.5 — SCStats Integration (Phase 1)
 *
 * Adds SCStats columns to user_gameplay_preferences table for
 * storing imported gameplay analytics from SCStats JSON exports.
 *
 * Columns added:
 *  - scstats_raw_data (text, encrypted)
 *  - scstats_last_import (timestamp)
 *  - scstats_verified (boolean)
 *  - scstats_total_hours (decimal)
 *  - scstats_kd_ratio (decimal)
 *  - scstats_missions_completed (integer)
 *  - scstats_favorite_vehicle (varchar)
 *  - scstats_import_count (integer)
 *  - scstats_consent_granted (boolean)
 *  - scstats_consent_date (timestamp)
 */
export class AddSCStatsColumns1775000000000 implements MigrationInterface {
  name = 'AddSCStatsColumns1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_gameplay_preferences');
    if (!table) {
      return;
    }

    const columns = [
      new TableColumn({
        name: 'scstats_raw_data',
        type: 'text',
        isNullable: true,
        comment: 'Encrypted SCStats JSON export (AES-256-GCM)',
      }),
      new TableColumn({
        name: 'scstats_last_import',
        type: 'timestamp',
        isNullable: true,
        comment: 'Last time SCStats data was imported',
      }),
      new TableColumn({
        name: 'scstats_verified',
        type: 'boolean',
        default: false,
        comment: 'Whether user has verified SCStats data',
      }),
      new TableColumn({
        name: 'scstats_total_hours',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
        comment: 'Total playtime from SCStats',
      }),
      new TableColumn({
        name: 'scstats_kd_ratio',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
        comment: 'K/D ratio from SCStats',
      }),
      new TableColumn({
        name: 'scstats_missions_completed',
        type: 'integer',
        isNullable: true,
        comment: 'Total missions completed from SCStats',
      }),
      new TableColumn({
        name: 'scstats_favorite_vehicle',
        type: 'varchar',
        length: '255',
        isNullable: true,
        comment: 'Most-used vehicle from SCStats',
      }),
      new TableColumn({
        name: 'scstats_import_count',
        type: 'integer',
        default: 0,
        comment: 'Number of times SCStats data has been imported',
      }),
      new TableColumn({
        name: 'scstats_consent_granted',
        type: 'boolean',
        default: false,
        comment: 'User consent for SCStats data storage',
      }),
      new TableColumn({
        name: 'scstats_consent_date',
        type: 'timestamp',
        isNullable: true,
        comment: 'Date user granted SCStats consent',
      }),
    ];

    for (const column of columns) {
      const exists = table.findColumnByName(column.name);
      if (!exists) {
        await queryRunner.addColumn('user_gameplay_preferences', column);
      }
    }

    // Add indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ugp_scstats_kd
      ON user_gameplay_preferences(scstats_kd_ratio)
      WHERE scstats_kd_ratio IS NOT NULL;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ugp_scstats_hours
      ON user_gameplay_preferences(scstats_total_hours)
      WHERE scstats_total_hours IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_gameplay_preferences');
    if (!table) {
      return;
    }

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ugp_scstats_kd;`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ugp_scstats_hours;`);

    // Drop columns
    const columnNames = [
      'scstats_raw_data',
      'scstats_last_import',
      'scstats_verified',
      'scstats_total_hours',
      'scstats_kd_ratio',
      'scstats_missions_completed',
      'scstats_favorite_vehicle',
      'scstats_import_count',
      'scstats_consent_granted',
      'scstats_consent_date',
    ];

    for (const columnName of columnNames) {
      const column = table.findColumnByName(columnName);
      if (column) {
        await queryRunner.dropColumn('user_gameplay_preferences', column);
      }
    }
  }
}
