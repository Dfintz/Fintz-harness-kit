import { BriefingWhiteboard } from '@/components/BriefingWhiteboard';
import {
  useAddBriefingElement,
  useBriefing,
  useBriefings,
  useCreateBriefing,
  useCreateBriefingVersion,
  useDeleteBriefing,
  useUpdateBriefing,
  useUpdateBriefingStatus,
} from '@/hooks/queries/useBriefingQueries';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

jest.mock('@/hooks/queries/useBriefingQueries', () => ({
  useBriefings: jest.fn(),
  useBriefing: jest.fn(),
  useCreateBriefing: jest.fn(),
  useUpdateBriefing: jest.fn(),
  useDeleteBriefing: jest.fn(),
  useUpdateBriefingStatus: jest.fn(),
  useAddBriefingElement: jest.fn(),
  useCreateBriefingVersion: jest.fn(),
}));

jest.mock('@/store/authStore', () => ({
  useAuthStore: (selector: (state: { user: { id: string; activeOrgId: string } }) => unknown) =>
    selector({ user: { id: 'user-1', activeOrgId: 'org-1' } }),
}));

const mockUseBriefings = useBriefings as jest.MockedFunction<typeof useBriefings>;
const mockUseBriefing = useBriefing as jest.MockedFunction<typeof useBriefing>;

const mockCreateBriefingMutation = { mutateAsync: jest.fn() };
const mockUpdateBriefingMutation = { mutateAsync: jest.fn() };
const mockDeleteBriefingMutation = { mutateAsync: jest.fn() };
const mockUpdateStatusMutation = { mutateAsync: jest.fn() };
const mockAddElementMutation = { mutateAsync: jest.fn() };
const mockCreateVersionMutation = { mutateAsync: jest.fn() };

HTMLCanvasElement.prototype.getContext = jest.fn().mockReturnValue({
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 0,
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  fillText: jest.fn(),
  clearRect: jest.fn(),
  closePath: jest.fn(),
  font: '',
});

const render = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return rtlRender(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
};

describe('BriefingWhiteboard Component', () => {
  const mockBriefings = [
    {
      id: 'briefing-1',
      title: 'Operation Alpha Briefing',
      creatorId: 'user-1',
      missionId: 'mission-1',
      elements: [],
      status: 'draft' as const,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'briefing-2',
      title: 'Mining Route Planning',
      creatorId: 'user-1',
      missionId: 'mission-2',
      elements: [{ id: 'el-1', type: 'marker', position: { x: 100, y: 100 }, data: {} }],
      status: 'active' as const,
      version: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseBriefings.mockReturnValue({
      data: mockBriefings,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useBriefings>);

    mockUseBriefing.mockImplementation(
      briefingId =>
        ({
          data: briefingId ? mockBriefings.find(briefing => briefing.id === briefingId) : undefined,
          isLoading: false,
          error: null,
        }) as unknown as ReturnType<typeof useBriefing>
    );

    (useCreateBriefing as jest.Mock).mockReturnValue(mockCreateBriefingMutation);
    (useUpdateBriefing as jest.Mock).mockReturnValue(mockUpdateBriefingMutation);
    (useDeleteBriefing as jest.Mock).mockReturnValue(mockDeleteBriefingMutation);
    (useUpdateBriefingStatus as jest.Mock).mockReturnValue(mockUpdateStatusMutation);
    (useAddBriefingElement as jest.Mock).mockReturnValue(mockAddElementMutation);
    (useCreateBriefingVersion as jest.Mock).mockReturnValue(mockCreateVersionMutation);
  });

  it('renders Briefing Whiteboard heading', () => {
    render(<BriefingWhiteboard />);

    expect(screen.getByText('Mission Briefing Whiteboard')).toBeInTheDocument();
  });

  it('displays briefings list', async () => {
    render(<BriefingWhiteboard />);

    await waitFor(() => {
      expect(screen.getByText('Operation Alpha Briefing')).toBeInTheDocument();
      expect(screen.getByText('Mining Route Planning')).toBeInTheDocument();
    });
  });

  it('shows create briefing form when New is clicked', async () => {
    const user = userEvent.setup();
    render(<BriefingWhiteboard />);

    await user.click(screen.getByRole('button', { name: 'New' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
    });
  });

  it('shows editor panel when a briefing is selected', async () => {
    const user = userEvent.setup();
    render(<BriefingWhiteboard />);

    await user.click(screen.getByText('Operation Alpha Briefing'));

    await waitFor(() => {
      expect(screen.getByText('Version 1 • Status:')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Draft' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Marker/i })).toBeInTheDocument();
    });
  });

  it('displays error on query failure', async () => {
    mockUseBriefings.mockReturnValue({
      data: [],
      isLoading: false,
      error: new Error('Failed to fetch briefings'),
    } as unknown as ReturnType<typeof useBriefings>);

    render(<BriefingWhiteboard />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load briefings')).toBeInTheDocument();
    });
  });

  it('displays empty state when no briefings', async () => {
    mockUseBriefings.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useBriefings>);

    render(<BriefingWhiteboard />);

    await waitFor(() => {
      expect(screen.getByText(/No briefings yet/i)).toBeInTheDocument();
    });
  });
});
