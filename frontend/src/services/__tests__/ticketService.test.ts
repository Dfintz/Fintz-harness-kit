import { apiClient } from '@/services/apiClient';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
  ticketService,
  type Ticket,
} from '@/services/ticketService';

jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

function buildTicket(id: string, category: TicketCategory = TicketCategory.GENERAL): Ticket {
  const now = new Date();
  return {
    id,
    ticketNumber: `TKT-${id}`,
    subject: 'Test Ticket',
    description: 'Description',
    category,
    priority: TicketPriority.MEDIUM,
    status: TicketStatus.OPEN,
    creatorId: 'user-1',
    creatorName: 'User One',
    assignmentHistory: [],
    messages: [],
    tags: [],
    slaBreached: false,
    createdAt: now,
    updatedAt: now,
  };
}

describe('ticketService parsing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('parses raw paginated ticket response', async () => {
    const first = buildTicket('0001');
    const second = buildTicket('0002', TicketCategory.HR);

    mockApiClient.get.mockResolvedValue({
      data: [first, second],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    } as never);

    const result = await ticketService.getTickets({ status: 'open' });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.data[1].category).toBe(TicketCategory.HR);
  });

  it('parses envelope ticket response', async () => {
    const ticket = buildTicket('0003', TicketCategory.DIPLOMACY);

    mockApiClient.get.mockResolvedValue({
      success: true,
      data: ticket,
    } as never);

    const result = await ticketService.getTicket('0003');

    expect(result.id).toBe('0003');
    expect(result.category).toBe(TicketCategory.DIPLOMACY);
  });
});
