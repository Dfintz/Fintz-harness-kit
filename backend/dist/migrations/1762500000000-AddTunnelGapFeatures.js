"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTunnelGapFeatures1762500000000 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class AddTunnelGapFeatures1762500000000 {
    name = 'AddTunnelGapFeatures1762500000000';
    async up(queryRunner) {
        const tunnelsTable = await queryRunner.getTable('tunnels');
        if (tunnelsTable) {
            if (!tunnelsTable.findColumnByName('inviteCode')) {
                await queryRunner.addColumn('tunnels', new typeorm_1.TableColumn({
                    name: 'inviteCode',
                    type: 'varchar',
                    isNullable: true,
                    isUnique: true,
                }));
                await queryRunner.createIndex('tunnels', new typeorm_1.TableIndex({
                    name: 'IDX_tunnel_invite_code',
                    columnNames: ['inviteCode'],
                    isUnique: true,
                }));
                logger_1.logger.info('Added inviteCode column to tunnels table');
            }
            if (!tunnelsTable.findColumnByName('allowBotMessages')) {
                await queryRunner.addColumn('tunnels', new typeorm_1.TableColumn({
                    name: 'allowBotMessages',
                    type: 'boolean',
                    default: true,
                }));
                logger_1.logger.info('Added allowBotMessages column to tunnels table');
            }
            if (!tunnelsTable.findColumnByName('maxConnectedServers')) {
                await queryRunner.addColumn('tunnels', new typeorm_1.TableColumn({
                    name: 'maxConnectedServers',
                    type: 'integer',
                    default: 0,
                }));
                logger_1.logger.info('Added maxConnectedServers column to tunnels table');
            }
        }
        else {
            logger_1.logger.warn('tunnels table not found, skipping column additions');
        }
        const existingMessages = await queryRunner.getTable('tunnel_messages');
        if (existingMessages) {
            logger_1.logger.warn('tunnel_messages table already exists, skipping creation');
        }
        else {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'tunnel_messages',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'tunnelId', type: 'uuid', isNullable: false },
                    { name: 'authorId', type: 'varchar', isNullable: false },
                    { name: 'authorName', type: 'varchar', isNullable: false },
                    { name: 'authorAvatar', type: 'varchar', isNullable: true },
                    { name: 'sourceGuildId', type: 'varchar', isNullable: true },
                    { name: 'sourceChannelId', type: 'varchar', isNullable: true },
                    { name: 'discordMessageId', type: 'varchar', isNullable: true },
                    { name: 'content', type: 'text', isNullable: true },
                    { name: 'attachments', type: 'text', isNullable: true },
                    { name: 'embeds', type: 'text', isNullable: true },
                    { name: 'stickerIds', type: 'text', isNullable: true },
                    { name: 'replyToMessageId', type: 'varchar', isNullable: true },
                    { name: 'isBot', type: 'boolean', default: false },
                    { name: 'wasBlocked', type: 'boolean', default: false },
                    { name: 'blockReason', type: 'varchar', isNullable: true },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }), true);
            await queryRunner.createForeignKey('tunnel_messages', new typeorm_1.TableForeignKey({
                name: 'FK_tunnel_messages_tunnel',
                columnNames: ['tunnelId'],
                referencedTableName: 'tunnels',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
            await queryRunner.createIndex('tunnel_messages', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_message_tunnel',
                columnNames: ['tunnelId'],
            }));
            await queryRunner.createIndex('tunnel_messages', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_message_tunnel_timestamp',
                columnNames: ['tunnelId', 'createdAt'],
            }));
            await queryRunner.createIndex('tunnel_messages', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_message_discord_id',
                columnNames: ['discordMessageId'],
            }));
            logger_1.logger.info('Created tunnel_messages table');
        }
        const existingBans = await queryRunner.getTable('tunnel_bans');
        if (existingBans) {
            logger_1.logger.warn('tunnel_bans table already exists, skipping creation');
        }
        else {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'tunnel_bans',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'tunnelId', type: 'uuid', isNullable: false },
                    { name: 'userId', type: 'varchar', isNullable: false },
                    { name: 'username', type: 'varchar', isNullable: true },
                    { name: 'type', type: 'varchar', length: '10', isNullable: false },
                    { name: 'reason', type: 'varchar', isNullable: true },
                    { name: 'issuedBy', type: 'varchar', isNullable: false },
                    { name: 'expiresAt', type: 'timestamp', isNullable: true },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }), true);
            await queryRunner.createForeignKey('tunnel_bans', new typeorm_1.TableForeignKey({
                name: 'FK_tunnel_bans_tunnel',
                columnNames: ['tunnelId'],
                referencedTableName: 'tunnels',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
            await queryRunner.createIndex('tunnel_bans', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_ban_user_tunnel',
                columnNames: ['tunnelId', 'userId'],
                isUnique: true,
            }));
            await queryRunner.createIndex('tunnel_bans', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_ban_tunnel',
                columnNames: ['tunnelId'],
            }));
            await queryRunner.createIndex('tunnel_bans', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_ban_user',
                columnNames: ['userId'],
            }));
            logger_1.logger.info('Created tunnel_bans table');
        }
        const existingAnalytics = await queryRunner.getTable('tunnel_analytics');
        if (existingAnalytics) {
            logger_1.logger.warn('tunnel_analytics table already exists, skipping creation');
        }
        else {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'tunnel_analytics',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'uuid_generate_v4()',
                    },
                    { name: 'tunnelId', type: 'uuid', isNullable: false },
                    { name: 'periodStart', type: 'timestamp', isNullable: false },
                    { name: 'messagesRelayed', type: 'integer', default: 0 },
                    { name: 'messagesBlocked', type: 'integer', default: 0 },
                    { name: 'uniqueUsers', type: 'integer', default: 0 },
                    { name: 'peakConnections', type: 'integer', default: 0 },
                    { name: 'attachmentsRelayed', type: 'integer', default: 0 },
                    { name: 'reactionsRelayed', type: 'integer', default: 0 },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                    },
                ],
            }), true);
            await queryRunner.createForeignKey('tunnel_analytics', new typeorm_1.TableForeignKey({
                name: 'FK_tunnel_analytics_tunnel',
                columnNames: ['tunnelId'],
                referencedTableName: 'tunnels',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
            await queryRunner.createIndex('tunnel_analytics', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_analytics_tunnel_period',
                columnNames: ['tunnelId', 'periodStart'],
            }));
            await queryRunner.createIndex('tunnel_analytics', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_analytics_tunnel',
                columnNames: ['tunnelId'],
            }));
            await queryRunner.createIndex('tunnel_analytics', new typeorm_1.TableIndex({
                name: 'IDX_tunnel_analytics_period',
                columnNames: ['periodStart'],
            }));
            logger_1.logger.info('Created tunnel_analytics table');
        }
    }
    async down(queryRunner) {
        await queryRunner.dropTable('tunnel_analytics', true);
        await queryRunner.dropTable('tunnel_bans', true);
        await queryRunner.dropTable('tunnel_messages', true);
        const tunnelsTable = await queryRunner.getTable('tunnels');
        if (tunnelsTable) {
            if (tunnelsTable.findColumnByName('maxConnectedServers')) {
                await queryRunner.dropColumn('tunnels', 'maxConnectedServers');
            }
            if (tunnelsTable.findColumnByName('allowBotMessages')) {
                await queryRunner.dropColumn('tunnels', 'allowBotMessages');
            }
            if (tunnelsTable.findColumnByName('inviteCode')) {
                const idx = tunnelsTable.indices.find(i => i.name === 'IDX_tunnel_invite_code');
                if (idx) {
                    await queryRunner.dropIndex('tunnels', 'IDX_tunnel_invite_code');
                }
                await queryRunner.dropColumn('tunnels', 'inviteCode');
            }
        }
        logger_1.logger.info('Reverted tunnel gap features migration');
    }
}
exports.AddTunnelGapFeatures1762500000000 = AddTunnelGapFeatures1762500000000;
//# sourceMappingURL=1762500000000-AddTunnelGapFeatures.js.map