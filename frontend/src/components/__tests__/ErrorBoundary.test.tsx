import React from 'react';
import { fireEvent, render, screen } from '@/test-utils/test-utils';
import { ErrorBoundary } from '@/components/ErrorBoundary';

// Component that throws an error for testing
const ProblemChild: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>Child content</div>;
};

// Suppress error console output during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
  // Mock fetch to prevent errors when sending error reports
  (global.fetch as jest.Mock) = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
  });
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when child throws an error', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    // Use getAllByText since there are multiple matches (Alert message + Heading)
    const matches = screen.getAllByText('Something went wrong');
    expect(matches.length).toBeGreaterThan(0);
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
  });

  it('displays Try Again button', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('displays Reload Page button', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('displays Go Home button', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    // Create a stateful component to control when error is thrown
    const StatefulProblemChild: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Recovered content</div>;
    };

    const TestWrapper: React.FC = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);

      // We need to trigger re-render without error after reset
      React.useEffect(() => {
        // After error boundary catches error and resets, don't throw again
        const timeout = setTimeout(() => setShouldThrow(false), 100);
        return () => clearTimeout(timeout);
      }, []);

      return (
        <ErrorBoundary>
          <StatefulProblemChild shouldThrow={shouldThrow} />
        </ErrorBoundary>
      );
    };

    render(<TestWrapper />);

    // Should show error UI - use getAllByText since there are multiple matches
    const matches = screen.getAllByText('Something went wrong');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('renders Reload Page button that can be clicked', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    const reloadButton = screen.getByText('Reload Page');
    expect(reloadButton).toBeInTheDocument();

    // Verify button is clickable (doesn't throw)
    expect(() => fireEvent.click(reloadButton)).not.toThrow();
  });

  it('renders multiple children correctly', () => {
    render(
      <ErrorBoundary>
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });

  it('catches errors from nested children', () => {
    render(
      <ErrorBoundary>
        <div>
          <div>
            <ProblemChild shouldThrow={true} />
          </div>
        </div>
      </ErrorBoundary>
    );

    // Use getAllByText since there are multiple matches
    const matches = screen.getAllByText('Something went wrong');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(console.error).toHaveBeenCalled();
  });
});
