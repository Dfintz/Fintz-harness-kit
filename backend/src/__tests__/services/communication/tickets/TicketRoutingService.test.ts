import {
  TicketRoutingService,
  type TicketForRouting,
  type RoutingCondition,
} from '../../../../services/communication/tickets/TicketRoutingService';
import { TicketCategory, TicketPriority } from '../../../../models/Ticket';

describe('TicketRoutingService list membership evaluation', () => {
  let service: TicketRoutingService;

  const baseTicket: TicketForRouting = {
    category: TicketCategory.GENERAL,
    priority: TicketPriority.MEDIUM,
    subject: 'General issue',
    description: 'Something happened',
    tags: ['urgent', 'billing'],
    creatorId: 'user-1',
    creatorDiscordId: 'discord-1',
    creatorEmail: 'test@example.com',
  };

  beforeEach(() => {
    (TicketRoutingService as unknown as { instance?: TicketRoutingService }).instance = undefined;
    service = TicketRoutingService.getInstance();
  });

  function evaluateCondition(condition: RoutingCondition, ticket: TicketForRouting): boolean {
    const result = service.testRule(
      {
        name: 'test',
        description: 'test',
        organizationId: 'org-1',
        isActive: true,
        priority: 1,
        conditions: [condition],
        conditionLogic: 'AND',
        actions: [{ type: 'escalate', value: 'leadership' }],
        createdBy: 'tester',
      },
      ticket
    );

    return result.matched;
  }

  it('should match in_list when any tag is in condition list', () => {
    const matched = evaluateCondition(
      {
        field: 'tags',
        operator: 'in_list',
        value: ['security', 'billing'],
      },
      baseTicket
    );

    expect(matched).toBe(true);
  });

  it('should match not_in_list when all tags are absent from condition list', () => {
    const matched = evaluateCondition(
      {
        field: 'tags',
        operator: 'not_in_list',
        value: ['security', 'moderation'],
      },
      baseTicket
    );

    expect(matched).toBe(true);
  });

  it('should not match not_in_list when any tag exists in condition list', () => {
    const matched = evaluateCondition(
      {
        field: 'tags',
        operator: 'not_in_list',
        value: ['billing', 'moderation'],
      },
      baseTicket
    );

    expect(matched).toBe(false);
  });

  it('should preserve scalar field behavior for in_list', () => {
    const matched = evaluateCondition(
      {
        field: 'category',
        operator: 'in_list',
        value: [TicketCategory.RECRUITMENT, TicketCategory.GENERAL],
      },
      baseTicket
    );

    expect(matched).toBe(true);
  });
});
