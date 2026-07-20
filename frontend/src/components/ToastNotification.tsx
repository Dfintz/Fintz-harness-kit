import {
  Error as AlertIcon,
  CheckCircle as CheckmarkCircleIcon,
  Close as CloseIcon,
  InfoOutlined as InfoOutlineIcon,
} from '@mui/icons-material';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';

export interface ToastData {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number; // milliseconds, 0 for persistent
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastNotificationProps {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ toasts, onRemove }) => {
  return (
    <Box
      aria-live="polite"
      role="status"
      sx={{
        position: 'fixed',
        top: '80px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        maxWidth: '400px',
        pointerEvents: 'none',
      }}
    >
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </Box>
  );
};

interface ToastItemProps {
  toast: ToastData;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const timer = setTimeout(() => {
        handleRemove();
      }, toast.duration);

      return () => clearTimeout(timer);
    }
  }, [toast.id, toast.duration]);

  const handleRemove = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 300);
  };

  const getToastColor = () => {
    switch (toast.type) {
      case 'success':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.main;
      case 'warning':
        return theme.palette.warning.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const getToastIcon = () => {
    switch (toast.type) {
      case 'success':
        return CheckmarkCircleIcon;
      case 'error':
        return AlertIcon;
      case 'warning':
        return AlertIcon;
      default:
        return InfoOutlineIcon;
    }
  };

  const ToastIcon = getToastIcon();

  return (
    <Box
      sx={{
        backgroundColor: 'background.paper',
        border: `1px solid ${getToastColor()}`,
        borderLeft: `4px solid ${getToastColor()}`,
        borderRadius: '8px',
        padding: 2,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        minWidth: '320px',
        maxWidth: '400px',
        pointerEvents: 'auto',
        animation: isExiting ? 'slideOut 0.3s ease-out forwards' : 'slideIn 0.3s ease-out',
        transform: isExiting ? 'translateX(120%)' : 'translateX(0)',
        position: 'relative',
        '@keyframes slideIn': {
          from: {
            transform: 'translateX(120%)',
            opacity: 0,
          },
          to: {
            transform: 'translateX(0)',
            opacity: 1,
          },
        },
        '@keyframes slideOut': {
          from: {
            transform: 'translateX(0)',
            opacity: 1,
          },
          to: {
            transform: 'translateX(120%)',
            opacity: 0,
          },
        },
        '@keyframes shrink': {
          from: {
            transform: 'scaleX(1)',
          },
          to: {
            transform: 'scaleX(0)',
          },
        },
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <ToastIcon
          sx={{
            color: getToastColor(),
            flexShrink: 0,
            marginTop: '2px',
            fontSize: 24,
          }}
        />

        <Stack direction="column" spacing={0.5} flex={1}>
          <Typography
            sx={{
              fontWeight: 600,
              fontSize: '0.9rem',
              color: getToastColor(),
            }}
          >
            {toast.title}
          </Typography>

          {toast.message && (
            <Typography
              sx={{
                fontSize: '0.875rem',
                color: 'text.secondary',
                lineHeight: 1.4,
              }}
            >
              {toast.message}
            </Typography>
          )}

          {toast.action && (
            <Box
              component="button"
              onClick={toast.action.onClick}
              sx={{
                marginTop: 1,
                padding: '6px 12px',
                backgroundColor: getToastColor(),
                color: 'common.black',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: theme.transitions.create('opacity', { duration: 200 }),
                alignSelf: 'flex-start',
                '&:hover': {
                  opacity: 0.8,
                },
              }}
            >
              {toast.action.label}
            </Box>
          )}
        </Stack>

        <IconButton
          onClick={handleRemove}
          size="small"
          sx={{
            color: 'text.secondary',
            padding: '4px',
            flexShrink: 0,
            '&:hover': {
              color: 'common.white',
              backgroundColor: 'transparent',
            },
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>

      {toast.duration && toast.duration > 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: alpha(theme.palette.common.white, 0.1),
            borderRadius: '0 0 8px 8px',
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              height: '100%',
              backgroundColor: getToastColor(),
              animation: `shrink ${toast.duration}ms linear`,
              transformOrigin: 'left',
            }}
          />
        </Box>
      )}
    </Box>
  );
};

// Hook for managing toasts
export const useToasts = () => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const addToast = (toast: Omit<ToastData, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: ToastData = {
      ...toast,
      id,
      duration: toast.duration ?? 5000, // Default 5 seconds
    };
    setToasts(prev => [...prev, newToast]);
    return id;
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const showSuccess = (title: string, message?: string, duration?: number) => {
    return addToast({ type: 'success', title, message, duration });
  };

  const showError = (title: string, message?: string, duration?: number) => {
    return addToast({ type: 'error', title, message, duration });
  };

  const showWarning = (title: string, message?: string, duration?: number) => {
    return addToast({ type: 'warning', title, message, duration });
  };

  const showInfo = (title: string, message?: string, duration?: number) => {
    return addToast({ type: 'info', title, message, duration });
  };

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};
