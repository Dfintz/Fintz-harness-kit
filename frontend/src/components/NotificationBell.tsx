import type { Notification } from '@/types/apiV2';
import { Close as CloseIcon, Notifications as NotificationsIcon } from '@mui/icons-material';
import { Chip as Badge, Box, Button, Divider, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';
import { IconButton } from './ui';

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClear: (id: string) => void;
  onClearAll: () => void;
  onNotificationClick?: (notification: Notification) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  unreadCount,
  onMarkAsRead,
  onMarkAllAsRead,
  onClear,
  onClearAll,
  onNotificationClick,
}) => {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'S';
      case 'error':
        return 'E';
      case 'warning':
        return 'W';
      default:
        return 'i';
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return theme.palette.success.main;
      case 'error':
        return theme.palette.error.light;
      case 'warning':
        return theme.palette.warning.main;
      default:
        return theme.palette.primary.main;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <IconButton
        onClick={() => setIsOpen(!isOpen)}
        isQuiet
        sx={{
          position: 'relative',
        }}
      >
        <NotificationsIcon />
        {unreadCount > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '-4px',
              right: '-4px',
              backgroundColor: theme.palette.error.light,
              color: 'white',
              borderRadius: '10px',
              padding: '2px 6px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              minWidth: '20px',
              textAlign: 'center',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </div>
        )}
      </IconButton>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '400px',
            maxHeight: '600px',
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: '8px',
            boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.5)}`,
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{
              padding: '16px',
              borderBottom: 1,
              borderColor: 'divider',
              backgroundColor: 'action.hover',
            }}
          >
            <Typography variant="h6" sx={{ margin: 0 }}>
              Notifications
              {unreadCount > 0 && (
                <Badge
                  label={String(unreadCount)}
                  color="success"
                  size="small"
                  sx={{ marginLeft: '8px' }}
                />
              )}
            </Typography>
            <Stack spacing={1}>
              {notifications.length > 0 && (
                <>
                  {unreadCount > 0 && (
                    <Button
                      variant="outlined"
                      onClick={onMarkAllAsRead}
                      sx={{ fontSize: '0.75rem', padding: '4px 8px' }}
                    >
                      Mark all read
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    onClick={onClearAll}
                    sx={{ fontSize: '0.75rem', padding: '4px 8px' }}
                  >
                    Clear all
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          {/* Notifications List */}
          <div
            style={{
              overflowY: 'auto',
              flex: 1,
              maxHeight: '500px',
            }}
          >
            {notifications.length === 0 ? (
              <Box p={4}>
                <Stack direction="column" alignItems="center" spacing={2}>
                  <NotificationsIcon
                    style={{ color: theme.palette.text.secondary, fontSize: '3rem' }}
                  />
                  <Typography sx={{ color: 'text.secondary', textAlign: 'center' }}>
                    No notifications
                  </Typography>
                </Stack>
              </Box>
            ) : (
              notifications.map((notification, index) => (
                <div key={notification.id}>
                  <button
                    type="button"
                    style={{
                      border: 'none',
                      width: '100%',
                      textAlign: 'left',
                      font: 'inherit',
                      color: 'inherit',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      backgroundColor: notification.read
                        ? 'transparent'
                        : alpha(theme.palette.primary.main, 0.05),
                      borderLeft: `3px solid ${getNotificationColor(notification.type)}`,
                      transition: theme.transitions.create('background-color', { duration: 200 }),
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = alpha(
                        theme.palette.common.white,
                        0.05
                      );
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = notification.read
                        ? 'transparent'
                        : alpha(theme.palette.primary.main, 0.05);
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="start">
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: getNotificationColor(notification.type),
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: theme.palette.common.black,
                          fontWeight: 600,
                          fontSize: '0.75rem',
                          flexShrink: 0,
                        }}
                      >
                        {getNotificationIcon(notification.type)}
                      </div>
                      <Stack direction="column" spacing={0.5} flex={1}>
                        <Stack direction="row" justifyContent="space-between" alignItems="start">
                          <Typography
                            sx={{
                              fontWeight: notification.read ? 400 : 600,
                              fontSize: '0.875rem',
                              Stack: 1,
                            }}
                          >
                            {notification.title}
                          </Typography>
                          <Box
                            component="span"
                            onClick={(e: React.MouseEvent) => e.stopPropagation()}
                            onKeyDown={(e: React.KeyboardEvent) => e.stopPropagation()}
                          >
                            <IconButton
                              isQuiet
                              onClick={() => onClear(notification.id)}
                              sx={{
                                minWidth: 'auto',
                                padding: '2px',
                              }}
                              size="sm"
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Stack>
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            lineHeight: 1.4,
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            marginTop: '4px',
                          }}
                        >
                          {new Date(notification.timestamp).toLocaleString()}
                        </Typography>
                        {notification.category && (
                          <Badge
                            label={notification.category}
                            size="small"
                            sx={{
                              fontSize: '0.65rem',
                              marginTop: '4px',
                              alignSelf: 'flex-start',
                            }}
                          />
                        )}
                      </Stack>
                    </Stack>
                  </button>
                  {index < notifications.length - 1 && <Divider />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
