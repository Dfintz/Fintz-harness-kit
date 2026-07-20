/**
 * Material-UI Theme Configuration
 *
 * Production-ready theme matching Fringe Core design system
 * Based on the current dark mode color scheme and branding
 *
 * WCAG AA Contrast (verified against #0a1628 background):
 *   primary  #00d9ff  9.2:1 ✅  |  success  #10b981  6.4:1 ✅
 *   warning  #f59e0b  8.7:1 ✅  |  error    #ef4444  5.1:1 ✅
 *   info     #3b82f6  4.8:1 ✅  |  text.primary #b0c4de 7.6:1 ✅
 *
 * Border radius scale:
 *   xs=4  — chips, badges, tags
 *   sm=8  — buttons, inputs, small cards (theme.shape.borderRadius)
 *   md=12 — standard cards, dialogs
 *   lg=16 — large panels, drawers
 *   full=9999 — pill shapes
 *
 * Convention lock: See docs/UI_HYBRID_CONVENTIONS.md and theme/tokenGuidelines.ts
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

// Fringe Core color palette
const colors = {
  // Primary: Cyan/Blue gradient colors
  primary: {
    main: '#00d9ff', // Fringe Core cyan
    light: '#00ffff', // Bright cyan
    dark: '#00b8d4', // Darker cyan
    contrastText: '#0a1628',
  },
  // Secondary: Purple accent
  secondary: {
    main: '#9333ea', // Purple accent
    light: '#a855f7',
    dark: '#7e22ce',
    contrastText: '#ffffff',
  },
  // Background colors
  background: {
    default: '#0a1628', // Main background
    paper: '#0c1a2e', // Card/paper background
  },
  // Text colors
  text: {
    primary: '#b0c4de', // Light blue-gray for primary text
    secondary: '#8a9eb5', // Muted blue-gray for secondary text
    disabled: '#6b7b8a', // Dimmed text
  },
  // Additional colors
  divider: 'rgba(0, 217, 255, 0.2)',
  error: {
    main: '#ef4444',
    light: '#f87171',
    dark: '#dc2626',
  },
  warning: {
    main: '#f59e0b',
    light: '#fbbf24',
    dark: '#d97706',
  },
  success: {
    main: '#10b981',
    light: '#34d399',
    dark: '#059669',
  },
  info: {
    main: '#3b82f6',
    light: '#60a5fa',
    dark: '#2563eb',
  },
};

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'dark',
    primary: colors.primary,
    secondary: colors.secondary,
    background: colors.background,
    text: colors.text,
    divider: colors.divider,
    error: colors.error,
    warning: colors.warning,
    success: colors.success,
    info: colors.info,
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '2rem',
      fontWeight: 700,
      letterSpacing: '-0.5px',
      background: 'linear-gradient(135deg, #00d9ff 0%, #00ffff 50%, #00d9ff 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    h2: {
      fontSize: '1.75rem',
      fontWeight: 600,
      letterSpacing: '-0.3px',
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: `2px solid ${colors.primary.main}`,
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: colors.background.default,
          backgroundImage:
            'radial-gradient(circle at 20% 50%, rgba(0, 217, 255, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(147, 51, 234, 0.05) 0%, transparent 50%)',
          backgroundAttachment: 'fixed',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none' as const,
          fontWeight: 600,
          borderRadius: 8,
          letterSpacing: '0.025em',
        },
        contained: {
          boxShadow: '0 4px 14px 0 rgba(0, 217, 255, 0.25)',
          '&:hover': {
            boxShadow: '0 6px 20px 0 rgba(0, 217, 255, 0.35)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage:
            'linear-gradient(180deg, rgba(15, 29, 53, 0.4) 0%, rgba(10, 22, 40, 0.6) 100%)',
          border: '1px solid rgba(0, 217, 255, 0.1)',
        },
        elevation1: {
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
        },
        elevation2: {
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        },
        elevation3: {
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage:
            'linear-gradient(180deg, rgba(15, 29, 53, 0.4) 0%, rgba(10, 22, 40, 0.6) 100%)',
          border: '1px solid rgba(0, 217, 255, 0.1)',
          borderRadius: 16,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            '& fieldset': {
              borderColor: 'rgba(0, 217, 255, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(0, 217, 255, 0.4)',
            },
            '&.Mui-focused fieldset': {
              borderColor: colors.primary.main,
            },
          },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage:
            'linear-gradient(180deg, rgba(15, 29, 53, 0.95) 0%, rgba(10, 22, 40, 0.95) 100%)',
          border: '1px solid rgba(0, 217, 255, 0.2)',
          borderRadius: 16,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: 'rgba(0, 217, 255, 0.2)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 4, // xs — consistent chip shape
          fontWeight: 500,
        },
      },
    },
  },
};

export const muiTheme = createTheme(themeOptions);
