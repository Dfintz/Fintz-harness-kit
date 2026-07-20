/**
 * User Management Component
 * Admin interface for searching and managing users
 */

import { apiClient } from '@/services/apiClient';
import { logger } from '@/utils/logger';
import {
  VpnKey as Key,
  Search,
  PersonAdd as UserAdd,
  Lock as UserLock,
  WarningAmber,
} from '@mui/icons-material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import React, { useState } from 'react';

import './admin-tables.css';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { MenuTrigger, StatusLight, TypographyField } from '@/components/ui/SpectrumCompat';
import { Box, Stack, Typography } from '@mui/material';
interface ObfuscatedUser {
  id: string;
  email: string;
  username: string;
  role: string;
  organizationId?: string;
  createdAt: Date;
  status?: 'active' | 'inactive' | 'disabled';
}

export const UserManagement: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<ObfuscatedUser[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const data = await apiClient.post('/api/v2/admin/users/search', { query: searchQuery });
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      logger.error(
        'Failed to search users:',
        error instanceof Error ? error : new Error(String(error))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (
    action: 'disable' | 'enable' | 'reset-password',
    userId: string
  ) => {
    try {
      await apiClient.post(`/api/v2/admin/users/${userId}/actions`, { action });

      // Refresh the user list
      handleSearch();
    } catch (error) {
      logger.error(
        `Failed to ${action} user:`,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  };

  const getStatusVariant = (status: string): 'positive' | 'notice' | 'negative' => {
    switch (status) {
      case 'active':
        return 'positive';
      case 'inactive':
        return 'notice';
      case 'disabled':
        return 'negative';
      default:
        return 'notice';
    }
  };

  const getRoleVariant = (role: string): 'negative' | 'info' | 'neutral' => {
    switch (role) {
      case 'admin':
        return 'negative';
      case 'org_admin':
        return 'info';
      default:
        return 'neutral';
    }
  };

  return (
    <Box>
      <Box sx={{ borderRadius: 1, p: 2, borderColor: 'warning.main', marginBottom: '24px' }}>
        <Stack direction="row" gap="size-100" alignItems="center">
          <WarningAmber sx={{ color: 'warning.main' }} />
          <Typography>
            <strong>Admin Access:</strong> Usernames and IDs are visible for support and management.
            Email addresses are partially masked. All admin actions are audit-logged.
          </Typography>
        </Stack>
      </Box>

      <Stack direction="row" gap="size-200" marginBottom="size-300">
        <TypographyField
          flex={1}
          label="Search by Organization ID, Role, or Status"
          value={searchQuery}
          onChange={setSearchQuery}
          onKeyDown={(e: React.KeyboardEvent) => e.key === 'Enter' && handleSearch()}
          placeholder="e.g., org-123, admin, active"
          icon={<Search />}
        />
        <Button variant="primary" onClick={handleSearch} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </Stack>

      {users.length > 0 && (
        <>
          <Typography sx={{ color: 'text.secondary', marginBottom: '16px' }}>
            Found {users.length} user{users.length === 1 ? '' : 's'}
          </Typography>

          <Box sx={{ borderRadius: 1, p: 2 }}>
            <Box sx={{ overflowX: 'auto' }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Email</th>
                    <th>Username</th>
                    <th>Role</th>
                    <th>Organization</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {user.id}
                        </Typography>
                      </td>
                      <td>
                        <Typography
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.875rem',
                            color: 'text.secondary',
                          }}
                        >
                          {user.email ?? '—'}
                        </Typography>
                      </td>
                      <td>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {user.username ?? '—'}
                        </Typography>
                      </td>
                      <td>
                        <StatusLight variant={getRoleVariant(user.role)}>{user.role}</StatusLight>
                      </td>
                      <td>
                        <Typography sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                          {user.organizationId ?? '—'}
                        </Typography>
                      </td>
                      <td>
                        <StatusLight variant={getStatusVariant(user.status ?? 'inactive')}>
                          {user.status ?? '—'}
                        </StatusLight>
                      </td>
                      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                      <td className="text-right">
                        <MenuTrigger>
                          <IconButton isQuiet aria-label="More options">
                            <MoreVertIcon />
                          </IconButton>
                          <Box>
                            <Box
                              sx={{
                                cursor: 'pointer',
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                              onClick={() => handleUserAction('disable', user.id)}
                            >
                              <UserLock />
                              <Typography>Disable User</Typography>
                            </Box>
                            <Box
                              sx={{
                                cursor: 'pointer',
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                              onClick={() => handleUserAction('enable', user.id)}
                            >
                              <UserAdd />
                              <Typography>Enable User</Typography>
                            </Box>
                            <Box
                              sx={{
                                cursor: 'pointer',
                                p: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                              }}
                              onClick={() => handleUserAction('reset-password', user.id)}
                            >
                              <Key />
                              <Typography>Reset Password</Typography>
                            </Box>
                          </Box>
                        </MenuTrigger>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Box>
          </Box>
        </>
      )}

      {users.length === 0 && searchQuery && !loading && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'text.secondary' }}>
            No users found matching your search criteria.
          </Typography>
        </Box>
      )}
    </Box>
  );
};
