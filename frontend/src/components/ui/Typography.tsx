/**
 * Typography Components - SC Fleet Manager Design System
 *
 * A comprehensive set of typography components built on the design tokens.
 * Implements a Major Third (1.25) type scale with proper tracking, line-height,
 * and responsive behavior.
 */

import React, { CSSProperties, forwardRef } from 'react';
import { fontSize, fontWeight, letterSpacing, lineHeight } from './tokens';

// ============================================================================
// Types
// ============================================================================

export type TextColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'inherit';
export type TextAlign = 'left' | 'center' | 'right';
export type DisplaySize = 'lg' | 'md' | 'sm';
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
export type TextSize = 'lg' | 'base' | 'sm' | 'xs';
export type TextWeight = 'normal' | 'medium' | 'semibold' | 'bold';

interface BaseTypographyProps {
  /** Text color variant */
  color?: TextColor;
  /** Text alignment */
  align?: TextAlign;
  /** Whether to truncate text with ellipsis */
  truncate?: boolean;
  /** Number of lines before truncating (requires truncate=true) */
  maxLines?: number;
  /** Additional className */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Legacy Spectrum escape hatch; merged with style for compatibility */
  UNSAFE_style?: CSSProperties;
  /** Children content */
  children: React.ReactNode;
  /** Test ID for testing */
  testId?: string;
}

export interface DisplayProps extends BaseTypographyProps {
  /** Display size variant */
  size?: DisplaySize;
  /** HTML tag to render */
  as?: 'h1' | 'h2' | 'div' | 'span';
  /** Use gradient text effect */
  gradient?: boolean;
}

export interface HeadingProps extends BaseTypographyProps {
  /** Heading level (1-6) */
  level?: HeadingLevel;
  /** Override visual size (for semantic vs visual separation) */
  visualLevel?: HeadingLevel;
}

export interface TextProps extends BaseTypographyProps {
  /** Text size variant */
  size?: TextSize;
  /** Font weight */
  weight?: TextWeight;
  /** HTML tag to render */
  as?: 'p' | 'span' | 'div' | 'strong' | 'em';
  /** Line height variant */
  leading?: 'tight' | 'normal' | 'relaxed' | 'prose';
}

export interface LabelProps extends BaseTypographyProps {
  /** Label size variant */
  size?: 'sm' | 'base';
  /** Whether to render as uppercase */
  uppercase?: boolean;
  /** Associated form element ID */
  htmlFor?: string;
  /** Is required indicator */
  required?: boolean;
}

export interface CaptionProps extends BaseTypographyProps {
  /** HTML tag to render */
  as?: 'span' | 'p' | 'figcaption';
}

export interface CodeProps extends BaseTypographyProps {
  /** Whether to render as a block (pre) or inline (code) */
  block?: boolean;
}

// ============================================================================
// Color Mapping
// ============================================================================

const colorMap: Record<TextColor, string> = {
  primary: 'var(--text-primary)',
  secondary: 'var(--text-secondary)',
  muted: 'var(--text-muted)',
  accent: 'var(--accent-blue)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  error: 'var(--error)',
  inherit: 'inherit',
};

// ============================================================================
// Utility Functions
// ============================================================================

function getBaseStyles(
  color: TextColor,
  align: TextAlign,
  truncate: boolean,
  maxLines?: number
): CSSProperties {
  const baseStyles: CSSProperties = {
    color: colorMap[color],
    textAlign: align,
    margin: 0,
  };

  if (truncate) {
    if (maxLines && maxLines > 1) {
      return {
        ...baseStyles,
        display: '-webkit-box',
        WebkitLineClamp: maxLines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      };
    }
    return {
      ...baseStyles,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };
  }

  return baseStyles;
}

// ============================================================================
// Display Size Config
// ============================================================================

const displaySizeMap: Record<
  DisplaySize,
  { fontSize: string; lineHeight: string | number; fluidSize: string }
> = {
  lg: {
    fontSize: fontSize['6xl'],
    lineHeight: lineHeight.display,
    fluidSize: 'clamp(2.5rem, 5vw + 1rem, 4.5rem)',
  },
  md: {
    fontSize: fontSize['5xl'],
    lineHeight: lineHeight.display,
    fluidSize: 'clamp(2rem, 4vw + 1rem, 3.75rem)',
  },
  sm: {
    fontSize: fontSize['4xl'],
    lineHeight: lineHeight.display,
    fluidSize: 'clamp(1.75rem, 3vw + 1rem, 3rem)',
  },
};

// ============================================================================
// Display Component - For hero/large display text
// ============================================================================

/**
 * Display - Large hero text with tight letter-spacing
 *
 * @example
 * <Display size="lg" gradient>Welcome to SC Fleet Manager</Display>
 */
export const Display = forwardRef<HTMLElement, DisplayProps>(function Display(props, ref) {
  const {
    size = 'md',
    as: Component = 'h1',
    color = 'primary',
    gradient = false,
    align = 'left',
    truncate = false,
    maxLines,
    className,
    style,
    UNSAFE_style,
    children,
    testId,
    ...rest
  } = props;

  const sizeConfig = displaySizeMap[size];
  const effectiveColor: TextColor = gradient ? 'inherit' : color;

  const mergedStyle = { ...style, ...UNSAFE_style } as CSSProperties | undefined;

  const displayStyles: CSSProperties = {
    ...getBaseStyles(effectiveColor, align, truncate, maxLines),
    fontSize: sizeConfig.fluidSize,
    fontWeight: fontWeight.bold,
    lineHeight: sizeConfig.lineHeight,
    letterSpacing: letterSpacing.tight, // -0.02em for display text
    ...mergedStyle,
  };

  if (gradient) {
    displayStyles.background = 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))';
    displayStyles.WebkitBackgroundClip = 'text';
    displayStyles.WebkitTextFillColor = 'transparent';
    displayStyles.backgroundClip = 'text';
  }

  return React.createElement(
    Component,
    {
      ref,
      className,
      style: displayStyles,
      'data-testid': testId,
      ...rest,
    },
    children
  );
});

// ============================================================================
// Heading Config
// ============================================================================

const headingConfigMap: Record<
  HeadingLevel,
  { fontSize: string; lineHeight: string | number; weight: number; fluidSize: string }
> = {
  1: {
    fontSize: fontSize['4xl'],
    lineHeight: lineHeight.heading,
    weight: fontWeight.bold,
    fluidSize: 'clamp(1.75rem, 2.5vw + 1rem, 3rem)',
  },
  2: {
    fontSize: fontSize['3xl'],
    lineHeight: lineHeight.heading,
    weight: fontWeight.semibold,
    fluidSize: 'clamp(1.5rem, 2vw + 0.75rem, 2.25rem)',
  },
  3: {
    fontSize: fontSize['2xl'],
    lineHeight: lineHeight.subheading,
    weight: fontWeight.semibold,
    fluidSize: 'clamp(1.25rem, 1.5vw + 0.5rem, 1.875rem)',
  },
  4: {
    fontSize: fontSize.xl,
    lineHeight: lineHeight.subheading,
    weight: fontWeight.semibold,
    fluidSize: 'clamp(1.125rem, 1vw + 0.5rem, 1.5rem)',
  },
  5: {
    fontSize: fontSize.lg,
    lineHeight: lineHeight.normal,
    weight: fontWeight.medium,
    fluidSize: fontSize.lg,
  },
  6: {
    fontSize: fontSize.base,
    lineHeight: lineHeight.normal,
    weight: fontWeight.medium,
    fluidSize: fontSize.base,
  },
};

// ============================================================================
// Heading Component
// ============================================================================

/**
 * Heading - Semantic heading component with proper hierarchy
 *
 * @example
 * <Heading level={1}>Page Title</Heading>
 * <Heading level={2} color="accent">Section Title</Heading>
 */
export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(function Heading(props, ref) {
  const {
    level = 2,
    visualLevel,
    color = 'primary',
    align = 'left',
    truncate = false,
    maxLines,
    className,
    style,
    UNSAFE_style,
    children,
    testId,
    ...rest
  } = props;

  const config = headingConfigMap[visualLevel ?? level];
  const Component = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

  const mergedStyle = { ...style, ...UNSAFE_style } as CSSProperties | undefined;

  const headingStyles: CSSProperties = {
    ...getBaseStyles(color, align, truncate, maxLines),
    fontSize: config.fluidSize,
    fontWeight: config.weight,
    lineHeight: config.lineHeight,
    letterSpacing: level <= 2 ? letterSpacing.tight : letterSpacing.normal,
    marginBottom: '0.5em',
    ...mergedStyle,
  };

  return React.createElement(
    Component,
    {
      ref,
      className,
      style: headingStyles,
      'data-testid': testId,
      ...rest,
    },
    children
  );
});

// ============================================================================
// Text Config
// ============================================================================

const textSizeMap: Record<TextSize, string> = {
  lg: fontSize.lg,
  base: fontSize.base,
  sm: fontSize.sm,
  xs: fontSize.xs,
};

const textLeadingMap: Record<string, string | number> = {
  tight: lineHeight.tight,
  normal: lineHeight.normal,
  relaxed: lineHeight.relaxed,
  prose: lineHeight.prose,
};

// ============================================================================
// Text Component
// ============================================================================

/**
 * Text - Body text component with size and weight variants
 *
 * @example
 * <Text>Regular body text</Text>
 * <Text size="sm" color="secondary">Secondary small text</Text>
 */
export const Text = forwardRef<HTMLElement, TextProps>(function Text(props, ref) {
  const {
    size = 'base',
    weight = 'normal',
    as: Component = 'p',
    leading = 'normal',
    color = 'primary',
    align = 'left',
    truncate = false,
    maxLines,
    className,
    style,
    UNSAFE_style,
    children,
    testId,
    ...rest
  } = props;

  const mergedStyle = { ...style, ...UNSAFE_style } as CSSProperties | undefined;

  const textStyles: CSSProperties = {
    ...getBaseStyles(color, align, truncate, maxLines),
    fontSize: textSizeMap[size],
    fontWeight: fontWeight[weight],
    lineHeight: textLeadingMap[leading],
    letterSpacing: letterSpacing.normal,
    ...mergedStyle,
  };

  return React.createElement(
    Component,
    {
      ref,
      className,
      style: textStyles,
      'data-testid': testId,
      ...rest,
    },
    children
  );
});

// ============================================================================
// Label Component
// ============================================================================

/**
 * Label - Form and UI label component
 *
 * @example
 * <Label htmlFor="email" required>Email Address</Label>
 * <Label uppercase size="sm">CATEGORY</Label>
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(props, ref) {
  const {
    size = 'base',
    uppercase = false,
    color = 'secondary',
    align = 'left',
    truncate = false,
    maxLines,
    className,
    style,
    UNSAFE_style,
    children,
    htmlFor,
    required,
    testId,
    ...rest
  } = props;

  const mergedStyle = { ...style, ...UNSAFE_style } as CSSProperties | undefined;

  const labelStyles: CSSProperties = {
    ...getBaseStyles(color, align, truncate, maxLines),
    fontSize: size === 'sm' ? fontSize.xs : fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.normal,
    letterSpacing: uppercase ? letterSpacing.wider : letterSpacing.normal,
    textTransform: uppercase ? 'uppercase' : 'none',
    display: 'inline-block',
    marginBottom: '0.25rem',
    ...mergedStyle,
  };

  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={className}
      style={labelStyles}
      data-testid={testId}
      {...rest}
    >
      {children}
      {required && (
        <span style={{ color: colorMap.error, marginLeft: '0.25rem' }} aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
});

// ============================================================================
// Caption Component
// ============================================================================

/**
 * Caption - Small text for captions and metadata
 *
 * @example
 * <Caption>Last updated 3 hours ago</Caption>
 * <Caption color="muted">12 items</Caption>
 */
export const Caption = forwardRef<HTMLElement, CaptionProps>(function Caption(props, ref) {
  const {
    as: Component = 'span',
    color = 'muted',
    align = 'left',
    truncate = false,
    maxLines,
    className,
    style,
    UNSAFE_style,
    children,
    testId,
    ...rest
  } = props;

  const mergedStyle = { ...style, ...UNSAFE_style } as CSSProperties | undefined;

  const captionStyles: CSSProperties = {
    ...getBaseStyles(color, align, truncate, maxLines),
    fontSize: fontSize.xs,
    fontWeight: fontWeight.normal,
    lineHeight: lineHeight.normal,
    letterSpacing: letterSpacing.normal,
    ...mergedStyle,
  };

  return React.createElement(
    Component,
    {
      ref,
      className,
      style: captionStyles,
      'data-testid': testId,
      ...rest,
    },
    children
  );
});

// ============================================================================
// Code Component
// ============================================================================

/**
 * Code - Monospace text for code snippets
 *
 * @example
 * <Code>const x = 1;</Code>
 * <Code block>{multiLineCode}</Code>
 */
export const Code = forwardRef<HTMLElement, CodeProps>(function Code(props, ref) {
  const {
    block = false,
    color = 'accent',
    align = 'left',
    truncate = false,
    maxLines,
    className,
    style,
    UNSAFE_style,
    children,
    testId,
    ...rest
  } = props;

  const Component = block ? 'pre' : 'code';

  const mergedStyle = { ...style, ...UNSAFE_style } as CSSProperties | undefined;

  const codeStyles: CSSProperties = {
    ...getBaseStyles(color, align, truncate, maxLines),
    fontFamily: 'source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace',
    fontSize: block ? fontSize.sm : '0.9em',
    lineHeight: block ? lineHeight.relaxed : 'inherit',
    backgroundColor: 'rgba(0, 217, 255, 0.1)',
    padding: block ? '1rem' : '0.125rem 0.375rem',
    borderRadius: block ? '0.5rem' : '0.25rem',
    display: block ? 'block' : 'inline',
    overflowX: block ? 'auto' : 'visible',
    whiteSpace: block ? 'pre' : 'nowrap',
    ...mergedStyle,
  };

  return React.createElement(
    Component,
    {
      ref,
      className,
      style: codeStyles,
      'data-testid': testId,
      ...rest,
    },
    children
  );
});

// Typography tokens are available from './tokens' module directly
