import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * AddFederationIdToWikiAndAnnouncements
 *
 * Federation Phase 2 — Wiki + Announcements scoping
 *
 * Adds a nullable `federationId` column to `wiki_pages` and `announcements`
 * tables, enabling these features to be scoped to a federation as well as
 * (or instead of) an organization.
 *
 * Also adds a `federationVisibility` column to `wiki_pages` for treaty-gated
 * access control, and a `targetAudience` column to `announcements` for
 * federation-level broadcast targeting.
 *
 * Idempotent: guards DDL statements to allow safe re-runs.
 */
export class AddFederationIdToWikiAndAnnouncements1815000000000 implements MigrationInterface {
  name = 'AddFederationIdToWikiAndAnnouncements1815000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ────── 1. wiki_pages: Add federationId + federationVisibility ─────

    const wikiTable = await queryRunner.getTable('wiki_pages');
    if (wikiTable) {
      const hasFedCol = wikiTable.columns.some(c => c.name === 'federationId');
      if (!hasFedCol) {
        await queryRunner.addColumn(
          'wiki_pages',
          new TableColumn({
            name: 'federationId',
            type: 'uuid',
            isNullable: true,
          })
        );

        await queryRunner.createIndex(
          'wiki_pages',
          new TableIndex({
            name: 'idx_wiki_federation',
            columnNames: ['federationId'],
          })
        );
      }

      const hasVisCol = wikiTable.columns.some(c => c.name === 'federationVisibility');
      if (!hasVisCol) {
        await queryRunner.addColumn(
          'wiki_pages',
          new TableColumn({
            name: 'federationVisibility',
            type: 'varchar',
            length: '50',
            isNullable: true,
            default: "'members'",
          })
        );
      }
    }

    // ────── 2. announcements: Add federationId + targetAudience ────────

    const annTable = await queryRunner.getTable('announcements');
    if (annTable) {
      const hasFedCol = annTable.columns.some(c => c.name === 'federationId');
      if (!hasFedCol) {
        await queryRunner.addColumn(
          'announcements',
          new TableColumn({
            name: 'federationId',
            type: 'uuid',
            isNullable: true,
          })
        );

        await queryRunner.createIndex(
          'announcements',
          new TableIndex({
            name: 'idx_announcement_federation',
            columnNames: ['federationId'],
          })
        );
      }

      const hasAudienceCol = annTable.columns.some(c => c.name === 'targetAudience');
      if (!hasAudienceCol) {
        await queryRunner.addColumn(
          'announcements',
          new TableColumn({
            name: 'targetAudience',
            type: 'varchar',
            length: '30',
            isNullable: true,
            default: "'all-members'",
          })
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove from announcements
    const annTable = await queryRunner.getTable('announcements');
    if (annTable) {
      if (annTable.columns.some(c => c.name === 'targetAudience')) {
        await queryRunner.dropColumn('announcements', 'targetAudience');
      }
      const fedIdx = annTable.indices.find(i => i.name === 'idx_announcement_federation');
      if (fedIdx) {
        await queryRunner.dropIndex('announcements', 'idx_announcement_federation');
      }
      if (annTable.columns.some(c => c.name === 'federationId')) {
        await queryRunner.dropColumn('announcements', 'federationId');
      }
    }

    // Remove from wiki_pages
    const wikiTable = await queryRunner.getTable('wiki_pages');
    if (wikiTable) {
      if (wikiTable.columns.some(c => c.name === 'federationVisibility')) {
        await queryRunner.dropColumn('wiki_pages', 'federationVisibility');
      }
      const fedIdx = wikiTable.indices.find(i => i.name === 'idx_wiki_federation');
      if (fedIdx) {
        await queryRunner.dropIndex('wiki_pages', 'idx_wiki_federation');
      }
      if (wikiTable.columns.some(c => c.name === 'federationId')) {
        await queryRunner.dropColumn('wiki_pages', 'federationId');
      }
    }
  }
}
