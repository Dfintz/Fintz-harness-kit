import React from 'react';
import { render, screen, fireEvent } from '@/test-utils/test-utils';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

// Component that throws an error for testing
const ProblemChild: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test feature error');
  }
  return <div>Feature content</div>;
};

// Suppress error console output during tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('FeatureErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <div>Test content</div>
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI with feature name when child throws an error', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Test Feature Error')).toBeInTheDocument();
  });

  it('displays default fallback message when not provided', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText(/An error occurred in the Test Feature feature/)).toBeInTheDocument();
  });

  it('displays custom fallback message when provided', () => {
    render(
      <FeatureErrorBoundary 
        featureName="Test Feature"
        fallbackMessage="Custom error message"
      >
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('displays Try Again button', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('displays Reload Page button', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Reload Page')).toBeInTheDocument();
  });

  it('displays Go Home button when showHomeButton is true', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature" showHomeButton={true}>
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Go Home')).toBeInTheDocument();
  });

  it('does not display Go Home button when showHomeButton is false', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature" showHomeButton={false}>
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(screen.queryByText('Go Home')).not.toBeInTheDocument();
  });

  it('resets error state when Try Again is clicked', () => {
    const TestWrapper: React.FC = () => {
      const [shouldThrow, setShouldThrow] = React.useState(true);
      
      React.useEffect(() => {
        const timeout = setTimeout(() => setShouldThrow(false), 100);
        return () => clearTimeout(timeout);
      }, []);

      return (
        <FeatureErrorBoundary featureName="Test Feature">
          <ProblemChild shouldThrow={shouldThrow} />
        </FeatureErrorBoundary>
      );
    };

    render(<TestWrapper />);
    
    expect(screen.getByText('Test Feature Error')).toBeInTheDocument();
  });

  it('calls onReset callback when Try Again is clicked', () => {
    const onReset = jest.fn();
    
    render(
      <FeatureErrorBoundary featureName="Test Feature" onReset={onReset}>
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    const tryAgainButton = screen.getByText('Try Again');
    fireEvent.click(tryAgainButton);
    
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('renders smaller inline error UI (not full page)', () => {
    const { container } = render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    // Check that error UI is rendered (has the error message)
    expect(screen.getByText('Test Feature Error')).toBeInTheDocument();
    
    // Check that it's not full-page height by verifying no height="100vh" style
    const allElements = container.querySelectorAll('*');
    let hasFullPageHeight = false;
    allElements.forEach(el => {
      const style = (el as HTMLElement).style;
      if (style && style.height === '100vh') {
        hasFullPageHeight = true;
      }
    });
    expect(hasFullPageHeight).toBe(false);
  });

  it('renders multiple children correctly when no error', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <div>Child 1</div>
        <div>Child 2</div>
        <div>Child 3</div>
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
    expect(screen.getByText('Child 3')).toBeInTheDocument();
  });

  it('catches errors from nested children', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <div>
          <div>
            <ProblemChild shouldThrow={true} />
          </div>
        </div>
      </FeatureErrorBoundary>
    );
    
    expect(screen.getByText('Test Feature Error')).toBeInTheDocument();
  });

  it('logs error to console', () => {
    render(
      <FeatureErrorBoundary featureName="Test Feature">
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    
    expect(console.error).toHaveBeenCalled();
  });
});
