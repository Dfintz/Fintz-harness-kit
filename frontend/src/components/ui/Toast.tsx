/**
 * Toast Component - Unified toast/notification component for the SC Fleet Manager Design System
 *
 * This component provides a consistent toast interface using Material-UI's
 * Alert component for accessible, modern notifications.
 */

import {
  CheckCircle,
  Close as CloseIcon,
  ErrorOutline,
  InfoOutlined,
  WarningAmber,
} from '@mui/icons-material';
import { Box, Stack, Typography } from '@mui/material';
import { alpha, useTheme, type Theme } from '@mui/material/styles';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { IconButton } from './IconButton';
export type ToastVariant = 'success' | 'error' | 'warning' | 'info';
export type ToastPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface ToastOptions {
  /** Variant/severity of the toast */
  variant?: ToastVariant;
  /** Title of the toast (optional) */
  title?: string;
  /** Main message of the toast */
  message: string;
  /** Duration in milliseconds (0 for persistent) */
  duration?: number;
  /** Position of the toast */
  position?: ToastPosition;
  /** Action button to display */
  action?: React.ReactNode;
  /** Whether to show close button */
  closable?: boolean;
}

interface Toast extends ToastOptions {
  id: string;
}

interface ToastContextValue {
  /** Show a toast notification */
  toast: (options: ToastOptions) => string;
  /** Show a success toast */
  success: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  /** Show an error toast */
  error: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  /** Show a warning toast */
  warning: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  /** Show an info toast */
  info: (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => string;
  /** Dismiss a toast by ID */
  dismiss: (id: string) => void;
  /** Dismiss all toasts */
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

// Get variant color
const getVariantColor = (variant: ToastVariant, theme: Theme): string => {
  switch (variant) {
    case 'success':
      return theme.palette.success.light;
    case 'error':
      return theme.palette.error.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'info':
    default:
      return theme.palette.primary.main;
  }
};

// Get variant icon
const getVariantIcon = (variant: ToastVariant, theme: Theme): React.ReactNode => {
  const _iconStyle = { fontSize: '20px' };
  switch (variant) {
    case 'success':
      return <CheckCircle sx={{ color: theme.palette.success.light }} />;
    case 'error':
      return <ErrorOutline sx={{ color: theme.palette.error.main }} />;
    case 'warning':
      return <WarningAmber sx={{ color: theme.palette.warning.main }} />;
    case 'info':
    default:
      return <InfoOutlined sx={{ color: theme.palette.primary.main }} />;
  }
};

// Get variant background
const getVariantBackground = (variant: ToastVariant, theme: Theme): string => {
  switch (variant) {
    case 'success':
      return alpha(theme.palette.success.light, 0.1);
    case 'error':
      return alpha(theme.palette.error.main, 0.1);
    case 'warning':
      return alpha(theme.palette.warning.main, 0.1);
    case 'info':
    default:
      return alpha(theme.palette.primary.main, 0.1);
  }
};

// Custom Toast Item Component
interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const variant = toast.variant || 'info';
  const theme = useTheme();

  return (
    <Box
      sx={{
        backgroundColor: getVariantBackground(variant, theme),
        border: `1px solid ${alpha(getVariantColor(variant, theme), 0.25)}`,
        borderRadius: '8px',
        padding: '12px 16px',
        minWidth: '300px',
        maxWidth: '500px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        marginBottom: '8px',
      }}
    >
      <Stack direction="row" alignItems="start" spacing={1.5}>
        <Box sx={{ marginTop: '2px' }}>{getVariantIcon(variant, theme)}</Box>
        <Box sx={{ flex: 1 }}>
          {toast.title && (
            <Typography
              sx={{
                fontWeight: 600,
                color: getVariantColor(variant, theme),
                display: 'block',
                marginBottom: '4px',
              }}
            >
              {toast.title}
            </Typography>
          )}
          <Typography sx={{ color: 'text.primary' }}>{toast.message}</Typography>
          {toast.action && <Box mt={1}>{toast.action}</Box>}
        </Box>
        {toast.closable && (
          <IconButton
            isQuiet
            onClick={() => onDismiss(toast.id)}
            aria-label="Close"
            sx={{ marginTop: '-4px', marginRight: '-8px' }}
            size="sm"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Stack>
    </Box>
  );
};

/**
 * Toast Provider component that manages toast state.
 * Wrap your app with this component to enable toasts.
 *
 * @example
 * <ToastProvider>
 *   <App />
 * </ToastProvider>
 */
export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback(
    (options: ToastOptions): string => {
      const id = generateId();
      const newToast: Toast = {
        id,
        variant: 'info',
        duration: 5000,
        position: 'bottom-right',
        closable: true,
        ...options,
      };
      setToasts(prev => [...prev, newToast]);

      // Auto-dismiss after duration (if not 0)
      if (newToast.duration && newToast.duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, newToast.duration);
      }

      return id;
    },
    [dismiss]
  );

  const success = useCallback(
    (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) =>
      toast({ ...options, message, variant: 'success' }),
    [toast]
  );

  const error = useCallback(
    (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) =>
      toast({ ...options, message, variant: 'error', duration: 0 }), // Errors persist by default
    [toast]
  );

  const warning = useCallback(
    (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) =>
      toast({ ...options, message, variant: 'warning' }),
    [toast]
  );

  const info = useCallback(
    (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) =>
      toast({ ...options, message, variant: 'info' }),
    [toast]
  );

  const contextValue: ToastContextValue = {
    toast,
    success,
    error,
    warning,
    info,
    dismiss,
    dismissAll,
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {/* Toast container positioned at bottom-right */}
      <Box
        sx={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column-reverse',
        }}
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </Box>
    </ToastContext.Provider>
  );
}

/**
 * Hook to access the toast context.
 *
 * @example
 * function MyComponent() {
 *   const { success, error } = useToast();
 *
 *   const handleSave = async () => {
 *     try {
 *       await saveData();
 *       success('Data saved successfully!');
 *     } catch (err) {
 *       error('Failed to save data');
 *     }
 *   };
 * }
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
