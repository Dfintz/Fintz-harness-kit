"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddInboxMessagingSystem1770400000000 = void 0;
const typeorm_1 = require("typeorm");
class AddInboxMessagingSystem1770400000000 {
    name = 'AddInboxMessagingSystem1770400000000';
    async resolveColumnName(queryRunner, tableName, preferredName) {
        const rows = await queryRunner.query(`SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND LOWER(column_name) = LOWER($2)
       ORDER BY CASE WHEN column_name = $2 THEN 0 ELSE 1 END
       LIMIT 1`, [tableName, preferredName]);
        return rows[0]?.column_name ?? null;
    }
    async up(queryRunner) {
        const senderUserIdColumn = await this.resolveColumnName(queryRunner, 'contact_requests', 'senderUserId');
        const repliesTableExists = await queryRunner.hasTable('contact_request_replies');
        if (senderUserIdColumn && repliesTableExists) {
            return;
        }
        await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            ADD COLUMN "senderUserId" varchar NULL
        `);
        await queryRunner.createIndex('contact_requests', new typeorm_1.TableIndex({
            name: 'IDX_contact_requests_senderUserId',
            columnNames: ['senderUserId'],
        }));
        await queryRunner.createForeignKey('contact_requests', new typeorm_1.TableForeignKey({
            name: 'FK_contact_requests_senderUserId',
            columnNames: ['senderUserId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
        }));
        await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            ALTER COLUMN "senderEmail" DROP NOT NULL
        `);
        await queryRunner.createTable(new typeorm_1.Table({
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
        }), true);
        await queryRunner.createIndex('contact_request_replies', new typeorm_1.TableIndex({
            name: 'IDX_contact_request_replies_contactRequestId',
            columnNames: ['contactRequestId'],
        }));
        await queryRunner.createIndex('contact_request_replies', new typeorm_1.TableIndex({
            name: 'IDX_contact_request_replies_senderUserId',
            columnNames: ['senderUserId'],
        }));
        await queryRunner.createIndex('contact_request_replies', new typeorm_1.TableIndex({
            name: 'IDX_contact_request_replies_contactRequestId_createdAt',
            columnNames: ['contactRequestId', 'createdAt'],
        }));
        await queryRunner.createForeignKey('contact_request_replies', new typeorm_1.TableForeignKey({
            name: 'FK_contact_request_replies_contactRequestId',
            columnNames: ['contactRequestId'],
            referencedTableName: 'contact_requests',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
        }));
        await queryRunner.createForeignKey('contact_request_replies', new typeorm_1.TableForeignKey({
            name: 'FK_contact_request_replies_senderUserId',
            columnNames: ['senderUserId'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('contact_request_replies', true, true);
        await queryRunner.dropForeignKey('contact_requests', 'FK_contact_requests_senderUserId');
        await queryRunner.dropIndex('contact_requests', 'IDX_contact_requests_senderUserId');
        await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            DROP COLUMN "senderUserId"
        `);
        await queryRunner.query(`
            ALTER TABLE "contact_requests" 
            ALTER COLUMN "senderEmail" SET NOT NULL
        `);
    }
}
exports.AddInboxMessagingSystem1770400000000 = AddInboxMessagingSystem1770400000000;
//# sourceMappingURL=1770400000000-AddInboxMessagingSystem.js.map