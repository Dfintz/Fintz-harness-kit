/**
 * VisuallyHidden Component - Screen reader only content
 *
 * Renders content that is visually hidden but accessible to screen readers.
 * Use this for providing additional context to assistive technology users
 * without affecting the visual design.
 *
 * @example
 * // Add context to icons
 * <button>
 *   <Icon name="delete" />
 *   <VisuallyHidden>Delete item</VisuallyHidden>
 * </button>
 *
 * // Add context to data tables
 * <td>
 *   <VisuallyHidden>Total price: </VisuallyHidden>
 *   $1,234.56
 * </td>
 */

import React from 'react';

export interface VisuallyHiddenProps {
  /** Content to be read by screen readers */
  children: React.ReactNode;
  /** HTML element to render (default: span) */
  as?: keyof JSX.IntrinsicElements;
  /** Whether the element should become visible when focused */
  focusable?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Visually hidden styles using the CSS technique recommended by WebAIM
 */
const visuallyHiddenStyles: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

/**
 * Focusable visually hidden styles - becomes visible on focus
 */
const focusableStyles: React.CSSProperties = {
  ...visuallyHiddenStyles,
};

/**
 * VisuallyHidden component for screen reader accessible content
 */
export function VisuallyHidden({
  children,
  as: Component = 'span',
  focusable = false,
  className = '',
}: VisuallyHiddenProps): React.ReactElement {
  const baseClassName = focusable ? 'sr-focusable' : 'sr-only';

  return (
    <Component
      className={`${baseClassName} ${className}`.trim()}
      style={focusable ? focusableStyles : visuallyHiddenStyles}
    >
      {children}
    </Component>
  );
}

/**
 * Higher-order component to add visually hidden label to any component
 */
export function withVisuallyHiddenLabel<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  label: string
): React.FC<P> {
  const ComponentWithLabel: React.FC<P> = (props) => (
    <>
      <WrappedComponent {...props} />
      <VisuallyHidden>{label}</VisuallyHidden>
    </>
  );

  ComponentWithLabel.displayName = `withVisuallyHiddenLabel(${
    WrappedComponent.displayName || WrappedComponent.name || 'Component'
  })`;

  return ComponentWithLabel;
}
