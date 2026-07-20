import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { RoutePlanner } from '@/components/RoutePlanner';

const theme = createTheme();

// Mock the activity service
jest.mock('../../services/activityServiceV2', () => ({
  activityServiceV2: {
    planRoute: jest.fn(),
    updateActivity: jest.fn(),
    addRoutePlan: jest.fn(),
    updateWaypoint: jest.fn(),
  },
}));
const mockedActivityService = activityServiceV2 as jest.Mocked<typeof activityServiceV2>;

describe('RoutePlanner Component', () => {
  const mockOnUpdate = jest.fn();

  const mockActivityWithRoute = {
    id: 'activity-1',
    routePlan: [
      {
        order: 1,
        location: 'Port Olisar',
        system: 'Stanton',
        coordinates: 'X:1234, Y:5678, Z:9012',
        distance: 50000,
        estimatedTravelTime: 15,
        requiredFuel: 100,
        notes: 'Starting point',
      },
      {
        order: 2,
        location: 'Aaron Halo',
        system: 'Stanton',
        coordinates: 'X:2345, Y:6789, Z:0123',
        distance: 75000,
        estimatedTravelTime: 25,
        requiredFuel: 150,
        notes: 'Mining destination',
      },
    ],
    totalDistance: 125000,
    totalEstimatedTime: 40,
  };

  const mockActivityNoRoute = {
    id: 'activity-2',
    routePlan: [],
  };

  const renderWithThemeProvider = (activity: any) => {
    return render(
      <ThemeProvider theme={theme}>
        <RoutePlanner activity={activity} onUpdate={mockOnUpdate} />
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedActivityService.addRoutePlan as jest.Mock).mockResolvedValue({});
    (mockedActivityService.updateWaypoint as jest.Mock).mockResolvedValue({});
  });

  it('renders Route Planning header', () => {
    renderWithThemeProvider(mockActivityNoRoute);

    expect(screen.getByText('Route Planning')).toBeInTheDocument();
  });

  it('renders Add Waypoint button', () => {
    renderWithThemeProvider(mockActivityNoRoute);

    expect(screen.getByText('Add Waypoint')).toBeInTheDocument();
  });

  it('displays empty state when no route exists', () => {
    renderWithThemeProvider(mockActivityNoRoute);

    expect(screen.getByText(/No route plan yet/)).toBeInTheDocument();
  });

  it('displays Route Waypoints header when route exists', () => {
    renderWithThemeProvider(mockActivityWithRoute);

    expect(screen.getByText('Route Waypoints')).toBeInTheDocument();
  });

  it('displays waypoint locations', () => {
    renderWithThemeProvider(mockActivityWithRoute);

    expect(screen.getByText('Port Olisar')).toBeInTheDocument();
    expect(screen.getByText('Aaron Halo')).toBeInTheDocument();
  });

  it('displays waypoint systems', () => {
    renderWithThemeProvider(mockActivityWithRoute);

    // Both are Stanton, should appear multiple times
    const stantonElements = screen.getAllByText('Stanton');
    expect(stantonElements.length).toBeGreaterThanOrEqual(2);
  });

  it('displays total distance', () => {
    renderWithThemeProvider(mockActivityWithRoute);

    expect(screen.getByText('Total Distance')).toBeInTheDocument();
  });

  it('displays total travel time', () => {
    renderWithThemeProvider(mockActivityWithRoute);

    expect(screen.getByText('Total Travel Time')).toBeInTheDocument();
  });

  it('displays waypoint count', () => {
    renderWithThemeProvider(mockActivityWithRoute);

    expect(screen.getByText('Waypoints')).toBeInTheDocument();
    // Use getAllByText since "2" appears multiple times
    const twoElements = screen.getAllByText('2');
    expect(twoElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays waypoint notes', () => {
    renderWithThemeProvider(mockActivityWithRoute);

    expect(screen.getByText('Starting point')).toBeInTheDocument();
    expect(screen.getByText('Mining destination')).toBeInTheDocument();
  });

  it('shows waypoint form when Add Waypoint is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(mockActivityNoRoute);

    await user.click(screen.getByText('Add Waypoint'));

    expect(screen.getByPlaceholderText('e.g., Aaron Halo')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g., Stanton')).toBeInTheDocument();
  });

  it('shows Cancel button when form is open', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(mockActivityNoRoute);

    await user.click(screen.getByText('Add Waypoint'));

    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('hides form when Cancel is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(mockActivityNoRoute);

    await user.click(screen.getByText('Add Waypoint'));
    await user.click(screen.getByText('Cancel'));

    expect(screen.queryByPlaceholderText('e.g., Aaron Halo')).not.toBeInTheDocument();
  });

  it('calls addRoutePlan when waypoint form is submitted', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(mockActivityNoRoute);

    // Click add waypoint to show form
    const addButton = screen.getByRole('button', { name: /Add Waypoint/i });
    await user.click(addButton);

    // Fill in required fields using placeholder text
    const locationInput = screen.getByPlaceholderText('e.g., Aaron Halo');
    const systemInput = screen.getByPlaceholderText('e.g., Stanton');

    await user.type(locationInput, 'New Location');
    await user.type(systemInput, 'Pyro');

    // Submit form - find the button inside the form section
    const submitButtons = screen.getAllByRole('button', { name: /Add Waypoint/i });
    // Click the last one which should be the submit button
    const submitButton = submitButtons[submitButtons.length - 1];
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockedActivityService.addRoutePlan).toHaveBeenCalled();
    });
  });
});
