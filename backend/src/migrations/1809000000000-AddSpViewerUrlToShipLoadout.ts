import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add spViewerUrl column to ship_loadouts table.
 *
 * Stores a SP Viewer (spviewer.eu) performance share link alongside
 * the existing erkul.games URL.
 */
export class AddSpViewerUrlToShipLoadout1809000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'ship_loadouts',
      new TableColumn({
        name: 'spViewerUrl',
        type: 'varchar',
        length: '500',
        isNullable: true,
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('ship_loadouts', 'spViewerUrl');
  }
}
