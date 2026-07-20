/**
 * Tests for EmptyState Component
 *
 * Tests cover:
 * - Rendering with different presets
 * - Size variants
 * - Custom content
 * - Action buttons
 * - Accessibility
 * - Illustration selection
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { EmptyState, type EmptyStatePreset } from '@/components/ui/EmptyState';

describe('EmptyState Component', () => {
  // ============================================
  // Basic Rendering
  // ============================================

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<EmptyState testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toBeInTheDocument();
    });

    it('renders with title', () => {
      render(<EmptyState title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('renders with description', () => {
      render(
        <EmptyState
          title="Title"
          description="This is a custom description"
        />
      );
      expect(screen.getByText('This is a custom description')).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      render(<EmptyState testId="empty-state" className="custom-class" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveClass('custom-class');
    });

    it('applies base class', () => {
      render(<EmptyState testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveClass('empty-state');
    });

    it('has proper accessibility attributes', () => {
      render(<EmptyState testId="empty-state" title="Empty" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveAttribute('role', 'status');
      expect(element).toHaveAttribute('aria-live', 'polite');
    });
  });

  // ============================================
  // Preset Configurations
  // ============================================

  describe('Preset Configurations', () => {
    const presets: EmptyStatePreset[] = [
      'fleet',
      'ships',
      'members',
      'events',
      'search',
      'inventory',
      'data',
      'error',
      'success',
    ];

    presets.forEach((preset) => {
      it(`renders ${preset} preset with title and description`, () => {
        render(<EmptyState preset={preset} testId="empty-state" />);
        const element = screen.getByTestId('empty-state');
        expect(element).toBeInTheDocument();
        // Each preset should have title and description
        expect(element.querySelector('.empty-state__title')).toBeInTheDocument();
        expect(element.querySelector('.empty-state__description')).toBeInTheDocument();
      });
    });

    it('uses preset values when no custom props provided', () => {
      render(<EmptyState preset="fleet" />);
      expect(screen.getByText('No Ships in Your Fleet')).toBeInTheDocument();
    });

    it('overrides preset title with custom title', () => {
      render(<EmptyState preset="fleet" title="Custom Fleet Title" />);
      expect(screen.getByText('Custom Fleet Title')).toBeInTheDocument();
      expect(screen.queryByText('No Ships in Your Fleet')).not.toBeInTheDocument();
    });

    it('overrides preset description with custom description', () => {
      render(<EmptyState preset="fleet" description="Custom description here" />);
      expect(screen.getByText('Custom description here')).toBeInTheDocument();
    });
  });

  // ============================================
  // Size Variants
  // ============================================

  describe('Size Variants', () => {
    it('renders with small size', () => {
      render(<EmptyState size="sm" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveClass('empty-state--sm');
    });

    it('renders with medium size (default)', () => {
      render(<EmptyState testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveClass('empty-state--md');
    });

    it('renders with large size', () => {
      render(<EmptyState size="lg" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveClass('empty-state--lg');
    });
  });

  // ============================================
  // Action Buttons
  // ============================================

  describe('Action Buttons', () => {
    it('renders primary action button', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          title="Empty"
          primaryAction={{ label: 'Add Item', onClick: handleClick }}
        />
      );
      const button = screen.getByText('Add Item');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('empty-state__action--primary');
    });

    it('renders secondary action button', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          title="Empty"
          secondaryAction={{ label: 'Learn More', onClick: handleClick }}
        />
      );
      const button = screen.getByText('Learn More');
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass('empty-state__action--secondary');
    });

    it('renders both primary and secondary actions', () => {
      render(
        <EmptyState
          title="Empty"
          primaryAction={{ label: 'Primary', onClick: jest.fn() }}
          secondaryAction={{ label: 'Secondary', onClick: jest.fn() }}
        />
      );
      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
    });

    it('calls onClick when primary action is clicked', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          title="Empty"
          primaryAction={{ label: 'Click Me', onClick: handleClick }}
        />
      );
      fireEvent.click(screen.getByText('Click Me'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('calls onClick when secondary action is clicked', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          title="Empty"
          secondaryAction={{ label: 'Click Me', onClick: handleClick }}
        />
      );
      fireEvent.click(screen.getByText('Click Me'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disables primary action when disabled prop is true', () => {
      render(
        <EmptyState
          title="Empty"
          primaryAction={{ label: 'Disabled', onClick: jest.fn(), disabled: true }}
        />
      );
      const button = screen.getByText('Disabled');
      expect(button).toBeDisabled();
    });

    it('disables secondary action when disabled prop is true', () => {
      render(
        <EmptyState
          title="Empty"
          secondaryAction={{ label: 'Disabled', onClick: jest.fn(), disabled: true }}
        />
      );
      const button = screen.getByText('Disabled');
      expect(button).toBeDisabled();
    });

    it('does not call onClick when disabled button is clicked', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          title="Empty"
          primaryAction={{ label: 'Disabled', onClick: handleClick, disabled: true }}
        />
      );
      fireEvent.click(screen.getByText('Disabled'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('does not render actions container when no actions provided', () => {
      render(<EmptyState title="Empty" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element.querySelector('.empty-state__actions')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Illustration Selection
  // ============================================

  describe('Illustration Selection', () => {
    const illustrationTypes = [
      'ships',
      'fleet',
      'members',
      'users',
      'events',
      'calendar',
      'search',
      'data',
      'general',
      'error',
      'success',
      'inventory',
      'logistics',
    ];

    illustrationTypes.forEach((type) => {
      it(`renders with ${type} illustration`, () => {
        render(
          <EmptyState
            // @ts-expect-error - Testing all illustration types
            illustration={type}
            title={`${type} illustration`}
            testId="empty-state"
          />
        );
        const element = screen.getByTestId('empty-state');
        const illustration = element.querySelector('.empty-state__illustration svg');
        expect(illustration).toBeInTheDocument();
      });
    });

    it('renders custom React element as illustration', () => {
      const CustomIllustration = () => <div data-testid="custom-illustration">Custom</div>;
      render(
        <EmptyState
          illustration={<CustomIllustration />}
          title="Custom"
          testId="empty-state"
        />
      );
      expect(screen.getByTestId('custom-illustration')).toBeInTheDocument();
    });

    it('passes illustrationProps to built-in illustrations', () => {
      render(
        <EmptyState
          illustration="ships"
          illustrationProps={{ className: 'custom-svg-class' }}
          title="Test"
          testId="empty-state"
        />
      );
      const element = screen.getByTestId('empty-state');
      const svg = element.querySelector('.empty-state__illustration svg');
      expect(svg).toHaveClass('custom-svg-class');
    });
  });

  // ============================================
  // Content Structure
  // ============================================

  describe('Content Structure', () => {
    it('renders title in h3 element', () => {
      render(<EmptyState title="Test Title" />);
      const title = screen.getByRole('heading', { level: 3 });
      expect(title).toHaveTextContent('Test Title');
    });

    it('renders description in p element', () => {
      render(<EmptyState title="Title" description="Test description" />);
      const description = screen.getByText('Test description');
      expect(description.tagName).toBe('P');
    });

    it('does not render description when not provided', () => {
      render(<EmptyState title="Title Only" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element.querySelector('.empty-state__description')).not.toBeInTheDocument();
    });

    it('renders illustration container', () => {
      render(<EmptyState preset="fleet" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element.querySelector('.empty-state__illustration')).toBeInTheDocument();
    });

    it('renders content container', () => {
      render(<EmptyState title="Test" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element.querySelector('.empty-state__content')).toBeInTheDocument();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('handles empty title gracefully', () => {
      render(<EmptyState title="" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toBeInTheDocument();
    });

    it('handles empty description gracefully', () => {
      render(<EmptyState title="Title" description="" testId="empty-state" />);
      // Empty string should not render description element
      const element = screen.getByTestId('empty-state');
      expect(element.querySelector('.empty-state__description')).not.toBeInTheDocument();
    });

    it('handles invalid illustration type', () => {
      render(
        <EmptyState
          // @ts-expect-error - Testing invalid type
          illustration="invalid-type"
          title="Test"
          testId="empty-state"
        />
      );
      const element = screen.getByTestId('empty-state');
      expect(element).toBeInTheDocument();
    });

    it('renders without crashing when all props are undefined', () => {
      render(<EmptyState testId="empty-state" />);
      expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    });

    it('maintains structure with only testId', () => {
      render(<EmptyState testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      expect(element.querySelector('.empty-state__illustration')).toBeInTheDocument();
      expect(element.querySelector('.empty-state__content')).toBeInTheDocument();
    });
  });

  // ============================================
  // Accessibility
  // ============================================

  describe('Accessibility', () => {
    it('has status role for screen readers', () => {
      render(<EmptyState testId="empty-state" title="Empty" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveAttribute('role', 'status');
    });

    it('has aria-live for dynamic updates', () => {
      render(<EmptyState testId="empty-state" title="Empty" />);
      const element = screen.getByTestId('empty-state');
      expect(element).toHaveAttribute('aria-live', 'polite');
    });

    it('buttons are focusable', () => {
      render(
        <EmptyState
          title="Empty"
          primaryAction={{ label: 'Focus Me', onClick: jest.fn() }}
        />
      );
      const button = screen.getByText('Focus Me');
      button.focus();
      expect(button).toHaveFocus();
    });

    it('disabled buttons are not focusable for action', () => {
      const handleClick = jest.fn();
      render(
        <EmptyState
          title="Empty"
          primaryAction={{ label: 'Disabled', onClick: handleClick, disabled: true }}
        />
      );
      const button = screen.getByText('Disabled');
      expect(button).toBeDisabled();
    });

    it('illustrations have aria-hidden', () => {
      render(<EmptyState preset="fleet" testId="empty-state" />);
      const element = screen.getByTestId('empty-state');
      const svg = element.querySelector('.empty-state__illustration svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ============================================
  // Integration with Presets and Actions
  // ============================================

  describe('Preset with Actions Integration', () => {
    it('combines preset content with custom actions', () => {
      const primaryClick = jest.fn();
      const secondaryClick = jest.fn();

      render(
        <EmptyState
          preset="fleet"
          primaryAction={{ label: 'Custom Primary', onClick: primaryClick }}
          secondaryAction={{ label: 'Custom Secondary', onClick: secondaryClick }}
        />
      );

      // Preset content
      expect(screen.getByText('No Ships in Your Fleet')).toBeInTheDocument();

      // Custom actions
      expect(screen.getByText('Custom Primary')).toBeInTheDocument();
      expect(screen.getByText('Custom Secondary')).toBeInTheDocument();

      // Click handling
      fireEvent.click(screen.getByText('Custom Primary'));
      expect(primaryClick).toHaveBeenCalled();

      fireEvent.click(screen.getByText('Custom Secondary'));
      expect(secondaryClick).toHaveBeenCalled();
    });
  });
});
