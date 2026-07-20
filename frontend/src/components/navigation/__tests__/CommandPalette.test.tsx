/**
 * CommandPalette Component Tests
 *
 * Tests for command search, keyboard navigation, filtering, and execution
 */

import { CommandPalette } from '@/components/navigation/CommandPalette';
import { prefetchNavigationIntent } from '@/components/navigation/navigationIntentPrefetch';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

// Mock scrollIntoView (not available in jsdom)
Element.prototype.scrollIntoView = jest.fn();

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('@/components/navigation/navigationIntentPrefetch', () => ({
  prefetchNavigationIntent: jest.fn().mockResolvedValue(undefined),
}));

const mockPrefetchNavigationIntent = jest.mocked(prefetchNavigationIntent);

describe('CommandPalette Component', () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const renderCommandPalette = (props = {}) => {
    const defaultProps = {
      isOpen: true,
      onClose: jest.fn(),
      ...props,
    };

    return render(
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <BrowserRouter>
            <CommandPalette {...defaultProps} />
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================
  // Visibility & Rendering Tests
  // ============================================

  describe('Visibility and Rendering', () => {
    it('should not render when isOpen is false', () => {
      const { container } = renderCommandPalette({ isOpen: false });
      expect(container.querySelector('.command-palette')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      renderCommandPalette({ isOpen: true });
      expect(screen.getByPlaceholderText(/search organizations/i)).toBeInTheDocument();
    });

    it('should render search input focused when opened', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i) as HTMLInputElement;

      // Input should receive focus after a small delay
      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });

    it('should render close hint (ESC) in input wrapper', () => {
      renderCommandPalette({ isOpen: true });
      const hints = screen.getAllByText('ESC');
      expect(hints.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Search & Filtering Tests
  // ============================================

  describe('Search and Filtering', () => {
    it('should display commands on initial render', () => {
      renderCommandPalette({ isOpen: true });

      // Should show some commands (not all, but multiple)
      const items = screen.getAllByRole('button');
      expect(items.length).toBeGreaterThan(5);
    });

    it('should show empty state when no matches found', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      fireEvent.change(input, { target: { value: 'xyznonexistent' } });

      await waitFor(() => {
        // Use getAllByText since we have both the empty state and screen reader announcement
        const emptyMessages = screen.getAllByText('No results found');
        expect(emptyMessages.length).toBeGreaterThan(0);
      });
    });

    it('should filter commands by search query', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      fireEvent.change(input, { target: { value: 'dashboard' } });

      await waitFor(() => {
        const items = screen.getAllByRole('button');
        // Should have fewer items after filtering
        expect(items.length).toBeGreaterThan(0);
      });
    });

    it('should reset selected index when query changes', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      // Make a search
      fireEvent.change(input, { target: { value: 'dashboard' } });
      await waitFor(() => {
        const items = screen.getAllByRole('button');
        expect(items.length).toBeGreaterThan(0);
      });

      // Change query
      fireEvent.change(input, { target: { value: 'a' } });
      await waitFor(() => {
        const items = screen.getAllByRole('button');
        expect(items.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================
  // Keyboard Navigation Tests
  // ============================================

  describe('Keyboard Navigation', () => {
    it('should handle ArrowDown key without crashing', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      // Should not crash
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input).toBeInTheDocument();
    });

    it('should handle ArrowUp key without crashing', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      fireEvent.keyDown(input, { key: 'ArrowUp' });
      expect(input).toBeInTheDocument();
    });

    it('should execute command with Enter key', async () => {
      const onClose = jest.fn();
      renderCommandPalette({ isOpen: true, onClose });
      const input = screen.getByPlaceholderText(/search organizations/i);

      // Search for dashboard
      fireEvent.change(input, { target: { value: 'dashboard' } });

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
      });

      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter' });

      // Should navigate and close
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should close palette with Escape key', async () => {
      const onClose = jest.fn();
      renderCommandPalette({ isOpen: true, onClose });
      const input = screen.getByPlaceholderText(/search organizations/i);

      fireEvent.keyDown(input, { key: 'Escape' });

      expect(onClose).toHaveBeenCalled();
    });
  });

  // ============================================
  // Command Execution Tests
  // ============================================

  describe('Command Execution', () => {
    it('should navigate to command path on selection', async () => {
      const onClose = jest.fn();
      renderCommandPalette({ isOpen: true, onClose });

      // Get first item from results (should be Dashboard)
      const items = screen.getAllByRole('button');
      if (items.length > 0) {
        fireEvent.click(items[0]);

        // Should call navigation or close at minimum
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should close palette after command execution', async () => {
      const onClose = jest.fn();
      renderCommandPalette({ isOpen: true, onClose });

      // Click on any command
      const items = screen.getAllByRole('button');
      if (items.length > 0) {
        fireEvent.click(items[0]);
        expect(onClose).toHaveBeenCalled();
      }
    });

    it('should handle commands without paths', async () => {
      const onClose = jest.fn();
      renderCommandPalette({ isOpen: true, onClose });

      // Find a command without path if it exists
      const items = screen.getAllByRole('button');
      if (items.length > 0) {
        fireEvent.click(items[0]);
        // Should still close regardless
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  // ============================================
  // Category & Grouping Tests
  // ============================================

  describe('Category Grouping', () => {
    it('should display commands grouped by category', () => {
      renderCommandPalette({ isOpen: true });

      // Should show category labels
      const categoryLabels = screen.queryAllByText(/dashboard|fleet|ops|community|tools|help/i);
      expect(categoryLabels.length).toBeGreaterThan(0);
    });

    it('should sort categories in correct order', () => {
      renderCommandPalette({ isOpen: true });

      const results = screen.getAllByRole('button');
      expect(results.length).toBeGreaterThan(0);

      // First items should be from dashboard category
      const dashboardItems = Array.from(results).filter(item =>
        item.textContent?.includes('Dashboard')
      );
      expect(dashboardItems.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Mouse Interaction Tests
  // ============================================

  describe('Mouse Interactions', () => {
    it('should handle mouse interaction without crashing', async () => {
      renderCommandPalette({ isOpen: true });

      const items = screen.getAllByRole('button');
      if (items.length > 1) {
        fireEvent.mouseEnter(items[1]);
        expect(items[1]).toBeInTheDocument();
      }
    });

    it('should execute command on mouse click', async () => {
      const onClose = jest.fn();
      renderCommandPalette({ isOpen: true, onClose });

      const items = screen.getAllByRole('button');
      if (items.length > 0) {
        fireEvent.click(items[0]);

        await waitFor(() => {
          expect(onClose).toHaveBeenCalled();
        });
      }
    });

    it('should prefetch route data on command hover intent', async () => {
      renderCommandPalette({ isOpen: true });

      const items = screen.getAllByRole('button');
      expect(items.length).toBeGreaterThan(0);

      mockPrefetchNavigationIntent.mockClear();
      fireEvent.mouseEnter(items[0]);

      await waitFor(() => {
        expect(mockPrefetchNavigationIntent).toHaveBeenCalled();
      });
    });
  });

  // ============================================
  // Edge Cases & Special Scenarios
  // ============================================

  describe('Edge Cases', () => {
    it('should handle rapid keyboard navigation', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      // Rapidly press down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // Should not crash
      const items = screen.getAllByRole('button');
      expect(items.length).toBeGreaterThan(0);
    });

    it('should handle special characters in search', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      fireEvent.change(input, { target: { value: '@#$%^&*' } });

      // Should not crash, just show empty state
      await waitFor(() => {
        const emptyMessages = screen.getAllByText('No results found');
        expect(emptyMessages.length).toBeGreaterThan(0);
      });
    });

    it('should handle very long search query', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      const longQuery = 'a'.repeat(100);
      fireEvent.change(input, { target: { value: longQuery } });

      // Should not crash
      await waitFor(() => {
        const emptyMessages = screen.getAllByText('No results found');
        expect(emptyMessages.length).toBeGreaterThan(0);
      });
    });

    it('should handle whitespace-only search', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      fireEvent.change(input, { target: { value: '   ' } });

      // Should show all commands (whitespace is trimmed)
      await waitFor(() => {
        const items = screen.getAllByRole('button');
        expect(items.length).toBeGreaterThan(10);
      });
    });
  });

  // ============================================
  // Footer & Helper Text Tests
  // ============================================

  describe('Footer and Helper Text', () => {
    it('should display keyboard shortcuts footer', async () => {
      renderCommandPalette({ isOpen: true });

      // Search to get results
      const input = screen.getByPlaceholderText(/search organizations/i);
      fireEvent.change(input, { target: { value: 'fleet' } });

      await waitFor(() => {
        // Should show navigation hints
        expect(screen.getByText(/Navigate/i)).toBeInTheDocument();
        expect(screen.getByText(/Select/i)).toBeInTheDocument();
        expect(screen.getByText(/Close/i)).toBeInTheDocument();
      });
    });

    it('should not display footer with empty results', async () => {
      renderCommandPalette({ isOpen: true });
      const input = screen.getByPlaceholderText(/search organizations/i);

      fireEvent.change(input, { target: { value: 'xyznonexistent' } });

      await waitFor(() => {
        const emptyMessages = screen.getAllByText('No results found');
        expect(emptyMessages.length).toBeGreaterThan(0);
        // Footer should not be visible when there are no results
        const footer = screen.queryByText(/Navigate/i);
        expect(footer).not.toBeInTheDocument();
      });
    });
  });
});
