import { selectUser, useAuthStore } from '@/store/authStore';
import { sanitizeImageUrl } from '@/utils/sanitize';
import {
  Logout as LogoutIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { Avatar, Box, Divider, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthStore(selectUser);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSettings = () => {
    navigate('/settings');
    handleClose();
  };

  const handleProfile = () => {
    navigate('/profile');
    handleClose();
  };

  const handleLogout = () => {
    handleClose();
    navigate('/logout');
  };

  if (!user) {
    return null;
  }

  const userInitials = user.username
    ? user.username
        .split(' ')
        .map(part => part[0])
        .join('')
        .toUpperCase()
    : 'U';

  return (
    <>
      <IconButton
        onClick={handleClick}
        className="user-menu-button"
        aria-label={`${user.username} user menu`}
        aria-expanded={open ? 'true' : 'false'}
        aria-haspopup="true"
      >
        <Avatar
          src={sanitizeImageUrl(user.avatar) || undefined}
          alt={user.username}
          sx={{
            width: 32,
            height: 32,
            bgcolor: 'var(--accent-cyan)',
            color: 'var(--background-primary)',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            border: open ? '2px solid var(--accent-yellow)' : '2px solid transparent',
            transition: theme => theme.transitions.create('all', { duration: 200 }),
          }}
        >
          {userInitials}
        </Avatar>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              bgcolor: 'var(--nav-bg)',
              border: '1px solid var(--nav-border)',
              backdropFilter: 'blur(10px)',
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              '& .MuiMenuItem-root': {
                color: 'var(--text-primary)',
                '&:hover': {
                  bgcolor: 'rgba(0, 153, 204, 0.1)',
                },
              },
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
            {user.username}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
            {user.email}
          </Typography>
        </Box>
        <Divider sx={{ borderColor: 'var(--nav-border)' }} />
        <MenuItem onClick={handleProfile} sx={{ gap: 1 }}>
          <PersonIcon fontSize="small" />
          <span>Profile</span>
        </MenuItem>
        <MenuItem onClick={handleSettings} sx={{ gap: 1 }}>
          <SettingsIcon fontSize="small" />
          <span>Settings</span>
        </MenuItem>
        <MenuItem onClick={handleLogout} sx={{ gap: 1, color: 'var(--status-error)' }}>
          <LogoutIcon fontSize="small" />
          <span>Logout</span>
        </MenuItem>
      </Menu>
    </>
  );
};
