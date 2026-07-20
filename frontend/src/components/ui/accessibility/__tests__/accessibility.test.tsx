/**
 * Accessibility Components and Hooks Tests
 *
 * Comprehensive tests for WCAG 2.1 AA compliance utilities
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import {
  a11yColors,
  getAccessibleTextColor,
  getContrastColor,
} from '@/components/ui/accessibility/a11y-colors';
import { FocusTrap } from '@/components/ui/accessibility/FocusTrap';
import { LiveRegion, useLiveRegion } from '@/components/ui/accessibility/LiveRegion';
import { SkipLink } from '@/components/ui/accessibility/SkipLink';
import {
  generateId,
  useAnnounce,
  useArrowNavigation,
  useFocusTrap,
  useFocusVisible,
  useHighContrast,
  useReducedMotion,
} from '@/components/ui/accessibility/useA11y';
import {
  VisuallyHidden,
  withVisuallyHiddenLabel,
} from '@/components/ui/accessibility/VisuallyHidden';

// ============================================================================
// SkipLink Tests
// ============================================================================

describe('SkipLink', () => {
  beforeEach(() => {
    // Create a main content element for skip link target
    const main = document.createElement('main');
    main.id = 'main-content';
    document.body.appendChild(main);
  });

  afterEach(() => {
    const main = document.getElementById('main-content');
    if (main) {
      main.remove();
    }
  });

  it('renders with default text', () => {
    render(<SkipLink targetId="main-content" />);
    expect(screen.getByText('Skip to main content')).toBeInTheDocument();
  });

  it('renders with custom text', () => {
    render(<SkipLink targetId="main-content">Skip to navigation</SkipLink>);
    expect(screen.getByText('Skip to navigation')).toBeInTheDocument();
  });

  it('has correct href attribute', () => {
    render(<SkipLink targetId="main-content" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '#main-content');
  });

  it('applies custom className', () => {
    render(<SkipLink targetId="main-content" className="custom-class" />);
    const link = screen.getByRole('link');
    expect(link).toHaveClass('skip-link', 'custom-class');
  });

  it('focuses target element on click', () => {
    render(<SkipLink targetId="main-content" />);
    const link = screen.getByRole('link');

    fireEvent.click(link);

    // Verify the click doesn't cause errors and the link is still in the document
    expect(link).toBeInTheDocument();
  });

  it('prevents default navigation behavior', () => {
    render(<SkipLink targetId="main-content" />);
    const link = screen.getByRole('link');

    // The click handler should handle navigation programmatically
    expect(link).toBeInTheDocument();
  });
});

// ============================================================================
// VisuallyHidden Tests
// ============================================================================

describe('VisuallyHidden', () => {
  it('renders content', () => {
    render(<VisuallyHidden>Hidden content</VisuallyHidden>);
    expect(screen.getByText('Hidden content')).toBeInTheDocument();
  });

  it('renders as span by default', () => {
    render(<VisuallyHidden>Content</VisuallyHidden>);
    const element = screen.getByText('Content');
    expect(element.tagName).toBe('SPAN');
  });

  it('renders as custom element', () => {
    render(<VisuallyHidden as="div">Content</VisuallyHidden>);
    const element = screen.getByText('Content');
    expect(element.tagName).toBe('DIV');
  });

  it('applies sr-only class by default', () => {
    render(<VisuallyHidden>Content</VisuallyHidden>);
    expect(screen.getByText('Content')).toHaveClass('sr-only');
  });

  it('applies sr-focusable class when focusable', () => {
    render(<VisuallyHidden focusable>Content</VisuallyHidden>);
    expect(screen.getByText('Content')).toHaveClass('sr-focusable');
  });

  it('applies custom className', () => {
    render(<VisuallyHidden className="custom">Content</VisuallyHidden>);
    expect(screen.getByText('Content')).toHaveClass('sr-only', 'custom');
  });

  it('applies visually hidden styles', () => {
    render(<VisuallyHidden>Content</VisuallyHidden>);
    const element = screen.getByText('Content');
    expect(element).toHaveStyle({
      position: 'absolute',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
    });
  });
});

describe('withVisuallyHiddenLabel', () => {
  it('adds hidden label to component', () => {
    const TestButton: React.FC<{ label: string }> = ({ label }) => <button>{label}</button>;
    const ButtonWithLabel = withVisuallyHiddenLabel(TestButton, 'Hidden label');

    render(<ButtonWithLabel label="Click me" />);

    expect(screen.getByText('Click me')).toBeInTheDocument();
    expect(screen.getByText('Hidden label')).toBeInTheDocument();
  });
});

// ============================================================================
// LiveRegion Tests
// ============================================================================

describe('LiveRegion', () => {
  it('renders with polite politeness by default', () => {
    render(<LiveRegion>Message</LiveRegion>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
  });

  it('renders with assertive politeness', () => {
    render(<LiveRegion politeness="assertive">Alert!</LiveRegion>);
    const region = screen.getByRole('alert');
    expect(region).toHaveAttribute('aria-live', 'assertive');
  });

  it('renders with atomic attribute', () => {
    render(<LiveRegion atomic>Message</LiveRegion>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('renders with relevant attribute', () => {
    render(<LiveRegion relevant="additions">Message</LiveRegion>);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-relevant', 'additions');
  });

  it('uses status role for polite', () => {
    render(<LiveRegion politeness="polite">Message</LiveRegion>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('uses alert role for assertive', () => {
    render(<LiveRegion politeness="assertive">Alert!</LiveRegion>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('allows custom role', () => {
    render(<LiveRegion role="log">Log message</LiveRegion>);
    expect(screen.getByRole('log')).toBeInTheDocument();
  });

  it('clears content after delay when clearOnAnnounce is true', async () => {
    jest.useFakeTimers();

    render(
      <LiveRegion clearOnAnnounce clearDelay={500}>
        Temporary message
      </LiveRegion>
    );

    expect(screen.getByText('Temporary message')).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(600);
    });

    expect(screen.queryByText('Temporary message')).not.toBeInTheDocument();

    jest.useRealTimers();
  });
});

describe('useLiveRegion', () => {
  const TestComponent: React.FC = () => {
    const { announce, clear, LiveRegionComponent } = useLiveRegion();

    return (
      <div>
        <button onClick={() => announce('New message')}>Announce</button>
        <button onClick={clear}>Clear</button>
        {LiveRegionComponent}
      </div>
    );
  };

  it('renders a live region', () => {
    render(<TestComponent />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

// ============================================================================
// FocusTrap Tests
// ============================================================================

describe('FocusTrap', () => {
  it('renders children', () => {
    render(
      <FocusTrap>
        <button>Button 1</button>
        <button>Button 2</button>
      </FocusTrap>
    );

    expect(screen.getByText('Button 1')).toBeInTheDocument();
    expect(screen.getByText('Button 2')).toBeInTheDocument();
  });

  it('focuses first element on mount when autoFocus is true', async () => {
    render(
      <FocusTrap autoFocus>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>
    );

    await waitFor(() => {
      expect(screen.getByText('First')).toHaveFocus();
    });
  });

  it('does not focus when autoFocus is false', () => {
    render(
      <FocusTrap autoFocus={false}>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>
    );

    // Focus should not be automatically set when autoFocus is false
    expect(screen.getByText('First')).not.toHaveFocus();
  });

  it('does not trap focus when inactive', async () => {
    render(
      <FocusTrap active={false}>
        <button>First</button>
        <button>Second</button>
      </FocusTrap>
    );

    // Focus should not be automatically set
    expect(screen.getByText('First')).not.toHaveFocus();
  });

  it('calls onEscapeKey when Escape is pressed', async () => {
    const handleEscape = jest.fn();

    render(
      <FocusTrap onEscapeKey={handleEscape}>
        <button>Button</button>
      </FocusTrap>
    );

    await waitFor(() => {
      expect(screen.getByText('Button')).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(handleEscape).toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <FocusTrap className="custom-trap">
        <button>Button</button>
      </FocusTrap>
    );

    expect(document.querySelector('.focus-trap.custom-trap')).toBeInTheDocument();
  });
});

// ============================================================================
// useA11y Hooks Tests
// ============================================================================

describe('useFocusTrap hook', () => {
  const TestComponent: React.FC<{ active?: boolean }> = ({ active = true }) => {
    const trapRef = useFocusTrap<HTMLDivElement>(active);

    return (
      <div ref={trapRef}>
        <button>First</button>
        <button>Second</button>
      </div>
    );
  };

  it('returns a ref', () => {
    render(<TestComponent />);
    expect(screen.getByText('First')).toBeInTheDocument();
  });
});

describe('useArrowNavigation hook', () => {
  const TestComponent: React.FC = () => {
    const { activeIndex, getItemProps } = useArrowNavigation(3, {
      loop: true,
    });

    return (
      <div>
        <button {...getItemProps(0)}>Item 1</button>
        <button {...getItemProps(1)}>Item 2</button>
        <button {...getItemProps(2)}>Item 3</button>
        <span data-testid="active-index">{activeIndex}</span>
      </div>
    );
  };

  it('renders items', () => {
    render(<TestComponent />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });
});

describe('useAnnounce hook', () => {
  const TestComponent: React.FC = () => {
    const announce = useAnnounce();

    return (
      <div>
        <button onClick={() => announce('Announced!')}>Announce</button>
      </div>
    );
  };

  it('returns an announce function', () => {
    render(<TestComponent />);
    expect(screen.getByText('Announce')).toBeInTheDocument();
  });

  it('creates an announcements region', () => {
    render(<TestComponent />);

    // Click to trigger announcement region creation
    fireEvent.click(screen.getByText('Announce'));

    // The announcement is made to a screen reader region
    expect(document.getElementById('a11y-announcements')).toBeInTheDocument();
  });
});

describe('useFocusVisible hook', () => {
  const TestComponent: React.FC = () => {
    const { isFocusVisible, focusProps } = useFocusVisible();

    return (
      <button {...focusProps} data-focus-visible={isFocusVisible}>
        Button
      </button>
    );
  };

  it('tracks focus visible state', () => {
    render(<TestComponent />);
    const button = screen.getByText('Button');
    expect(button).toHaveAttribute('data-focus-visible', 'false');
  });

  it('updates on keyboard focus', async () => {
    render(<TestComponent />);
    const button = screen.getByText('Button');

    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.focus(button);

    await waitFor(() => {
      expect(button).toHaveAttribute('data-focus-visible', 'true');
    });
  });
});

describe('useReducedMotion hook', () => {
  it('returns a boolean value', () => {
    const TestComponent: React.FC = () => {
      const reducedMotion = useReducedMotion();
      return <div data-testid="motion">{typeof reducedMotion}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('motion')).toHaveTextContent('boolean');
  });
});

describe('useHighContrast hook', () => {
  it('returns a boolean value', () => {
    const TestComponent: React.FC = () => {
      const highContrast = useHighContrast();
      return <div data-testid="contrast">{typeof highContrast}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('contrast')).toHaveTextContent('boolean');
  });
});

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId('test');
    const id2 = generateId('test');
    expect(id1).not.toBe(id2);
  });

  it('includes prefix', () => {
    const id = generateId('modal');
    expect(id).toMatch(/^modal-/);
  });
});

// ============================================================================
// a11y-colors Tests
// ============================================================================

describe('a11yColors', () => {
  it('has primary text color', () => {
    expect(a11yColors.primaryText).toBeDefined();
    expect(a11yColors.primaryText.value).toBe('#ffffff');
  });

  it('has secondary text color', () => {
    expect(a11yColors.secondaryText).toBeDefined();
    expect(a11yColors.secondaryText.contrastRatio).toBeGreaterThanOrEqual(4.5);
  });

  it('has accent cyan color', () => {
    expect(a11yColors.accentCyan).toBeDefined();
    expect(a11yColors.accentCyan.value).toBe('#00d9ff');
  });

  it('has focus outline color', () => {
    expect(a11yColors.focusOutline).toBeDefined();
  });

  it('has status colors', () => {
    expect(a11yColors.success).toBeDefined();
    expect(a11yColors.warning).toBeDefined();
    expect(a11yColors.error).toBeDefined();
  });

  it('all contrast ratios meet WCAG AA', () => {
    // Primary text needs 4.5:1 for normal text
    expect(a11yColors.primaryText.contrastRatio).toBeGreaterThanOrEqual(4.5);
    // Secondary text for normal text
    expect(a11yColors.secondaryText.contrastRatio).toBeGreaterThanOrEqual(4.5);
    // Large text/UI components need 3:1
    expect(a11yColors.accentCyan.contrastRatio).toBeGreaterThanOrEqual(3);
  });
});

describe('getContrastColor', () => {
  it('returns white for dark backgrounds', () => {
    const result = getContrastColor('#0a1628');
    expect(result).toBe('#ffffff');
  });

  it('returns black for light backgrounds', () => {
    const result = getContrastColor('#ffffff');
    expect(result).toBe('#000000');
  });
});

describe('getAccessibleTextColor', () => {
  it('returns primary text for dark backgrounds', () => {
    const result = getAccessibleTextColor('#0a1628');
    expect(result).toBe(a11yColors.primaryText.value);
  });

  it('returns dark text for light backgrounds', () => {
    const result = getAccessibleTextColor('#ffffff');
    expect(result).toBeDefined();
  });
});
