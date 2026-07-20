import { Fleet } from '@/pages/Fleet';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import React from 'react';
import { BrowserRouter } from 'react-router-dom';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock FleetManager component since Fleet just wraps it
jest.mock('../../components/FleetManager', () => ({
  FleetManager: function MockFleetManager() {
    return <div data-testid="fleet-manager">Fleet Manager Component</div>;
  },
}));

describe('Fleet Page', () => {
  const renderWithThemeProviders = (component: React.ReactElement) => {
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>{component}</ThemeProvider>
      </BrowserRouter>
    );
  };

  it('renders FleetManager component', () => {
    renderWithThemeProviders(<Fleet />);

    expect(screen.getByTestId('fleet-manager')).toBeInTheDocument();
  });

  it('passes rendering without error', () => {
    const { container } = renderWithThemeProviders(<Fleet />);

    expect(container).toBeInTheDocument();
  });

  it('renders FleetManager wrapper', () => {
    renderWithThemeProviders(<Fleet />);

    expect(screen.getByTestId('fleet-manager')).toBeInTheDocument();
  });
});
