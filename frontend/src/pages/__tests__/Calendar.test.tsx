import { CalendarPageWithErrorBoundary as CalendarPage } from '@/pages/Calendar';
import { apiClient } from '@/services/apiClient';
import { eventService } from '@/services/eventService';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock event service
jest.mock('../../services/eventService');
const mockedEventService = eventService as jest.Mocked<typeof eventService>;

// Mock apiClient (used for activities fetch)
jest.mock('../../services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));
const mockedApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Mock auth store
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn((selector: any) =>
    selector({ user: { id: 'user-1', activeOrgId: 'org-1' } })
  ),
}));

describe('Calendar Page', () => {
  const mockEvents = [
    {
      id: 'event-1',
      title: 'Mining Operation',
      description: 'Group mining session at Yela',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
      location: 'Yela',
      attendees: ['user-1', 'user-2'],
      attendeesDetailed: [
        { userId: 'user-1', role: 'pilot', status: 'accepted', shipName: 'Prospector' },
        { userId: 'user-2', role: 'pilot', status: 'accepted', shipName: 'MOLE' },
      ],
    },
    {
      id: 'event-2',
      title: 'Cargo Run',
      description: 'Trading route from Lorville to New Babbage',
      date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // Day after tomorrow
      location: 'Lorville',
      attendees: ['user-3'],
      roleRequirements: { pilot: 2, gunner: 1 },
    },
  ];

  const render = (component: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    return rtlRender(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>{component}</ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: activities endpoint returns empty
    (mockedApiClient.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  it('displays loading state initially', () => {
    mockedEventService.getEvents.mockImplementation(() => new Promise(() => {}));
    (mockedApiClient.get as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<CalendarPage />);

    expect(screen.getByText(/Loading calendar/)).toBeInTheDocument();
  });

  it('displays page Typography after loading', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText(/Plan and manage upcoming operations/)).toBeInTheDocument();
    });
  });

  it('displays page description', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Plan and manage upcoming operations and events/)
      ).toBeInTheDocument();
    });
  });

  it('displays events when loaded', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('Mining Operation')).toBeInTheDocument();
      expect(screen.getByText('Cargo Run')).toBeInTheDocument();
    });
  });

  it('displays event descriptions', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('Group mining session at Yela')).toBeInTheDocument();
      expect(screen.getByText('Trading route from Lorville to New Babbage')).toBeInTheDocument();
    });
  });

  it('displays event locations', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('Yela')).toBeInTheDocument();
      expect(screen.getByText('Lorville')).toBeInTheDocument();
    });
  });

  it('displays attendee count', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText(/2 attending/)).toBeInTheDocument();
      expect(screen.getByText(/1 attending/)).toBeInTheDocument();
    });
  });

  it('displays empty state when no events', async () => {
    mockedEventService.getEvents.mockResolvedValue([]);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('No Upcoming Events')).toBeInTheDocument();
    });
  });

  it('displays empty state message', async () => {
    mockedEventService.getEvents.mockResolvedValue([]);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText(/There are no tactical operations scheduled/)).toBeInTheDocument();
    });
  });

  it('displays error message when API fails', async () => {
    mockedEventService.getEvents.mockRejectedValue(new Error('Network error'));

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch events')).toBeInTheDocument();
    });
  });

  it('displays role requirements when present', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('Role Requirements:')).toBeInTheDocument();
    });
  });

  it('displays participants section', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('Participants:')).toBeInTheDocument();
    });
  });

  it('handles paginated response format', async () => {
    mockedEventService.getEvents.mockResolvedValue(mockEvents as any);

    render(<CalendarPage />);

    await waitFor(() => {
      expect(screen.getByText('Mining Operation')).toBeInTheDocument();
    });
  });
});
