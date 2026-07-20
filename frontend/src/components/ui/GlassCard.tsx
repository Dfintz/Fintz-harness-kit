/**
 * GlassCard Component - Glass morphism card with backdrop blur effect
 *
 * A modern card component featuring glass morphism design with:
 * - Backdrop blur effect (blur(12px))
 * - Semi-transparent backgrounds
 * - Subtle border glow effects
 * - Browser fallbacks for unsupported browsers
 * - Full accessibility support
 *
 * @example
 * <GlassCard>
 *   <p>Content with glass effect</p>
 * </GlassCard>
 *
 * @example
 * <GlassCard
 *   variant="frosted"
 *   glowColor="cyan"
 *   title="Fleet Overview"
 *   interactive
 * >
 *   <FleetStats />
 * </GlassCard>
 */

import React from 'react';
import './GlassCard.css';

export type GlassVariant = 'clear' | 'frosted' | 'tinted';
export type GlowColor = 'none' | 'cyan' | 'purple' | 'green' | 'orange';
export type GlassCardSize = 'sm' | 'md' | 'lg';

export interface GlassCardProps {
  /** Glass variant style */
  variant?: GlassVariant;
  /** Glow color for border effect */
  glowColor?: GlowColor;
  /** Card size (affects padding) */
  size?: GlassCardSize;
  /** Title displayed in the header */
  title?: React.ReactNode;
  /** Subtitle displayed below title */
  subtitle?: React.ReactNode;
  /** Action element for the header */
  headerAction?: React.ReactNode;
  /** Footer content */
  footer?: React.ReactNode;
  /** Whether the card is interactive (hoverable) */
  interactive?: boolean;
  /** Whether the card is in a selected state */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Card content */
  children?: React.ReactNode;
  /** Additional class name */
  className?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Get CSS class names for the glass variant
 */
const getVariantClass = (variant: GlassVariant): string => {
  return `glass-card--${variant}`;
};

/**
 * Get CSS class names for the glow color
 */
const getGlowClass = (glowColor: GlowColor): string => {
  if (glowColor === 'none') return '';
  return `glass-card--glow-${glowColor}`;
};

/**
 * Get CSS class names for the size
 */
const getSizeClass = (size: GlassCardSize): string => {
  return `glass-card--${size}`;
};

/**
 * GlassCard component with glass morphism styling
 */
export function GlassCard({
  variant = 'frosted',
  glowColor = 'cyan',
  size = 'md',
  title,
  subtitle,
  headerAction,
  footer,
  interactive = false,
  selected = false,
  onClick,
  children,
  className = '',
  testId,
}: GlassCardProps): React.ReactElement {
  const classNames = [
    'glass-card',
    getVariantClass(variant),
    getGlowClass(glowColor),
    getSizeClass(size),
    interactive ? 'glass-card--interactive' : '',
    selected ? 'glass-card--selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const handleClick = () => {
    if (interactive && onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (interactive && onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={classNames}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive && selected ? selected : undefined}
      data-testid={testId}
    >
      {/* Glass layer for backdrop blur */}
      <div className="glass-card__backdrop" aria-hidden="true" />

      {/* Content layer */}
      <div className="glass-card__content">
        {(title || headerAction) && (
          <div className="glass-card__header">
            <div className="glass-card__header-text">
              {title && (
                <h3 className="glass-card__title">
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className="glass-card__subtitle">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction && (
              <div className="glass-card__header-action">
                {headerAction}
              </div>
            )}
          </div>
        )}

        {children && (
          <div className="glass-card__body">
            {children}
          </div>
        )}

        {footer && (
          <div className="glass-card__footer">
            {footer}
          </div>
        )}
      </div>

      {/* Border glow effect */}
      {glowColor !== 'none' && (
        <div className="glass-card__glow" aria-hidden="true" />
      )}
    </div>
  );
}
