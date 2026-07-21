import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnableUuidExtension1729340000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Enable uuid-ossp extension for uuid_generate_v4() function
        // This extension is required for UUID generation in PostgreSQL
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    }

    public async down(_queryRunner: QueryRunner): Promise<void> {
        // This migration is intentionally irreversible.
        // We don't drop the uuid-ossp extension because:
        // 1. Other migrations and tables depend on it for UUID generation
        // 2. Dropping it would break existing UUID columns and foreign keys
        // 3. PostgreSQL extensions are safe to leave enabled
        // 4. Reverting this would prevent rolling back dependent migrations
        
        // If you need to remove the extension manually, use:
        // DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;
        // WARNING: This will drop all dependent objects including UUID columns
    }
}
