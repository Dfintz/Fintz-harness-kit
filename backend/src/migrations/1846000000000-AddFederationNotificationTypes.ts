import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFederationNotificationTypes1846000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if the enum type exists before trying to add values.
    // If the column uses varchar (common when synchronize was never used for this table),
    // no ALTER TYPE is needed — the TypeScript enum values are stored as plain strings.
    const enumExists = await queryRunner.query(
      `SELECT 1 FROM pg_type WHERE typname = 'notifications_type_enum' LIMIT 1`
    );

    if (enumExists.length > 0) {
      await queryRunner.query(
        `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'federation_invitation'`
      );
      await queryRunner.query(
        `ALTER TYPE "notifications_type_enum" ADD VALUE IF NOT EXISTS 'federation_accepted'`
      );
    }
    // If enum doesn't exist, values are stored as varchar — no migration needed
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support removing enum values directly.
    // The old values remain harmless if unused.
  }
}
