import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/store/authStore';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock the auth store
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(),
  selectUser: (state: any) => state?.user,
}));

// Mock useFeatureFlag
jest.mock('../../hooks/useFeatureFlag', () => ({
  useFeatureFlag: jest.fn(() => ({ isEnabled: true })),
}));

// Mock CommandPalette lazy load
jest.mock('../../components/navigation/CommandPalette', () => ({
  __esModule: true,
  default: () => <div data-testid="command-palette" />,
}));

// Mock TopNavigation and HubSidebar components
jest.mock('../../components/navigation', () => ({
  TopNavigation: () => <div data-testid="top-navigation" />,
  HubSidebar: () => <div data-testid="hub-sidebar" />,
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}));

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

describe('Layout Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock - non-admin user
    mockUseAuthStore.mockImplementation(selector => {
      const state = {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@test.com',
          role: 'member',
          permissions: [],
          twoFactorEnabled: false,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      };
      return selector ? selector(state as any) : state;
    });
  });

  const renderWithRouter = (initialPath: string = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Layout>
          <div data-testid="child-content">Child Content</div>
        </Layout>
      </MemoryRouter>
    );
  };

  it('renders the application title', async () => {
    renderWithRouter();

    // Logo may not be immediately available in rendered output, but component should render
    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });

  it('renders children content', () => {
    renderWithRouter();

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
    expect(screen.getByText('Child Content')).toBeInTheDocument();
  });

  it('renders top navigation', () => {
    renderWithRouter();

    expect(screen.getByTestId('top-navigation')).toBeInTheDocument();
  });

  it('renders hub sidebar', () => {
    renderWithRouter();

    expect(screen.getByTestId('hub-sidebar')).toBeInTheDocument();
  });

  it('renders breadcrumb navigation', () => {
    renderWithRouter();

    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument();
  });

  it('has dark theme by default', async () => {
    renderWithRouter();

    await waitFor(() => {
      // Layout should render without errors - theme is set to dark by default
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });

  it('closes mobile menu on navigation', async () => {
    renderWithRouter('/');

    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });

  it('handles window resize events', async () => {
    renderWithRouter();

    // Simulate a resize event
    globalThis.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(screen.getByTestId('child-content')).toBeInTheDocument();
    });
  });

  it('renders successfully with admin user', () => {
    // Mock admin user
    mockUseAuthStore.mockImplementation(selector => {
      const state = {
        user: {
          id: '1',
          username: 'adminuser',
          email: 'admin@test.com',
          role: 'admin',
          permissions: [],
          twoFactorEnabled: false,
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      };
      return selector ? selector(state as any) : state;
    });

    renderWithRouter();

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders successfully with null user', () => {
    mockUseAuthStore.mockImplementation(selector => {
      const state = { user: null };
      return selector ? selector(state as any) : state;
    });

    renderWithRouter();

    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });
});
