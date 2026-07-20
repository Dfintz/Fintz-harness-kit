"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateMissionsTable1763000000001 = void 0;
const typeorm_1 = require("typeorm");
const logger_1 = require("../utils/logger");
class CreateMissionsTable1763000000001 {
    name = 'CreateMissionsTable1763000000000';
    async up(queryRunner) {
        const existingTable = await queryRunner.getTable('missions');
        if (existingTable) {
            logger_1.logger.warn('missions table already exists, skipping creation');
            return;
        }
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_type_enum" AS ENUM (
          'combat', 'mining', 'trading', 'exploration', 'logistics',
          'rescue', 'reconnaissance', 'escort', 'salvage', 'custom'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_status_enum" AS ENUM (
          'draft', 'planned', 'briefed', 'in_progress',
          'completed', 'failed', 'cancelled'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_difficulty_enum" AS ENUM (
          'trivial', 'easy', 'medium', 'hard', 'extreme'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "mission_priority_enum" AS ENUM (
          'low', 'normal', 'high', 'critical'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'missions',
            columns: [
                {
                    name: 'id',
                    type: 'uuid',
                    isPrimary: true,
                    generationStrategy: 'uuid',
                    default: 'uuid_generate_v4()',
                },
                {
                    name: 'organizationId',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'title',
                    type: 'varchar',
                    length: '200',
                    isNullable: false,
                },
                {
                    name: 'description',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'missionType',
                    type: 'mission_type_enum',
                    default: "'custom'",
                },
                {
                    name: 'status',
                    type: 'mission_status_enum',
                    default: "'draft'",
                },
                {
                    name: 'difficulty',
                    type: 'mission_difficulty_enum',
                    default: "'medium'",
                },
                {
                    name: 'priority',
                    type: 'mission_priority_enum',
                    default: "'normal'",
                },
                {
                    name: 'createdBy',
                    type: 'varchar',
                    isNullable: false,
                },
                {
                    name: 'assignedTo',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'fleetId',
                    type: 'varchar',
                    isNullable: true,
                },
                {
                    name: 'linkedActivityId',
                    type: 'uuid',
                    isNullable: true,
                },
                {
                    name: 'location',
                    type: 'varchar',
                    length: '200',
                    isNullable: true,
                },
                {
                    name: 'objectives',
                    type: 'text',
                    isNullable: true,
                    default: "'[]'",
                    comment: 'JSON array of MissionObjectiveData',
                },
                {
                    name: 'participants',
                    type: 'text',
                    isNullable: true,
                    default: "'[]'",
                    comment: 'JSON array of MissionParticipantData',
                },
                {
                    name: 'tags',
                    type: 'text',
                    isNullable: true,
                    default: "''",
                    comment: 'Comma-separated tags (simple-array)',
                },
                {
                    name: 'reward',
                    type: 'varchar',
                    length: '500',
                    isNullable: true,
                },
                {
                    name: 'startDate',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'endDate',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'completedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'notes',
                    type: 'text',
                    isNullable: true,
                },
                {
                    name: 'sharedWithOrgs',
                    type: 'text',
                    isNullable: true,
                    default: "''",
                    comment: 'TenantEntity: comma-separated org IDs',
                },
                {
                    name: 'deletedAt',
                    type: 'timestamp',
                    isNullable: true,
                },
                {
                    name: 'deletedBy',
                    type: 'varchar',
                    isNullable: true,
                },
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
        }), true);
        await queryRunner.createIndex('missions', new typeorm_1.TableIndex({
            name: 'IDX_missions_org_status',
            columnNames: ['organizationId', 'status'],
        }));
        await queryRunner.createIndex('missions', new typeorm_1.TableIndex({
            name: 'IDX_missions_org_type',
            columnNames: ['organizationId', 'missionType'],
        }));
        await queryRunner.createIndex('missions', new typeorm_1.TableIndex({
            name: 'IDX_missions_org_createdBy',
            columnNames: ['organizationId', 'createdBy'],
        }));
        await queryRunner.createIndex('missions', new typeorm_1.TableIndex({
            name: 'IDX_missions_org_createdAt',
            columnNames: ['organizationId', 'createdAt'],
        }));
        await queryRunner.createIndex('missions', new typeorm_1.TableIndex({
            name: 'IDX_missions_organizationId',
            columnNames: ['organizationId'],
        }));
        const fleetsTableExists = await queryRunner.getTable('fleets');
        if (fleetsTableExists) {
            await queryRunner.createForeignKey('missions', new typeorm_1.TableForeignKey({
                name: 'FK_missions_fleetId',
                columnNames: ['fleetId'],
                referencedTableName: 'fleets',
                referencedColumnNames: ['id'],
                onDelete: 'SET NULL',
            }));
        }
        const orgsTableExists = await queryRunner.getTable('organizations');
        if (orgsTableExists) {
            await queryRunner.createForeignKey('missions', new typeorm_1.TableForeignKey({
                name: 'FK_missions_organizationId',
                columnNames: ['organizationId'],
                referencedTableName: 'organizations',
                referencedColumnNames: ['id'],
                onDelete: 'CASCADE',
            }));
        }
        logger_1.logger.info('Created missions table with indexes and foreign keys');
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('missions');
        if (table) {
            const fkFleet = table.foreignKeys.find(fk => fk.name === 'FK_missions_fleetId');
            if (fkFleet) {
                await queryRunner.dropForeignKey('missions', fkFleet);
            }
            const fkOrg = table.foreignKeys.find(fk => fk.name === 'FK_missions_organizationId');
            if (fkOrg) {
                await queryRunner.dropForeignKey('missions', fkOrg);
            }
        }
        await queryRunner.dropTable('missions', true);
        await queryRunner.query('DROP TYPE IF EXISTS "mission_priority_enum"');
        await queryRunner.query('DROP TYPE IF EXISTS "mission_difficulty_enum"');
        await queryRunner.query('DROP TYPE IF EXISTS "mission_status_enum"');
        await queryRunner.query('DROP TYPE IF EXISTS "mission_type_enum"');
        logger_1.logger.info('Dropped missions table and related enums');
    }
}
exports.CreateMissionsTable1763000000001 = CreateMissionsTable1763000000001;
//# sourceMappingURL=1763000000001-CreateMissionsTable.js.map