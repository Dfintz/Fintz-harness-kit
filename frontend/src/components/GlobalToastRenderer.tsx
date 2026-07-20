/**
 * GlobalToastRenderer
 *
 * Renders notifications from the Zustand UI store as RSI-sync-style toast cards.
 * Mounted once in App.tsx — any component can trigger toasts via useNotification().
 */

import {
  Error as AlertIcon,
  CheckCircle as CheckmarkCircleIcon,
  Close as CloseIcon,
  InfoOutlined as InfoOutlineIcon,
} from '@mui/icons-material';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';

import { selectNotifications, useUIStore } from '@/store/uiStore';
import type { Notification } from '@/types/store';

// ─── Individual toast item ───────────────────────────────────────────────────

interface ToastItemProps {
  notification: Notification;
  onRemove: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onRemove }) => {
  const [isExiting, setIsExiting] = useState(false);
  const theme = useTheme();

  const handleRemove = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(notification.id);
    }, 300);
  }, [notification.id, onRemove]);

  useEffect(() => {
    const dur = notification.duration;
    if (dur && dur > 0) {
      const timer = setTimeout(handleRemove, dur);
      return () => clearTimeout(timer);
    }
  }, [notification.id, notification.duration, handleRemove]);

  const getColor = () => {
    switch (notification.type) {
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

  const getIcon = () => {
    switch (notification.type) {
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

  const color = getColor();
  const Icon = getIcon();

  return (
    <Box
      sx={{
        backgroundColor: 'background.paper',
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: '8px',
        padding: 2,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        minWidth: '320px',
        maxWidth: '400px',
        pointerEvents: 'auto',
        animation: isExiting
          ? 'toastSlideOut 0.3s ease-out forwards'
          : 'toastSlideIn 0.3s ease-out',
        transform: isExiting ? 'translateX(120%)' : 'translateX(0)',
        position: 'relative',
        '@keyframes toastSlideIn': {
          from: { transform: 'translateX(120%)', opacity: 0 },
          to: { transform: 'translateX(0)', opacity: 1 },
        },
        '@keyframes toastSlideOut': {
          from: { transform: 'translateX(0)', opacity: 1 },
          to: { transform: 'translateX(120%)', opacity: 0 },
        },
        '@keyframes toastShrink': {
          from: { transform: 'scaleX(1)' },
          to: { transform: 'scaleX(0)' },
        },
        '@media (prefers-reduced-motion: reduce)': {
          animation: 'none',
        },
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Icon
          sx={{
            color,
            flexShrink: 0,
            marginTop: '2px',
            fontSize: 24,
          }}
        />

        <Stack direction="column" spacing={0.5} flex={1}>
          {notification.title && (
            <Typography
              sx={{
                fontWeight: 600,
                fontSize: '0.9rem',
                color,
              }}
            >
              {notification.title}
            </Typography>
          )}

          <Typography
            sx={{
              fontSize: '0.875rem',
              color: notification.title ? 'text.secondary' : color,
              fontWeight: notification.title ? 400 : 600,
              lineHeight: 1.4,
            }}
          >
            {notification.message}
          </Typography>

          {notification.action && (
            <Box
              component="button"
              onClick={notification.action.onClick}
              sx={{
                marginTop: 1,
                padding: '6px 12px',
                backgroundColor: color,
                color: 'common.black',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: theme.transitions.create('opacity', { duration: 200 }),
                alignSelf: 'flex-start',
                '&:hover': { opacity: 0.8 },
              }}
            >
              {notification.action.label}
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

      {(notification.duration ?? 0) > 0 && (
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
              backgroundColor: color,
              animation: `toastShrink ${notification.duration}ms linear`,
              transformOrigin: 'left',
            }}
          />
        </Box>
      )}
    </Box>
  );
};

// ─── Global container ────────────────────────────────────────────────────────

export const GlobalToastRenderer: React.FC = () => {
  const notifications = useUIStore(selectNotifications);
  const removeNotification = useUIStore(state => state.removeNotification);

  if (notifications.length === 0) return null;

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
      {notifications.map(n => (
        <ToastItem key={n.id} notification={n} onRemove={removeNotification} />
      ))}
    </Box>
  );
};
