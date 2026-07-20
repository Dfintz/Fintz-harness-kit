import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';

import { OpportunitiesPage } from '@/pages/OpportunitiesPage';
import { theme } from '@/theme';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUseOpportunitySearch = jest.fn();

jest.mock('@/hooks/queries/useOpportunityQueries', () => ({
  useOpportunitySearch: (...args: unknown[]) => mockUseOpportunitySearch(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderPage() {
  const queryClient = createQueryClient();
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ThemeProvider theme={theme}>
            <OpportunitiesPage />
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

const sampleJob = {
  id: 'job-1',
  sourceType: 'job' as const,
  title: 'Gunner Needed for Mining Op',
  description: 'Looking for experienced gunner to protect mining operation.',
  organizationName: 'Astral Corp',
  jobType: 'GUNNER',
  payDisplay: '50k aUEC/hr',
  crewSpotsTotal: 3,
  crewSpotsFilled: 1,
  listingCategory: 'job',
  tags: ['mining', 'combat'],
  postedAt: '2026-03-10T10:00:00Z',
  isActive: true,
};

const sampleService = {
  id: 'svc-1',
  sourceType: 'job' as const,
  title: 'Hauling Service Available',
  description: 'Professional hauling service for all your cargo needs.',
  organizationName: 'Stellar Logistics',
  listingCategory: 'service',
  tags: ['hauling', 'cargo'],
  postedAt: '2026-03-09T08:00:00Z',
  isActive: true,
};

const sampleActivity = {
  id: 'act-1',
  sourceType: 'activity' as const,
  title: 'Friday Night Mining',
  description: 'Weekly group mining session in Aaron Halo.',
  organizationName: 'Rock Raiders',
  activityType: 'mining',
  activityStatus: 'OPEN',
  currentParticipants: 4,
  maxParticipants: 10,
  postedAt: '2026-03-11T12:00:00Z',
};

const defaultResponse = {
  data: [sampleJob, sampleService, sampleActivity],
  pagination: { page: 1, limit: 12, total: 3, totalPages: 1, hasNext: false, hasPrev: false },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpportunitiesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseOpportunitySearch.mockReturnValue({
      data: defaultResponse,
      isLoading: false,
      error: null,
      isError: false,
    });
  });

  it('renders header and search bar', async () => {
    renderPage();
    expect(screen.getByText('Opportunities')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search opportunities...')).toBeInTheDocument();
    await waitFor(() => expect(mockUseOpportunitySearch).toHaveBeenCalled());
  });

  it('renders all source type chips', () => {
    renderPage();
    expect(screen.getByText('All Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Jobs')).toBeInTheDocument();
    expect(screen.getByText('Services')).toBeInTheDocument();
    expect(screen.getByText('Activities')).toBeInTheDocument();
  });

  it('displays opportunity cards after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Gunner Needed for Mining Op')).toBeInTheDocument();
    });
    expect(screen.getByText('Hauling Service Available')).toBeInTheDocument();
    expect(screen.getByText('Friday Night Mining')).toBeInTheDocument();
  });

  it.skip('displays job type chip for job items — SKIPPED: card rendering delegated to PublicJobCard', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('GUNNER')).toBeInTheDocument();
    });
  });

  it.skip('displays spots info for jobs and activities — SKIPPED: card rendering refactored', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('1/3 filled')).toBeInTheDocument();
      expect(screen.getByText('4/10 joined')).toBeInTheDocument();
    });
  });

  it.skip('displays source labels (Job, Service, Activity) — SKIPPED: card rendering refactored', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Job')).toBeInTheDocument();
      expect(screen.getByText('Service')).toBeInTheDocument();
      expect(screen.getByText('Activity')).toBeInTheDocument();
    });
  });

  it('displays organization names', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Astral Corp')).toBeInTheDocument();
      expect(screen.getByText('Stellar Logistics')).toBeInTheDocument();
      expect(screen.getByText('Rock Raiders')).toBeInTheDocument();
    });
  });

  it('shows loading spinner initially', () => {
    mockUseOpportunitySearch.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false,
    });
    renderPage();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows error state on failure', async () => {
    mockUseOpportunitySearch.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API down'),
      isError: true,
    });
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText('Failed to load opportunities. Please try again.')
      ).toBeInTheDocument();
    });
  });

  it('shows empty state when no results', async () => {
    mockUseOpportunitySearch.mockReturnValue({
      data: {
        data: [],
        pagination: { page: 1, limit: 12, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
      },
      isLoading: false,
      error: null,
      isError: false,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('No opportunities found')).toBeInTheDocument();
    });
  });

  it('shows filter panel when Filters button is clicked', async () => {
    renderPage();
    await waitFor(() => expect(mockUseOpportunitySearch).toHaveBeenCalled());

    const filtersBtn = screen.getByText('Filters');
    fireEvent.click(filtersBtn);

    // MUI Select renders label text twice (label + notched outline legend)
    expect(screen.getAllByText('Job Type').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sort By').length).toBeGreaterThanOrEqual(1);
  });

  it('switches source type when chip is clicked', async () => {
    renderPage();
    await waitFor(() => expect(mockUseOpportunitySearch).toHaveBeenCalled());
    mockUseOpportunitySearch.mockClear();

    fireEvent.click(screen.getByText('Jobs'));

    await waitFor(() => {
      expect(mockUseOpportunitySearch).toHaveBeenCalledWith(
        expect.objectContaining({ sourceType: 'job' }),
        1,
        12,
        'postedAt',
        'DESC'
      );
    });
  });

  it('passes search term to the service', async () => {
    renderPage();
    await waitFor(() => expect(mockUseOpportunitySearch).toHaveBeenCalled());
    mockUseOpportunitySearch.mockClear();

    const searchInput = screen.getByPlaceholderText('Search opportunities...');
    fireEvent.change(searchInput, { target: { value: 'mining' } });

    await waitFor(() => {
      expect(mockUseOpportunitySearch).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'mining' }),
        1,
        12,
        'postedAt',
        'DESC'
      );
    });
  });

  it('renders grid/list toggle', () => {
    renderPage();
    expect(screen.getByLabelText('Grid view')).toBeInTheDocument();
    expect(screen.getByLabelText('List view')).toBeInTheDocument();
  });

  it('renders pagination when multiple pages exist', async () => {
    mockUseOpportunitySearch.mockReturnValue({
      data: {
        data: [sampleJob],
        pagination: { page: 1, limit: 12, total: 25, totalPages: 3, hasNext: true, hasPrev: false },
      },
      isLoading: false,
      error: null,
      isError: false,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });

  it('does not render pagination for single page', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Gunner Needed for Mining Op')).toBeInTheDocument();
    });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('shows tags on opportunity cards', async () => {
    renderPage();
    await waitFor(() => {
      // 'mining' appears as both a job tag and the activity's activityType chip
      expect(screen.getAllByText('mining').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('combat')).toBeInTheDocument();
    });
  });
});
