/**
 * GlassButton Component - Glass morphism styled button
 *
 * A modern button with glass morphism effects featuring:
 * - Backdrop blur effect
 * - Gradient backgrounds
 * - Glow hover effects
 * - Multiple variants and sizes
 * - Full accessibility support
 *
 * @example
 * <GlassButton variant="primary" onClick={handleClick}>
 *   Primary Action
 * </GlassButton>
 *
 * @example
 * <GlassButton variant="accent" size="lg" loading>
 *   Processing...
 * </GlassButton>
 */

import React, { ButtonHTMLAttributes, forwardRef } from 'react';
import './GlassButton.css';

export type GlassButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'ghost'
  | 'danger'
  | 'success';
export type GlassButtonSize = 'sm' | 'md' | 'lg';

export interface GlassButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: GlassButtonVariant;
  /** Button size */
  size?: GlassButtonSize;
  /** Full width button */
  fullWidth?: boolean;
  /** Loading state */
  loading?: boolean;
  /** Leading icon */
  icon?: React.ReactNode;
  /** Trailing icon */
  iconEnd?: React.ReactNode;
  /** Whether button should have a subtle pulse animation */
  pulse?: boolean;
  /** Custom glow color (CSS color value) */
  glowColor?: string;
  /** Test ID for testing */
  testId?: string;
}

/**
 * Loading spinner for button loading state
 */
const LoadingSpinner: React.FC<{ size: GlassButtonSize }> = ({ size }) => {
  const spinnerSize = {
    sm: 14,
    md: 16,
    lg: 20,
  }[size];

  return (
    <svg
      className="glass-button__spinner"
      width={spinnerSize}
      height={spinnerSize}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.25"
      />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
};

/**
 * GlassButton - A glass morphism styled button component
 */
export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(props, ref) {
    const {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      icon,
      iconEnd,
      pulse = false,
      glowColor,
      disabled,
      children,
      className = '',
      testId,
      style,
      ...rest
    } = props;

    const isDisabled = disabled || loading;

    const classNames = [
      'glass-button',
      `glass-button--${variant}`,
      `glass-button--${size}`,
      fullWidth ? 'glass-button--full-width' : '',
      loading ? 'glass-button--loading' : '',
      pulse ? 'glass-button--pulse' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    const customStyle: React.CSSProperties = {
      ...style,
      ...(glowColor &&
        ({
          '--glass-button-glow-color': glowColor,
        } as React.CSSProperties)),
    };

    return (
      <button
        ref={ref}
        className={classNames}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading}
        style={customStyle}
        data-testid={testId}
        {...rest}
      >
        {/* Background layer for glass effect */}
        <span className="glass-button__bg" aria-hidden="true" />

        {/* Glow effect layer */}
        <span className="glass-button__glow" aria-hidden="true" />

        {/* Content layer */}
        <span className="glass-button__content">
          {loading && <LoadingSpinner size={size} />}
          {!loading && icon && (
            <span className="glass-button__icon glass-button__icon--start" aria-hidden="true">
              {icon}
            </span>
          )}
          {children && <span className="glass-button__text">{children}</span>}
          {!loading && iconEnd && (
            <span className="glass-button__icon glass-button__icon--end" aria-hidden="true">
              {iconEnd}
            </span>
          )}
        </span>
      </button>
    );
  }
);
