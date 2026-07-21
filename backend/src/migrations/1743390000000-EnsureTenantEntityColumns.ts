import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ensures all TenantEntity columns exist on tables that extend TenantEntity.
 * Some tables were created before TenantEntity added sharedWithOrgs/deletedAt/deletedBy.
 */
export class EnsureTenantEntityColumns1743390000000 implements MigrationInterface {
  private readonly tables = ['webhooks', 'bounties', 'tunnels', 'trading_routes'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of this.tables) {
      const table = await queryRunner.getTable(tableName);
      if (!table) {
        continue;
      }

      if (!table.findColumnByName('sharedWithOrgs')) {
        await queryRunner.query(
          `ALTER TABLE "${tableName}" ADD COLUMN "sharedWithOrgs" text DEFAULT ''`
        );
      }
      if (!table.findColumnByName('deletedAt')) {
        await queryRunner.query(`ALTER TABLE "${tableName}" ADD COLUMN "deletedAt" timestamp`);
      }
      if (!table.findColumnByName('deletedBy')) {
        await queryRunner.query(`ALTER TABLE "${tableName}" ADD COLUMN "deletedBy" varchar(255)`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const tableName of this.tables) {
      const table = await queryRunner.getTable(tableName);
      if (!table) {
        continue;
      }

      if (table.findColumnByName('sharedWithOrgs')) {
        await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN "sharedWithOrgs"`);
      }
      if (table.findColumnByName('deletedAt')) {
        await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN "deletedAt"`);
      }
      if (table.findColumnByName('deletedBy')) {
        await queryRunner.query(`ALTER TABLE "${tableName}" DROP COLUMN "deletedBy"`);
      }
    }
  }
}
