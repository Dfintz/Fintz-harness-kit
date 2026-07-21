import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Migration: Add Route Calculation Fields to Activity
 * 
 * Adds columns to the activities table to support route planning and fleet logistics:
 * - totalCargoCapacity: Total cargo capacity (SCU) across all assigned ships
 * - totalQuantumFuel: Total quantum fuel capacity across all ships
 * - totalQuantumFuelRequired: Quantum fuel needed for the entire route
 * - maxJumpRange: Maximum single jump range (limited by bottleneck ship)
 * - hasRefuelShip: Whether the fleet includes refuel-capable ships
 * 
 * These fields are calculated by RouteCalculationService when activities
 * have shipAssignments and/or routePlan defined.
 * 
 * All columns are nullable to support existing activities and gradual adoption.
 */
export class AddRouteCalculationFieldsToActivity1776391600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add route calculation fields to activities table
    await queryRunner.addColumn(
      'activities',
      new TableColumn({
        name: 'totalCargoCapacity',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
        comment: 'Total cargo capacity (SCU) across all assigned ships',
      })
    );

    await queryRunner.addColumn(
      'activities',
      new TableColumn({
        name: 'totalQuantumFuel',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
        comment: 'Total quantum fuel capacity across all ships',
      })
    );

    await queryRunner.addColumn(
      'activities',
      new TableColumn({
        name: 'totalQuantumFuelRequired',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
        comment: 'Total quantum fuel needed for the entire route',
      })
    );

    await queryRunner.addColumn(
      'activities',
      new TableColumn({
        name: 'maxJumpRange',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
        comment: 'Maximum single jump range (km) - limited by bottleneck ship',
      })
    );

    await queryRunner.addColumn(
      'activities',
      new TableColumn({
        name: 'hasRefuelShip',
        type: 'boolean',
        isNullable: true,
        default: false,
        comment: 'Whether fleet includes a refuel-capable ship (Starfarer, Vulcan)',
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove route calculation fields in reverse order
    await queryRunner.dropColumn('activities', 'hasRefuelShip');
    await queryRunner.dropColumn('activities', 'maxJumpRange');
    await queryRunner.dropColumn('activities', 'totalQuantumFuelRequired');
    await queryRunner.dropColumn('activities', 'totalQuantumFuel');
    await queryRunner.dropColumn('activities', 'totalCargoCapacity');
  }
}
