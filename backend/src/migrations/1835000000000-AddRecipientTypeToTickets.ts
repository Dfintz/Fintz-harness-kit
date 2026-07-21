import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRecipientTypeToTickets1835000000000 implements MigrationInterface {
  name = 'AddRecipientTypeToTickets1835000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the enum type for ticket recipient types
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "tickets_recipienttype_enum" AS ENUM (
          'org_leadership',
          'org_officers',
          'team_leader',
          'alliance_council',
          'hr_department',
          'recruitment',
          'diplomacy',
          'specific_user',
          'platform_admin'
        );
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);

    // Add the recipientType column to the tickets table
    const hasColumn = await queryRunner.hasColumn('tickets', 'recipientType');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'tickets',
        new TableColumn({
          name: 'recipientType',
          type: 'tickets_recipienttype_enum',
          isNullable: true,
        })
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('tickets', 'recipientType');
    if (hasColumn) {
      await queryRunner.dropColumn('tickets', 'recipientType');
    }
    await queryRunner.query(`DROP TYPE IF EXISTS "tickets_recipienttype_enum"`);
  }
}
