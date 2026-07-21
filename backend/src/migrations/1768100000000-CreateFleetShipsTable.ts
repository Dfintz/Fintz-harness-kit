import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

/**
 * Migration: Create FleetShips Join Table
 *
 * This migration creates the fleet_ships join table to manage the many-to-many
 * relationship between fleets and ships. This replaces the previous approach
 * where Fleet.shipIds was a simple array and Ship.fleetId was a single reference.
 *
 * Benefits of this approach:
 * - Ships can be assigned to multiple fleets
 * - Additional metadata (role, notes, assignedBy) per assignment
 * - Better query performance with proper indexes
 * - Referential integrity with foreign keys
 * - Audit trail (assignedAt, assignedBy)
 *
 * Note: This migration is part of the Fleet Management MVP implementation.
 * See docs/FLEET_MANAGEMENT_AUDIT.md for full context.
 */
export class CreateFleetShipsTable1768100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const existingTable = await queryRunner.getTable('fleet_ships');
    if (existingTable) {
      return;
    }

    // Create fleet_ships table
    await queryRunner.createTable(
      new Table({
        name: 'fleet_ships',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'fleetId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'shipId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'organizationId',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'role',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'assignedBy',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'assignedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
      }),
      true
    );

    // Create indexes for performance
    await queryRunner.createIndex(
      'fleet_ships',
      new TableIndex({
        name: 'idx_fleet_ships_fleet_ship',
        columnNames: ['fleetId', 'shipId'],
        isUnique: true, // Prevent duplicate assignments
      })
    );

    await queryRunner.createIndex(
      'fleet_ships',
      new TableIndex({
        name: 'idx_fleet_ships_fleet',
        columnNames: ['fleetId'],
      })
    );

    await queryRunner.createIndex(
      'fleet_ships',
      new TableIndex({
        name: 'idx_fleet_ships_ship',
        columnNames: ['shipId'],
      })
    );

    await queryRunner.createIndex(
      'fleet_ships',
      new TableIndex({
        name: 'idx_fleet_ships_organization',
        columnNames: ['organizationId'],
      })
    );

    // Create foreign keys with cascade delete
    await queryRunner.createForeignKey(
      'fleet_ships',
      new TableForeignKey({
        name: 'fk_fleet_ships_fleet',
        columnNames: ['fleetId'],
        referencedTableName: 'fleets',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // When fleet is deleted, remove all assignments
      })
    );

    await queryRunner.createForeignKey(
      'fleet_ships',
      new TableForeignKey({
        name: 'fk_fleet_ships_ship',
        columnNames: ['shipId'],
        referencedTableName: 'ships',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE', // When ship is deleted, remove all assignments
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign keys
    await queryRunner.dropForeignKey('fleet_ships', 'fk_fleet_ships_ship');
    await queryRunner.dropForeignKey('fleet_ships', 'fk_fleet_ships_fleet');

    // Drop indexes
    await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_organization');
    await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_ship');
    await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_fleet');
    await queryRunner.dropIndex('fleet_ships', 'idx_fleet_ships_fleet_ship');

    // Drop table
    await queryRunner.dropTable('fleet_ships');
  }
}
