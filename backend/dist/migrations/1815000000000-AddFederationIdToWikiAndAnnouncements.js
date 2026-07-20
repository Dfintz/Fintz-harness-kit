"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddFederationIdToWikiAndAnnouncements1815000000000 = void 0;
const typeorm_1 = require("typeorm");
class AddFederationIdToWikiAndAnnouncements1815000000000 {
    name = 'AddFederationIdToWikiAndAnnouncements1815000000000';
    async up(queryRunner) {
        const wikiTable = await queryRunner.getTable('wiki_pages');
        if (wikiTable) {
            const hasFedCol = wikiTable.columns.some(c => c.name === 'federationId');
            if (!hasFedCol) {
                await queryRunner.addColumn('wiki_pages', new typeorm_1.TableColumn({
                    name: 'federationId',
                    type: 'uuid',
                    isNullable: true,
                }));
                await queryRunner.createIndex('wiki_pages', new typeorm_1.TableIndex({
                    name: 'idx_wiki_federation',
                    columnNames: ['federationId'],
                }));
            }
            const hasVisCol = wikiTable.columns.some(c => c.name === 'federationVisibility');
            if (!hasVisCol) {
                await queryRunner.addColumn('wiki_pages', new typeorm_1.TableColumn({
                    name: 'federationVisibility',
                    type: 'varchar',
                    length: '50',
                    isNullable: true,
                    default: "'members'",
                }));
            }
        }
        const annTable = await queryRunner.getTable('announcements');
        if (annTable) {
            const hasFedCol = annTable.columns.some(c => c.name === 'federationId');
            if (!hasFedCol) {
                await queryRunner.addColumn('announcements', new typeorm_1.TableColumn({
                    name: 'federationId',
                    type: 'uuid',
                    isNullable: true,
                }));
                await queryRunner.createIndex('announcements', new typeorm_1.TableIndex({
                    name: 'idx_announcement_federation',
                    columnNames: ['federationId'],
                }));
            }
            const hasAudienceCol = annTable.columns.some(c => c.name === 'targetAudience');
            if (!hasAudienceCol) {
                await queryRunner.addColumn('announcements', new typeorm_1.TableColumn({
                    name: 'targetAudience',
                    type: 'varchar',
                    length: '30',
                    isNullable: true,
                    default: "'all-members'",
                }));
            }
        }
    }
    async down(queryRunner) {
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
exports.AddFederationIdToWikiAndAnnouncements1815000000000 = AddFederationIdToWikiAndAnnouncements1815000000000;
//# sourceMappingURL=1815000000000-AddFederationIdToWikiAndAnnouncements.js.map