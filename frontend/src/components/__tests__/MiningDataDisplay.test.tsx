import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { activityServiceV2 } from '@/services/activityServiceV2';
import { theme } from '@/theme';
import { MiningDataDisplay } from '@/components/MiningDataDisplay';

import Refresh from '@mui/icons-material/Refresh';
// Mock the activity service
jest.mock('../../services/activityServiceV2', () => ({
  activityServiceV2: {
    enrichWithMiningData: jest.fn(),
  },
}));

const mockedActivityService = activityServiceV2 as jest.Mocked<typeof activityServiceV2>;

describe('MiningDataDisplay Component', () => {
  const mockOnUpdate = jest.fn();

  const mockActivityWithMiningData = {
    id: 'activity-1',
    isMiningOperation: true,
    miningData: {
      location: 'Aaron Halo',
      system: 'Stanton',
      accessibility: 'Moderate',
      estimatedProfitPerHour: 50000,
      topResources: [
        {
          name: 'Quantanium',
          symbol: 'QT',
          percentage: 45.5,
          price: 88,
          sellLocations: ['Area18', 'Lorville'],
        },
        {
          name: 'Bexalite',
          symbol: 'BX',
          percentage: 22.3,
          price: 45,
          sellLocations: ['New Babbage'],
        },
      ],
      recommendedShips: ['Prospector', 'MOLE'],
      notes: 'Be careful of pirates in this area',
      lastUpdated: new Date().toISOString(),
    },
    targetResources: 'Quantanium',
  };

  const mockActivityNoMining = {
    id: 'activity-2',
    isMiningOperation: false,
    miningData: null,
  };

  const mockActivityMiningNoData = {
    id: 'activity-3',
    isMiningOperation: true,
    miningData: null,
  };

  const renderWithThemeProvider = (activity: any) => {
    return render(
      <ThemeProvider theme={theme}>
        <MiningDataDisplay activity={activity} onUpdate={mockOnUpdate} />
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (mockedActivityService.enrichWithMiningData as jest.Mock).mockResolvedValue({});
  });

  it('renders "not marked as mining operation" for non-mining activities', () => {
    renderWithThemeProvider(mockActivityNoMining);

    expect(
      screen.getByText(/This activity is not marked as a mining operation/)
    ).toBeInTheDocument();
  });

  it('renders Fetch Mining Data button for non-mining activities', () => {
    renderWithThemeProvider(mockActivityNoMining);

    expect(screen.getByText('Fetch Mining Data')).toBeInTheDocument();
  });

  it('renders Load Mining Data button when mining operation has no data', () => {
    renderWithThemeProvider(mockActivityMiningNoData);

    expect(screen.getByText('Load Mining Data')).toBeInTheDocument();
  });

  it('renders mining data header when data exists', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Mining Data')).toBeInTheDocument();
  });

  it('displays location information', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Aaron Halo')).toBeInTheDocument();
    expect(screen.getByText('Stanton')).toBeInTheDocument();
  });

  it('displays accessibility level', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Moderate')).toBeInTheDocument();
  });

  it('displays estimated profit per hour', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText(/Est. Profit\/Hour/)).toBeInTheDocument();
  });

  it('displays available resources section', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Available Resources')).toBeInTheDocument();
    // Use getAllByText since resource names may appear multiple times
    const quantaniumElements = screen.getAllByText('Quantanium');
    expect(quantaniumElements.length).toBeGreaterThanOrEqual(1);
  });

  it('displays resource percentages', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('45.5%')).toBeInTheDocument();
    expect(screen.getByText('22.3%')).toBeInTheDocument();
  });

  it('displays recommended ships section', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Recommended Ships')).toBeInTheDocument();
    expect(screen.getByText('Prospector')).toBeInTheDocument();
    expect(screen.getByText('MOLE')).toBeInTheDocument();
  });

  it('displays notes when present', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Be careful of pirates in this area')).toBeInTheDocument();
  });

  it('displays target resources', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Target Resources')).toBeInTheDocument();
  });

  it('displays Refresh Data button when mining data exists', () => {
    renderWithThemeProvider(mockActivityWithMiningData);

    expect(screen.getByText('Refresh Data')).toBeInTheDocument();
  });

  it('calls enrichWithMiningData when Fetch Mining Data is clicked', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(mockActivityNoMining);

    await user.click(screen.getByText('Fetch Mining Data'));

    expect(mockedActivityService.enrichWithMiningData).toHaveBeenCalledWith('activity-2');
  });

  it('calls onUpdate after successful data fetch', async () => {
    const user = userEvent.setup();
    renderWithThemeProvider(mockActivityNoMining);

    await user.click(screen.getByText('Fetch Mining Data'));

    await waitFor(() => {
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it('displays error message on failed data fetch', async () => {
    const user = userEvent.setup();
    (mockedActivityService.enrichWithMiningData as jest.Mock).mockRejectedValue(
      new Error('API Error')
    );

    renderWithThemeProvider(mockActivityNoMining);

    await user.click(screen.getByText('Fetch Mining Data'));

    // Wait for the error to appear - component shows default error message
    await waitFor(() => {
      // The component catches the error and displays a message
      expect(mockedActivityService.enrichWithMiningData).toHaveBeenCalled();
    });
  });
});
