/**
 * TicketService — error-to-HTTP normalization tests.
 *
 * Locks in the typed-error contract introduced by the E3 error normalization:
 * - acting on a missing ticket                       → NotFoundError (statusCode 404)
 * - a satisfaction rating outside the 1..5 range      → ValidationError (statusCode 400)
 *
 * The statusCode assertions matter: they are what `BaseController.handleError`
 * maps to the HTTP response (TicketService is reached via TicketController, which
 * extends BaseController). The not-found throws were already 404 via the message
 * match, but the rating throw previously fell through to 500, so that case guards
 * the 500→400 fix. The post-save "reload" invariant throw is intentionally left a
 * plain Error (internal consistency failure, not a client error) and is not covered.
 */
import { Ticket } from '../../../../models/Ticket';
import { NotFoundError, ValidationError } from '../../../../utils/apiErrors';

const mockTicketRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  // query is used by generateTicketNumber (PostgreSQL sequence call); not exercised
  // by current tests but listed here so future createTicket tests don't throw.
  query: jest.fn(),
};

jest.mock('../../../../data-source', () => ({
  AppDataSource: {
    getRepository: jest.fn(() => mockTicketRepo),
  },
}));

jest.mock('../../../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Import after mocks
import { TicketService } from '../../../../services/communication/tickets/TicketService';

describe('TicketService — typed error contract', () => {
  let service: TicketService;
  const ticketId = 'ticket-1';

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton so each test gets a fresh instance backed by the mocked repository
    (TicketService as unknown as { instance: null }).instance = null;
    service = new TicketService();
  });

  describe('not-found guards throw NotFoundError (404)', () => {
    const expectNotFound = async (op: Promise<unknown>): Promise<void> => {
      const error = await op.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(NotFoundError);
      expect((error as NotFoundError).statusCode).toBe(404);
      expect((error as NotFoundError).message).toBe('Ticket not found');
    };

    beforeEach(() => {
      jest.spyOn(service, 'getTicketById').mockResolvedValue(null);
    });

    it('updateTicket', async () => {
      await expectNotFound(service.updateTicket(ticketId, { subject: 'x' }));
    });

    it('addMessage', async () => {
      await expectNotFound(
        service.addMessage(ticketId, { authorId: 'u1', authorName: 'U', content: 'hi' })
      );
    });

    it('assignTicket', async () => {
      await expectNotFound(service.assignTicket(ticketId, 'u2', 'Assignee', 'admin'));
    });

    it('resolveTicket', async () => {
      await expectNotFound(
        service.resolveTicket(ticketId, { resolution: 'done', resolvedBy: 'u1' })
      );
    });

    it('closeTicket', async () => {
      await expectNotFound(service.closeTicket(ticketId));
    });

    it('reopenTicket', async () => {
      await expectNotFound(service.reopenTicket(ticketId));
    });

    it('addFeedback', async () => {
      await expectNotFound(service.addFeedback(ticketId, 5));
    });

    it('updateDiscordSettings', async () => {
      await expectNotFound(
        service.updateDiscordSettings(ticketId, { enabled: false, notifyOnUpdate: false })
      );
    });

    it('deleteTicket', async () => {
      await expectNotFound(service.deleteTicket(ticketId));
    });
  });

  describe('addFeedback rating validation', () => {
    beforeEach(() => {
      const ticket = new Ticket();
      ticket.id = ticketId;
      jest.spyOn(service, 'getTicketById').mockResolvedValue(ticket);
    });

    it('throws ValidationError (400) for a rating below 1', async () => {
      const error = await service.addFeedback(ticketId, 0).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });

    it('throws ValidationError (400) for a rating above 5', async () => {
      const error = await service.addFeedback(ticketId, 6).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ValidationError);
      expect((error as ValidationError).statusCode).toBe(400);
    });
  });
});
