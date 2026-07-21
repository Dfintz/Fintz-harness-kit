import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * AddTicketNumberSequence
 *
 * Replaces the in-memory ticket counter (which races across multiple
 * container instances) with a PostgreSQL sequence.  nextval() is
 * guaranteed to return a distinct value for every concurrent caller,
 * eliminating the duplicate-key violations on UQ_e99bd0f51b92896fdaf99ebb715.
 *
 * The sequence is initialised to the current maximum numeric suffix so
 * no existing ticket number is ever re-used.
 */
export class AddTicketNumberSequence20260714120000 implements MigrationInterface {
  name = 'AddTicketNumberSequence20260714120000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the sequence (idempotent – skipped if already present).
    await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS ticket_number_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    `);

    // Advance the sequence past every existing ticket number so that
    // the first nextval() call returns (current_max + 1).
    // GREATEST(..., 0) guards against an empty tickets table.
    // setval(seq, val, true) means the *next* nextval() returns val + 1.
    await queryRunner.query(`
      SELECT setval(
        'ticket_number_seq',
        GREATEST(
          (
            SELECT COALESCE(
              MAX(SUBSTRING("ticketNumber", 5)::integer),
              0
            )
            FROM tickets
            WHERE "ticketNumber" ~ '^TKT-[0-9]+$'
          ),
          0
        ),
        true
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS ticket_number_seq`);
  }
}
