import { LfgFeedWidget } from '@/components/dashboard/LfgFeedWidget';
import * as queries from '@/hooks/queries';
import { render, screen } from '@/test-utils/test-utils';

jest.mock('@/hooks/queries', () => ({
  ...jest.requireActual('@/hooks/queries'),
  useRecommendedActivities: jest.fn(),
}));

const mockUseRecommendedActivities = queries.useRecommendedActivities as jest.MockedFunction<
  typeof queries.useRecommendedActivities
>;

describe('LfgFeedWidget', () => {
  it('renders empty state when no LFG activities', () => {
    mockUseRecommendedActivities.mockReturnValue({
      data: { activities: [], count: 0 },
      isLoading: false,
    } as ReturnType<typeof queries.useRecommendedActivities>);

    render(<LfgFeedWidget />);
    expect(screen.getByText('No active LFG posts right now')).toBeInTheDocument();
  });

  it('renders loading state', () => {
    mockUseRecommendedActivities.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof queries.useRecommendedActivities>);

    render(<LfgFeedWidget />);
    expect(screen.getByText('Loading LFG posts...')).toBeInTheDocument();
  });

  it('renders LFG activities', () => {
    mockUseRecommendedActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: 'lfg-1',
            title: 'Combat Drop Operation',
            type: 'lfg',
            status: 'open',
            organizationName: 'Stardust Fleet',
            maxParticipants: 6,
            currentParticipants: 3,
            createdAt: '2026-03-30T10:00:00Z',
            updatedAt: '2026-03-30T10:00:00Z',
            organizationId: 'org-1',
          },
          {
            id: 'lfg-2',
            title: 'Mining Escort Run',
            type: 'lfg',
            status: 'open',
            organizationName: 'Galactic Commerce',
            maxParticipants: 4,
            currentParticipants: 2,
            createdAt: '2026-03-30T10:00:00Z',
            updatedAt: '2026-03-30T10:00:00Z',
            organizationId: 'org-2',
          },
        ],
        count: 2,
      },
      isLoading: false,
    } as ReturnType<typeof queries.useRecommendedActivities>);

    render(<LfgFeedWidget />);
    expect(screen.getByText('Combat Drop Operation')).toBeInTheDocument();
    expect(screen.getByText('Mining Escort Run')).toBeInTheDocument();
    expect(screen.getByText('Stardust Fleet')).toBeInTheDocument();
    expect(screen.getByText('3 open')).toBeInTheDocument();
  });

  it('filters out non-LFG activities', () => {
    mockUseRecommendedActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: 'event-1',
            title: 'Regular Event',
            type: 'event',
            status: 'open',
            createdAt: '2026-03-30T10:00:00Z',
            updatedAt: '2026-03-30T10:00:00Z',
            organizationId: 'org-1',
          },
        ],
        count: 1,
      },
      isLoading: false,
    } as ReturnType<typeof queries.useRecommendedActivities>);

    render(<LfgFeedWidget />);
    expect(screen.getByText('No active LFG posts right now')).toBeInTheDocument();
  });

  it('renders "View All" button', () => {
    mockUseRecommendedActivities.mockReturnValue({
      data: {
        activities: [
          {
            id: 'lfg-1',
            title: 'Test LFG',
            type: 'lfg',
            status: 'open',
            createdAt: '2026-03-30T10:00:00Z',
            updatedAt: '2026-03-30T10:00:00Z',
            organizationId: 'org-1',
          },
        ],
        count: 1,
      },
      isLoading: false,
    } as ReturnType<typeof queries.useRecommendedActivities>);

    render(<LfgFeedWidget />);
    expect(screen.getByText('View All →')).toBeInTheDocument();
  });
});
