/**
 * Design Tokens - Centralized design values for the SC Fleet Manager Design System
 * 
 * These tokens provide consistent spacing, colors, typography, and other
 * design values that can be used throughout the application.
 */

// Spacing scale (based on 4px grid)
export const spacing = {
  /** 4px */
  xs: '0.25rem',
  /** 8px */
  sm: '0.5rem',
  /** 12px */
  md: '0.75rem',
  /** 16px */
  lg: '1rem',
  /** 24px */
  xl: '1.5rem',
  /** 32px */
  '2xl': '2rem',
  /** 48px */
  '3xl': '3rem',
  /** 64px */
  '4xl': '4rem',
} as const;

// Border radius
export const borderRadius = {
  none: '0',
  sm: '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  full: '9999px',
} as const;

/**
 * Typography Scale - Based on 1.25 (Major Third) scale ratio
 * Base size: 16px (1rem)
 * 
 * Scale progression: 12 → 14 → 16 → 20 → 24 → 30 → 36 → 48 → 60
 * Ratio: 1.25 (Major Third)
 */

// Font sizes - Using Major Third (1.25) scale for harmonious progression
export const fontSize = {
  /** 12px - Caption, labels, metadata */
  xs: '0.75rem',
  /** 14px - Small text, secondary content */
  sm: '0.875rem',
  /** 16px - Base/body text */
  base: '1rem',
  /** 20px - Large body, card titles */
  lg: '1.25rem',
  /** 24px - H4, subsection titles */
  xl: '1.5rem',
  /** 30px - H3, section titles */
  '2xl': '1.875rem',
  /** 36px - H2, major sections */
  '3xl': '2.25rem',
  /** 48px - H1, page titles */
  '4xl': '3rem',
  /** 60px - Display, hero text */
  '5xl': '3.75rem',
  /** 72px - Large display text */
  '6xl': '4.5rem',
} as const;

// Font weights
export const fontWeight = {
  /** 300 - Light, for large display text */
  light: 300,
  /** 400 - Regular body text */
  normal: 400,
  /** 500 - Medium emphasis */
  medium: 500,
  /** 600 - Semi-bold for headings */
  semibold: 600,
  /** 700 - Bold for strong emphasis */
  bold: 700,
} as const;

// Line heights - Optimized for readability at each scale
export const lineHeight = {
  /** 1 - For single-line text (icons, badges) */
  none: 1,
  /** 1.1 - Display/hero text (large sizes) */
  display: 1.1,
  /** 1.2 - Headings (H1-H2) */
  heading: 1.2,
  /** 1.3 - Subheadings (H3-H4) */
  subheading: 1.3,
  /** 1.25 - Tight spacing */
  tight: 1.25,
  /** 1.375 - Snug spacing */
  snug: 1.375,
  /** 1.5 - Normal body text */
  normal: 1.5,
  /** 1.625 - Relaxed body text */
  relaxed: 1.625,
  /** 1.75 - Long-form content */
  prose: 1.75,
  /** 2 - Extra loose spacing */
  loose: 2,
} as const;

// Letter spacing (tracking) - Tighter for display, wider for small caps/labels
export const letterSpacing = {
  /** -0.05em - Very tight for large display */
  tighter: '-0.05em',
  /** -0.02em - Tight for display/headlines */
  tight: '-0.02em',
  /** 0 - Normal */
  normal: '0',
  /** 0.025em - Slightly wide for body */
  wide: '0.025em',
  /** 0.05em - Wide for labels/caps */
  wider: '0.05em',
  /** 0.1em - Widest for uppercase labels */
  widest: '0.1em',
} as const;

// Shadows
export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
} as const;

// Z-index scale
export const zIndex = {
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  modalBackdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
} as const;

// Breakpoints
export const breakpoints = {
  xs: '0px',
  sm: '600px',
  md: '900px',
  lg: '1200px',
  xl: '1536px',
} as const;

// Transition durations
export const duration = {
  fast: '150ms',
  normal: '200ms',
  slow: '300ms',
} as const;

// Transition timing functions
export const easing = {
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// Color palette (semantic colors)
export const colors = {
  // Primary colors
  primary: {
    50: '#e3f2fd',
    100: '#bbdefb',
    200: '#90caf9',
    300: '#64b5f6',
    400: '#42a5f5',
    500: '#2196f3',
    600: '#1e88e5',
    700: '#1976d2',
    800: '#1565c0',
    900: '#0d47a1',
  },
  // Secondary colors
  secondary: {
    50: '#fce4ec',
    100: '#f8bbd0',
    200: '#f48fb1',
    300: '#f06292',
    400: '#ec407a',
    500: '#e91e63',
    600: '#d81b60',
    700: '#c2185b',
    800: '#ad1457',
    900: '#880e4f',
  },
  // Neutral/Gray colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#eeeeee',
    300: '#e0e0e0',
    400: '#bdbdbd',
    500: '#9e9e9e',
    600: '#757575',
    700: '#616161',
    800: '#424242',
    900: '#212121',
  },
  // Success colors
  success: {
    50: '#e8f5e9',
    100: '#c8e6c9',
    200: '#a5d6a7',
    300: '#81c784',
    400: '#66bb6a',
    500: '#4caf50',
    600: '#43a047',
    700: '#388e3c',
    800: '#2e7d32',
    900: '#1b5e20',
  },
  // Warning colors
  warning: {
    50: '#fff3e0',
    100: '#ffe0b2',
    200: '#ffcc80',
    300: '#ffb74d',
    400: '#ffa726',
    500: '#ff9800',
    600: '#fb8c00',
    700: '#f57c00',
    800: '#ef6c00',
    900: '#e65100',
  },
  // Error colors
  error: {
    50: '#ffebee',
    100: '#ffcdd2',
    200: '#ef9a9a',
    300: '#e57373',
    400: '#ef5350',
    500: '#f44336',
    600: '#e53935',
    700: '#d32f2f',
    800: '#c62828',
    900: '#b71c1c',
  },
  // Info colors
  info: {
    50: '#e1f5fe',
    100: '#b3e5fc',
    200: '#81d4fa',
    300: '#4fc3f7',
    400: '#29b6f6',
    500: '#03a9f4',
    600: '#039be5',
    700: '#0288d1',
    800: '#0277bd',
    900: '#01579b',
  },
} as const;

/**
 * SC Fleet Manager - Enhanced Color Palette
 * Based on the UI Beautification & Redesign Proposals
 */
export const scColors = {
  // SC Cyan Primary Spectrum (Brand Color)
  cyan: {
    50: '#e6faff',
    100: '#b3f0ff',
    200: '#80e6ff',
    300: '#4ddbff',
    400: '#1ad1ff',
    500: '#00d9ff',  // Primary accent
    600: '#00adc9',
    700: '#008299',
    800: '#005666',
    900: '#002b33',
  },
  // Background Depth Levels (Dark Theme)
  background: {
    level0: '#050a12',  // Deepest
    level1: '#0a1628',  // Default background
    level2: '#0f1d35',  // Alternate/tertiary
    level3: '#152642',  // Card background
    level4: '#1a2f50',  // Elevated
  },
  // Glass Effect Colors
  glass: {
    background: 'rgba(15, 29, 53, 0.7)',
    backgroundHover: 'rgba(15, 29, 53, 0.85)',
    border: 'rgba(0, 217, 255, 0.2)',
    borderHover: 'rgba(0, 217, 255, 0.4)',
  },
  // SC-themed Semantic Colors (matching Star Citizen aesthetic)
  // NOTE: These are the "neon/HUD" palette for immersive SC-style UI.
  // Standard MUI components use the softer Tailwind-based values in muiTheme.ts.
  success: '#00ff88',
  successDim: 'rgba(0, 255, 136, 0.15)',
  warning: '#ffaa00',
  warningDim: 'rgba(255, 170, 0, 0.15)',
  error: '#ff4444',
  errorDim: 'rgba(255, 68, 68, 0.15)',
  info: '#00d9ff',
  infoDim: 'rgba(0, 217, 255, 0.15)',
  // Accent colors (for decorative / domain use outside MUI theme)
  secondary: '#9333ea',  // Purple accent (matches muiTheme secondary.main)
  pink: '#ec4899',       // Analytics, bounty hunting, reputation
  blue: '#3b82f6',       // Activities, events (matches muiTheme info.main)
  // Text Colors
  text: {
    primary: '#ffffff',
    secondary: '#8a9eb5',
    muted: '#6b7b8a',
  },
  // Special Colors
  gold: '#ffd700',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
} as const;

/**
 * Glass Morphism Effect Configurations
 */
export const glassMorphism = {
  /** Standard glass card */
  card: {
    background: 'rgba(15, 29, 53, 0.7)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(0, 217, 255, 0.2)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
  },
  /** Glass button variant */
  button: {
    background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.2), rgba(0, 153, 204, 0.2))',
    backgroundHover: 'linear-gradient(135deg, rgba(0, 217, 255, 0.4), rgba(0, 153, 204, 0.4))',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    boxShadowHover: '0 0 20px rgba(0, 217, 255, 0.3)',
  },
  /** Glass panel/sidebar */
  panel: {
    background: 'rgba(10, 22, 40, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(0, 217, 255, 0.15)',
  },
} as const;

/**
 * Animation Tokens for Micro-interactions
 */
export const animations = {
  // Timing functions
  timing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
  },
  // Durations
  durations: {
    instant: '100ms',
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
    entrance: '400ms',
    complex: '500ms',
  },
  // Transform values
  transforms: {
    cardLift: 'translateY(-4px)',
    buttonPress: 'scale(0.98)',
    hoverScale: 'scale(1.02)',
  },
  // Shadows for hover effects
  shadows: {
    cardHover: '0 12px 24px rgba(0, 217, 255, 0.15)',
    buttonHover: '0 4px 12px rgba(0, 217, 255, 0.4)',
    glow: '0 0 20px rgba(0, 217, 255, 0.2)',
  },
} as const;

/**
 * Chart/Data Visualization Theme
 */
export const chartTheme = {
  colors: ['#00d9ff', '#00ff88', '#ffaa00', '#ff6b6b', '#9b59b6'],
  axis: {
    stroke: 'rgba(255, 255, 255, 0.1)',
    tickColor: '#8a9eb5',
  },
  grid: {
    stroke: 'rgba(255, 255, 255, 0.05)',
    strokeDasharray: '4 4',
  },
  tooltip: {
    background: 'rgba(15, 29, 53, 0.95)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    borderRadius: '8px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  },
  animation: {
    duration: 800,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
} as const;

// Type exports for TypeScript
export type Spacing = keyof typeof spacing;
export type BorderRadius = keyof typeof borderRadius;
export type FontSize = keyof typeof fontSize;
export type FontWeight = keyof typeof fontWeight;
export type LineHeight = keyof typeof lineHeight;
export type LetterSpacing = keyof typeof letterSpacing;
export type Shadow = keyof typeof shadows;
export type ZIndex = keyof typeof zIndex;
export type Breakpoint = keyof typeof breakpoints;
export type Duration = keyof typeof duration;
export type Easing = keyof typeof easing;
export type ColorScale = keyof typeof colors;
export type ColorShade = keyof typeof colors.primary;
export type SCColorScale = keyof typeof scColors;
export type SCCyanShade = keyof typeof scColors.cyan;
export type SCBackgroundLevel = keyof typeof scColors.background;
