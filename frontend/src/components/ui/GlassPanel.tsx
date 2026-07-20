/**
 * GlassPanel Component - Glass morphism panel/sidebar with backdrop blur
 *
 * A versatile panel component featuring glass morphism design with:
 * - Backdrop blur effect (blur(12px))
 * - Configurable position (left, right, top, bottom)
 * - Collapsible functionality
 * - Browser fallbacks for unsupported browsers
 * - Full accessibility support
 *
 * @example
 * <GlassPanel position="left" width={300}>
 *   <Navigation />
 * </GlassPanel>
 *
 * @example
 * <GlassPanel
 *   position="right"
 *   collapsible
 *   collapsed={isCollapsed}
 *   onToggle={() => setIsCollapsed(!isCollapsed)}
 * >
 *   <DetailsSidebar />
 * </GlassPanel>
 */

import React from 'react';
import './GlassPanel.css';

export type GlassPanelPosition = 'left' | 'right' | 'top' | 'bottom';
export type GlassPanelVariant = 'clear' | 'frosted' | 'tinted';

export interface GlassPanelProps {
  /** Position of the panel */
  position?: GlassPanelPosition;
  /** Glass variant style */
  variant?: GlassPanelVariant;
  /** Width for left/right panels (number in px or string) */
  width?: number | string;
  /** Height for top/bottom panels (number in px or string) */
  height?: number | string;
  /** Width when collapsed */
  collapsedWidth?: number | string;
  /** Height when collapsed */
  collapsedHeight?: number | string;
  /** Whether the panel is collapsible */
  collapsible?: boolean;
  /** Whether the panel is currently collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onToggle?: () => void;
  /** Panel title (displayed in header) */
  title?: React.ReactNode;
  /** Header action element */
  headerAction?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Whether to show a border */
  bordered?: boolean;
  /** Panel content */
  children?: React.ReactNode;
  /** Additional class name */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Format dimension value to CSS
 */
const formatDimension = (value: number | string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
};

/**
 * GlassPanel component with glass morphism styling
 */
export function GlassPanel({
  position = 'left',
  variant = 'frosted',
  width = 280,
  height = 200,
  collapsedWidth = 60,
  collapsedHeight = 48,
  collapsible = false,
  collapsed = false,
  onToggle,
  title,
  headerAction,
  footer,
  bordered = true,
  children,
  className = '',
  testId,
}: GlassPanelProps): React.ReactElement {
  const isHorizontal = position === 'left' || position === 'right';

  const getDimensionStyles = (): React.CSSProperties => {
    if (isHorizontal) {
      return {
        width: formatDimension(collapsed && collapsible ? collapsedWidth : width),
        height: '100%',
      };
    }
    return {
      width: '100%',
      height: formatDimension(collapsed && collapsible ? collapsedHeight : height),
    };
  };

  const classNames = [
    'glass-panel',
    `glass-panel--${position}`,
    `glass-panel--${variant}`,
    bordered ? 'glass-panel--bordered' : '',
    collapsible ? 'glass-panel--collapsible' : '',
    collapsed ? 'glass-panel--collapsed' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleToggle = () => {
    if (collapsible && onToggle) {
      onToggle();
    }
  };

  const renderToggleButton = () => {
    if (!collapsible) return null;

    const isExpanding = collapsed;
    const arrowDirection = isHorizontal
      ? position === 'left'
        ? isExpanding ? 'right' : 'left'
        : isExpanding ? 'left' : 'right'
      : position === 'top'
        ? isExpanding ? 'down' : 'up'
        : isExpanding ? 'up' : 'down';

    return (
      <button
        type="button"
        className="glass-panel__toggle"
        onClick={handleToggle}
        aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}
        aria-expanded={!collapsed}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className={`glass-panel__toggle-icon glass-panel__toggle-icon--${arrowDirection}`}
        >
          <path
            d="M6 12L10 8L6 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    );
  };

  return (
    <aside
      className={classNames}
      style={getDimensionStyles()}
      data-testid={testId}
      aria-label={typeof title === 'string' ? title : 'Panel'}
    >
      {/* Glass backdrop */}
      <div className="glass-panel__backdrop" aria-hidden="true" />

      {/* Content layer */}
      <div className="glass-panel__content">
        {(title || headerAction || collapsible) && (
          <div className="glass-panel__header">
            {!collapsed && title && (
              <h3 className="glass-panel__title">
                {title}
              </h3>
            )}
            <div className="glass-panel__header-actions">
              {!collapsed && headerAction}
              {renderToggleButton()}
            </div>
          </div>
        )}

        {!collapsed && children && (
          <div className="glass-panel__body">
            {children}
          </div>
        )}

        {!collapsed && footer && (
          <div className="glass-panel__footer">
            {footer}
          </div>
        )}
      </div>

      {/* Border glow */}
      <div className="glass-panel__glow" aria-hidden="true" />
    </aside>
  );
}
