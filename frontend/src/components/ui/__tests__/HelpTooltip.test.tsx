/**
 * Tests for HelpTooltip Component
 *
 * Tests cover:
 * - Basic rendering
 * - Trigger modes (icon vs children)
 * - Show/hide behavior
 * - Positioning
 * - Keyboard interactions
 * - Accessibility
 */

import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { act, fireEvent, render, screen } from '@testing-library/react';

describe('HelpTooltip Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ============================================
  // Basic Rendering
  // ============================================

  describe('Basic Rendering', () => {
    it('renders with children as trigger', () => {
      render(
        <HelpTooltip content="Help text" testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      expect(screen.getByText('Trigger')).toBeInTheDocument();
    });

    it('renders help icon when icon prop is true', () => {
      render(<HelpTooltip content="Help text" icon testId="tooltip" />);

      expect(screen.getByLabelText('Help')).toBeInTheDocument();
    });

    it('does not show tooltip initially', () => {
      render(
        <HelpTooltip content="Help text" testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <HelpTooltip content="Help text" className="custom-class" testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      expect(screen.getByTestId('tooltip')).toHaveClass('custom-class');
    });
  });

  // ============================================
  // Show/Hide Behavior
  // ============================================

  describe('Show/Hide Behavior', () => {
    it('shows tooltip on mouse enter after delay', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={200} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');
      fireEvent.mouseEnter(trigger);

      // Tooltip should not be visible immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      // Advance timers past the delay
      act(() => {
        jest.advanceTimersByTime(200);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      expect(screen.getByText('Help text')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave after delay', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} hideDelay={100} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      act(() => {
        jest.advanceTimersByTime(0);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Hide tooltip
      fireEvent.mouseLeave(trigger);

      // Tooltip should still be visible during delay
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Advance past hide delay
      act(() => {
        jest.advanceTimersByTime(100);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('shows tooltip on focus', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');
      fireEvent.focus(trigger);

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('hides tooltip on blur', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} hideDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');

      // Show
      fireEvent.focus(trigger);
      act(() => {
        jest.advanceTimersByTime(0);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Hide
      fireEvent.blur(trigger);
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('does not show tooltip when disabled', () => {
      render(
        <HelpTooltip content="Help text" disabled showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');
      fireEvent.mouseEnter(trigger);

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('cancels show timeout when mouse leaves quickly', () => {
      render(
        <HelpTooltip content="Help text" showDelay={500} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');

      // Enter then leave before delay
      fireEvent.mouseEnter(trigger);
      act(() => {
        jest.advanceTimersByTime(200);
      });
      fireEvent.mouseLeave(trigger);

      // Advance past original show delay
      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Icon Trigger
  // ============================================

  describe('Icon Trigger', () => {
    it('renders as button with aria-label', () => {
      render(<HelpTooltip content="Help text" icon testId="tooltip" />);

      const button = screen.getByLabelText('Help');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('applies icon size class', () => {
      const { rerender } = render(
        <HelpTooltip content="Help text" icon iconSize="sm" testId="tooltip" />
      );
      expect(screen.getByTestId('tooltip')).toHaveClass('help-tooltip__trigger--sm');

      rerender(<HelpTooltip content="Help text" icon iconSize="lg" testId="tooltip" />);
      expect(screen.getByTestId('tooltip')).toHaveClass('help-tooltip__trigger--lg');
    });

    it('shows tooltip on icon click (focus)', async () => {
      render(<HelpTooltip content="Help text" icon showDelay={0} testId="tooltip" />);

      const button = screen.getByLabelText('Help');
      fireEvent.focus(button);

      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });
  });

  // ============================================
  // Positioning
  // ============================================

  describe('Positioning', () => {
    it('applies a position class to tooltip', () => {
      render(
        <HelpTooltip content="Help text" position="bottom" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');
      fireEvent.mouseEnter(trigger);

      act(() => {
        jest.advanceTimersByTime(0);
      });

      const tooltip = screen.getByRole('tooltip');
      // Tooltip should have a position class (may be flipped in JSDOM)
      expect(tooltip.className).toMatch(/help-tooltip__popup--/);
    });

    it('tooltip has position-related class', () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');
      fireEvent.mouseEnter(trigger);

      act(() => {
        jest.advanceTimersByTime(0);
      });

      const tooltip = screen.getByRole('tooltip');
      // Should have some position class (may be flipped due to viewport boundaries in JSDOM)
      expect(tooltip.className).toMatch(/help-tooltip__popup--(top|bottom|left|right)/);
    });
  });

  // ============================================
  // Keyboard Interactions
  // ============================================

  describe('Keyboard Interactions', () => {
    it('hides tooltip on Escape key', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');

      // Show tooltip
      fireEvent.focus(trigger);
      act(() => {
        jest.advanceTimersByTime(0);
      });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(trigger, { key: 'Escape' });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  // ============================================
  // Content
  // ============================================

  describe('Content', () => {
    it('renders text content', async () => {
      render(
        <HelpTooltip content="Simple text content" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByText('Simple text content')).toBeInTheDocument();
    });

    it('renders rich content', async () => {
      render(
        <HelpTooltip
          content={
            <div>
              <strong>Bold text</strong>
              <p>Paragraph text</p>
            </div>
          }
          showDelay={0}
          testId="tooltip"
        >
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByText('Bold text')).toBeInTheDocument();
      expect(screen.getByText('Paragraph text')).toBeInTheDocument();
    });

    it('applies maxWidth style', async () => {
      render(
        <HelpTooltip content="Help text" maxWidth={200} showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      const tooltip = screen.getByRole('tooltip');
      // maxWidth is now set via CSS custom property instead of inline style
      expect(tooltip.style.getPropertyValue('--tooltip-max-width')).toBe('200px');
    });
  });

  // ============================================
  // Accessibility
  // ============================================

  describe('Accessibility', () => {
    it('has proper tooltip role', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('links trigger to tooltip via aria-describedby', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');

      // Before showing tooltip
      expect(trigger).not.toHaveAttribute('aria-describedby');

      // Show tooltip
      fireEvent.mouseEnter(trigger);
      act(() => {
        jest.advanceTimersByTime(0);
      });

      // After showing tooltip
      const tooltip = screen.getByRole('tooltip');
      const tooltipId = tooltip.getAttribute('id');
      expect(trigger).toHaveAttribute('aria-describedby', tooltipId);
    });

    it('icon trigger has aria-label', () => {
      render(<HelpTooltip content="Help text" icon testId="tooltip" />);

      expect(screen.getByLabelText('Help')).toBeInTheDocument();
    });

    it('arrow is hidden from assistive technology', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      const arrow = document.querySelector('.help-tooltip__arrow');
      expect(arrow).toHaveAttribute('aria-hidden', 'true');
    });

    it('backdrop is hidden from assistive technology', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      const backdrop = document.querySelector('.help-tooltip__backdrop');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ============================================
  // Test ID
  // ============================================

  describe('Test ID', () => {
    it('applies testId to trigger', () => {
      render(
        <HelpTooltip content="Help text" testId="my-tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      expect(screen.getByTestId('my-tooltip')).toBeInTheDocument();
    });

    it('applies testId to tooltip popup', async () => {
      render(
        <HelpTooltip content="Help text" showDelay={0} testId="my-tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('my-tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByTestId('my-tooltip-tooltip')).toBeInTheDocument();
    });
  });

  // ============================================
  // Edge Cases
  // ============================================

  describe('Edge Cases', () => {
    it('handles empty content gracefully', async () => {
      render(
        <HelpTooltip content="" showDelay={0} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      fireEvent.mouseEnter(screen.getByTestId('tooltip'));
      act(() => {
        jest.advanceTimersByTime(0);
      });

      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('cleans up timeouts on unmount', () => {
      const { unmount } = render(
        <HelpTooltip content="Help text" showDelay={500} testId="tooltip">
          <button>Trigger</button>
        </HelpTooltip>
      );

      const trigger = screen.getByTestId('tooltip');
      fireEvent.mouseEnter(trigger);

      // Unmount before timeout fires
      unmount();

      // Should not throw
      act(() => {
        jest.advanceTimersByTime(500);
      });
    });
  });
});
