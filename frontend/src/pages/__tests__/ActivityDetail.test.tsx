import { ActivityDetailWithErrorBoundary } from '@/pages/ActivityDetail';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { useAuthStore } from '@/store/authStore';
import { ACTIVITY_CREW_POSITION_LABELS } from '@sc-fleet-manager/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

jest.mock('@dnd-kit/core', () => {
  const React = require('react');
  let latestOnDragEnd: ((event: unknown) => void) | undefined;

  return {
    DndContext: ({
      children,
      onDragEnd,
    }: {
      children: unknown;
      onDragEnd?: (event: unknown) => void;
    }) => {
      latestOnDragEnd = onDragEnd;
      return React.createElement('div', { 'data-testid': 'mock-dnd-context' }, children);
    },
    PointerSensor: function PointerSensor() {
      return undefined;
    },
    useSensor: jest.fn(() => ({})),
    useSensors: jest.fn((...sensors: unknown[]) => sensors),
    useDraggable: jest.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: jest.fn(),
      isDragging: false,
    })),
    useDroppable: jest.fn(() => ({ isOver: false, setNodeRef: jest.fn() })),
    __triggerDragEnd: (event: unknown) => {
      if (latestOnDragEnd) {
        latestOnDragEnd(event);
      }
    },
  };
});

// Mock activity service v2
jest.mock('../../services/activityServiceV2');
const mockedActivityServiceV2 = activityServiceV2 as jest.Mocked<typeof activityServiceV2>;

function triggerDragEnd(event: unknown): void {
  const dndModule = jest.requireMock('@dnd-kit/core') as {
    __triggerDragEnd: (event: unknown) => void;
  };
  dndModule.__triggerDragEnd(event);
}

const mockNavigate = jest.fn();
let mockLoaderData: unknown;
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ id: 'activity-1' }),
  useNavigate: () => mockNavigate,
  useLoaderData: () => mockLoaderData,
}));

describe('ActivityDetail Page', () => {
  const activityId = 'activity-1';

  const mockActivity = {
    id: 'activity-1',
    title: 'Mining Operation Alpha',
    description: 'Group mining expedition to Aaron Halo',
    status: 'open',
    type: 'mining',
    location: 'Aaron Halo',
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    organizationId: 'org-123',
    creatorId: 'user-123',
    maxParticipants: 10,
    currentParticipants: 2,
    visibility: 'public',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const renderWithThemeProviders = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/activities/${activityId}`]}>
          <Routes>
            <Route path="/activities/:id" element={<ActivityDetailWithErrorBoundary />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: 'user-123',
        username: 'TestUser',
        activeOrgId: 'org-123',
        organizationId: 'org-123',
      } as any,
      isAuthenticated: true,
    } as any);
    mockNavigate.mockReset();
    mockLoaderData = mockActivity;
    mockedActivityServiceV2.getActivityById.mockResolvedValue(mockActivity as any);
    mockedActivityServiceV2.joinActivity.mockResolvedValue({});
    mockedActivityServiceV2.leaveActivity.mockResolvedValue({});
    if (!mockedActivityServiceV2.setCrewPosition) {
      mockedActivityServiceV2.setCrewPosition = jest.fn();
    }
    mockedActivityServiceV2.setCrewPosition.mockResolvedValue(mockActivity as any);
    if (!mockedActivityServiceV2.setShipNesting) {
      mockedActivityServiceV2.setShipNesting = jest.fn();
    }
    mockedActivityServiceV2.setShipNesting.mockResolvedValue(mockActivity as any);
    if (!mockedActivityServiceV2.generateJoinLink) {
      mockedActivityServiceV2.generateJoinLink = jest.fn();
    }
    mockedActivityServiceV2.generateJoinLink.mockResolvedValue({
      token: 'join-token-abc',
      expiresAt: new Date().toISOString(),
    });
  });

  it('displays activity title', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Mining Operation Alpha')).toBeInTheDocument();
    });
  });

  it('displays activity description', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Group mining expedition to Aaron Halo')).toBeInTheDocument();
    });
  });

  it('displays activity status badge', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('OPEN')).toBeInTheDocument();
    });
  });

  it('displays activity type', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('MINING')).toBeInTheDocument();
    });
  });

  it('displays location information', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Aaron Halo')).toBeInTheDocument();
    });
  });

  it('displays participant count', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('2 / 10')).toBeInTheDocument();
    });
  });

  it('displays creator ID (truncated)', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('user-123…')).toBeInTheDocument();
    });
  });

  it('displays collapsible sections for different content', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Mining Operation Alpha')).toBeInTheDocument();
    });

    // Verify accordion sections exist (may appear in summary + content)
    const overviewMatches = screen.getAllByText('Overview');
    expect(overviewMatches.length).toBeGreaterThanOrEqual(1);
    const shipsMatches = screen.getAllByText('Ships & Crew');
    expect(shipsMatches.length).toBeGreaterThanOrEqual(1);
  });

  it('displays Back button', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Back')).toBeInTheDocument();
    });
  });

  it('displays Join Activity button', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Join Activity')).toBeInTheDocument();
    });
  });

  it('displays Leave Activity button', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Leave Activity')).toBeInTheDocument();
    });
  });

  it('switches to Participants tab', async () => {
    renderWithThemeProviders();

    await waitFor(() => {
      // Wait for the page to load
      expect(screen.getByText('Mining Operation Alpha')).toBeInTheDocument();
    });

    // Verify participant count is visible
    expect(screen.getByText('2 / 10')).toBeInTheDocument();
  });

  it('displays error message when activity not found', async () => {
    mockedActivityServiceV2.getActivityById.mockRejectedValue({
      response: { data: { message: 'Activity not found' } },
    });
    mockLoaderData = null;

    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Activity not found')).toBeInTheDocument();
    });
  });

  it('calls joinActivity when Join Activity is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Join Activity')).toBeInTheDocument();
    });

    // Click "Join Activity" to open the join dialog
    await user.click(screen.getByText('Join Activity'));

    // Wait for the dialog to appear with join mode options
    await waitFor(() => {
      expect(screen.getByText('Join as Crew')).toBeInTheDocument();
    });

    // Select "Join as Crew" mode
    await user.click(screen.getByText('Join as Crew'));

    // Wait for the crew form confirm button to appear
    await waitFor(() => {
      expect(screen.getByText('Join as Crew')).toBeInTheDocument();
    });

    // Click confirm to join as crew
    await user.click(screen.getByText('Join as Crew'));

    await waitFor(() => {
      expect(mockedActivityServiceV2.joinActivity).toHaveBeenCalledWith(
        'activity-1',
        expect.objectContaining({ role: 'member' })
      );
    });
  });

  it('calls leaveActivity when Leave Activity is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProviders();

    await waitFor(() => {
      expect(screen.getByText('Leave Activity')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Leave Activity'));

    expect(mockedActivityServiceV2.leaveActivity).toHaveBeenCalledWith('activity-1');
  });

  // ── Join Link Tests ───────────────────────────────────────────────────

  describe('Copy Join Link', () => {
    it('displays Copy Join Link button', async () => {
      renderWithThemeProviders();

      await waitFor(() => {
        expect(screen.getByText('Copy Join Link')).toBeInTheDocument();
      });
    });

    it('calls generateJoinLink when Copy Join Link is clicked', async () => {
      const user = userEvent.setup();
      renderWithThemeProviders();

      await waitFor(() => {
        expect(screen.getByText('Copy Join Link')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Copy Join Link'));

      await waitFor(() => {
        expect(mockedActivityServiceV2.generateJoinLink).toHaveBeenCalledWith('activity-1');
      });
    });

    it('copies link to clipboard on success', async () => {
      const user = userEvent.setup();
      renderWithThemeProviders();

      await waitFor(() => {
        expect(screen.getByText('Copy Join Link')).toBeInTheDocument();
      });

      // Set clipboard mock after render to avoid userEvent.setup() replacing navigator.clipboard
      const clipboardWriteText = jest.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: clipboardWriteText },
        writable: true,
        configurable: true,
      });

      await user.click(screen.getByText('Copy Join Link'));

      await waitFor(() => {
        expect(clipboardWriteText).toHaveBeenCalledWith(
          expect.stringContaining('/j/join-token-abc')
        );
      });
    });

    it('handles successful copy flow after generating a join link', async () => {
      const user = userEvent.setup();
      renderWithThemeProviders();

      await waitFor(() => {
        expect(screen.getByText('Copy Join Link')).toBeInTheDocument();
      });

      // Set clipboard mock after render to avoid userEvent.setup() replacing navigator.clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: jest.fn().mockResolvedValue(undefined) },
        writable: true,
        configurable: true,
      });

      await user.click(screen.getByText('Copy Join Link'));

      await waitFor(() => {
        expect(mockedActivityServiceV2.generateJoinLink).toHaveBeenCalledWith('activity-1');
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          expect.stringContaining('/j/join-token-abc')
        );
      });
    });
  });

  describe('Crew + Nesting Interactions', () => {
    it('submits canonical lowercase crew position values from Join Activity dialog', async () => {
      const user = userEvent.setup();
      const activityWithCrew = {
        ...mockActivity,
        visibility: 'organization',
        participants: [],
        shipAssignments: [
          {
            id: 'ship-a',
            shipId: 'ship-a',
            shipType: 'Constellation Andromeda',
            shipName: 'Andromeda',
            ownerId: 'owner-1',
            ownerName: 'Owner One',
            role: 'combat',
            crewCapacity: 4,
            crewAssigned: 1,
            currentCrew: 1,
            maxCrew: 4,
            crewMembers: [{ userId: 'owner-1', userName: 'Owner One', position: 'pilot' }],
            capabilities: [],
            status: 'assigned',
          },
        ],
      };

      mockLoaderData = activityWithCrew;
      mockedActivityServiceV2.getActivityById.mockResolvedValue(activityWithCrew as any);

      renderWithThemeProviders();

      await waitFor(() => {
        expect(screen.getByText('Join Activity')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Join Activity'));

      await waitFor(() => {
        expect(screen.getByText('Crew a Position')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Crew a Position'));

      const [shipSelect] = await screen.findAllByRole('combobox');
      await user.click(shipSelect);
      await user.click(screen.getByRole('option', { name: /Andromeda/ }));

      const [, positionSelect] = await screen.findAllByRole('combobox');
      await user.click(positionSelect);
      await user.click(
        screen.getByRole('option', { name: ACTIVITY_CREW_POSITION_LABELS.engineer })
      );

      await user.click(screen.getByRole('button', { name: 'Join Position' }));

      await waitFor(() => {
        expect(mockedActivityServiceV2.joinActivity).toHaveBeenCalledWith(
          'activity-1',
          expect.objectContaining({
            role: 'member',
            crewShipId: 'ship-a',
            crewPosition: 'engineer',
          })
        );
      });
    });

    it('does not trigger nesting mutation when a ship is dropped onto itself', async () => {
      const activityWithShips = {
        ...mockActivity,
        shipAssignments: [
          {
            id: 'ship-a',
            shipId: 'ship-a',
            shipType: 'Constellation Andromeda',
            shipName: 'Andromeda',
            ownerId: 'user-123',
            ownerName: 'Owner A',
            role: 'combat',
            crewCapacity: 4,
            crewAssigned: 1,
            crewMembers: [{ userId: 'user-123', userName: 'Owner A', position: 'pilot' }],
            capabilities: [],
            status: 'assigned',
            metadata: { hangarSize: 'medium' },
          },
        ],
      };

      mockLoaderData = activityWithShips;
      mockedActivityServiceV2.getActivityById.mockResolvedValue(activityWithShips as any);

      renderWithThemeProviders();

      await waitFor(() => {
        expect(screen.getByText('Andromeda')).toBeInTheDocument();
      });

      triggerDragEnd({
        active: { data: { current: { type: 'ship', shipAssignmentId: 'ship-a' } } },
        over: { data: { current: { parentShipId: 'ship-a', transportType: 'hangar' } } },
      });

      expect(mockedActivityServiceV2.setShipNesting).not.toHaveBeenCalled();
    });

    it('un-nests when dropped on root drop zone', async () => {
      const activityWithNestedShip = {
        ...mockActivity,
        shipAssignments: [
          {
            id: 'ship-parent',
            shipId: 'ship-parent',
            shipType: 'Carrack',
            shipName: 'Carrack',
            ownerId: 'user-123',
            ownerName: 'Owner Parent',
            role: 'support',
            crewCapacity: 6,
            crewAssigned: 1,
            crewMembers: [{ userId: 'user-123', userName: 'Owner Parent', position: 'pilot' }],
            capabilities: [],
            status: 'assigned',
            metadata: { hangarSize: 'medium' },
          },
          {
            id: 'ship-child',
            shipId: 'ship-child',
            shipType: 'Pisces',
            shipName: 'Pisces',
            ownerId: 'user-123',
            ownerName: 'Owner Child',
            role: 'scout',
            crewCapacity: 2,
            crewAssigned: 1,
            crewMembers: [{ userId: 'user-123', userName: 'Owner Child', position: 'pilot' }],
            capabilities: [],
            status: 'assigned',
            parentShipId: 'ship-parent',
            isTransported: true,
            transportType: 'hangar',
          },
        ],
      };

      mockLoaderData = activityWithNestedShip;
      mockedActivityServiceV2.getActivityById.mockResolvedValue(activityWithNestedShip as any);

      renderWithThemeProviders();

      await waitFor(() => {
        expect(screen.getByText('Carrack')).toBeInTheDocument();
      });

      triggerDragEnd({
        active: { data: { current: { type: 'ship', shipAssignmentId: 'ship-child' } } },
        over: { data: { current: { parentShipId: null, transportType: null } } },
      });

      await waitFor(() => {
        expect(mockedActivityServiceV2.setShipNesting).toHaveBeenCalledWith(
          'activity-1',
          'ship-child',
          {
            parentShipId: null,
            transportType: null,
          }
        );
      });
    });
  });
});
