// Fringe Core design system colors — dark theme matching the web frontend
export const Colors = {
  // Primary colors (Fringe Core cyan)
  primary: '#00d9ff',
  primaryDark: '#00b8d4',
  primaryLight: '#00ffff',

  // Secondary colors (purple accent)
  secondary: '#9333ea',
  secondaryDark: '#7e22ce',
  secondaryLight: '#a855f7',

  // Status colors
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Text colors
  text: '#b0c4de',
  textSecondary: '#8a9eb5',
  textTertiary: '#5a7a99',
  textInverse: '#0a1628',
  textBright: '#e2e8f0',

  // Background colors (dark theme)
  background: '#0a1628',
  surface: '#0c1a2e',
  surfaceElevated: '#112240',
  overlay: 'rgba(0, 0, 0, 0.7)',

  // Border colors
  border: 'rgba(0, 217, 255, 0.2)',
  borderLight: 'rgba(0, 217, 255, 0.1)',
  borderDark: 'rgba(0, 217, 255, 0.3)',

  // State colors
  online: '#10b981',
  offline: '#5a7a99',
  away: '#f59e0b',
};

// Typography styles
export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: Colors.primary,
  },
  h2: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: Colors.primary,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600' as const,
    color: Colors.textBright,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.textBright,
  },
  body1: {
    fontSize: 16,
    color: Colors.text,
  },
  body2: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  caption: {
    fontSize: 12,
    color: Colors.textTertiary,
  },
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textInverse,
  },
};

// Spacing system
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

// Border radius
export const BorderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};

// Shadow styles (subtle glow for dark theme)
export const Shadows = {
  small: {
    shadowColor: '#00d9ff',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  medium: {
    shadowColor: '#00d9ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  large: {
    shadowColor: '#00d9ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
};
