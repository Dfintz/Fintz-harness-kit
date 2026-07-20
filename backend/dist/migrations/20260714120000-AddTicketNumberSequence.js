"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTicketNumberSequence20260714120000 = void 0;
class AddTicketNumberSequence20260714120000 {
    name = 'AddTicketNumberSequence20260714120000';
    async up(queryRunner) {
        await queryRunner.query(`
      CREATE SEQUENCE IF NOT EXISTS ticket_number_seq
        START WITH 1
        INCREMENT BY 1
        NO MINVALUE
        NO MAXVALUE
        CACHE 1
    `);
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
    async down(queryRunner) {
        await queryRunner.query(`DROP SEQUENCE IF EXISTS ticket_number_seq`);
    }
}
exports.AddTicketNumberSequence20260714120000 = AddTicketNumberSequence20260714120000;
//# sourceMappingURL=20260714120000-AddTicketNumberSequence.js.map