/**
 * DEKManagementPanel
 *
 * Lists Data Encryption Keys (DEKs) for the organization and allows
 * administrators to manage access (grant / revoke per user).
 *
 * Uses the hybrid encryption query hooks and the EncryptionKeyProvider context.
 */

import { useEncryptionKeys } from '@/components/encryption/EncryptionKeyProvider';
import { useDEKs } from '@/hooks/queries/useHybridEncryptionQueries';
import type { DEKResponse } from '@/services/crypto/encryptionApiService';
import { Key as KeyIcon, Lock as LockIcon, LockOpen as LockOpenIcon } from '@mui/icons-material';
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DEKManagementPanelProps {
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DEKManagementPanel: React.FC<Readonly<DEKManagementPanelProps>> = ({
  organizationId,
}) => {
  const { isUnlocked } = useEncryptionKeys();
  const { data: dekData, isLoading, error } = useDEKs(organizationId);

  if (!isUnlocked) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          <LockIcon color="warning" />
          <Typography variant="h6">Data Encryption Keys</Typography>
        </Box>
        <Alert severity="info">
          Unlock the encryption vault to view and manage Data Encryption Keys.
        </Alert>
      </Paper>
    );
  }

  if (isLoading) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={1}>
          <CircularProgress size={20} />
          <Typography variant="body2" color="text.secondary">
            Loading encryption keys...
          </Typography>
        </Box>
      </Paper>
    );
  }

  if (error) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Alert severity="error">
          Failed to load Data Encryption Keys.{' '}
          {error instanceof Error ? error.message : 'Unknown error'}
        </Alert>
      </Paper>
    );
  }

  const deks = dekData?.deks ?? [];

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <KeyIcon color="primary" />
          <Typography variant="h6">Data Encryption Keys</Typography>
        </Box>
        <Chip
          label={`${deks.length} key${deks.length === 1 ? '' : 's'}`}
          size="small"
          variant="outlined"
        />
      </Box>

      {deks.length === 0 ? (
        <Alert severity="info">
          No Data Encryption Keys have been created yet. DEKs are automatically created when you
          encrypt data using hybrid mode.
        </Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>DEK ID</TableCell>
                <TableCell>Data Type</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>Algorithm</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deks.map((dek: DEKResponse) => (
                <TableRow key={dek.id} hover>
                  <TableCell>
                    <Typography
                      variant="body2"
                      fontFamily="monospace"
                      sx={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {dek.dekId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={dek.dataType} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {dek.resourceId ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{dek.algorithm}</Typography>
                  </TableCell>
                  <TableCell>
                    {dek.isActive ? (
                      <Chip
                        icon={<LockOpenIcon />}
                        label="Active"
                        color="success"
                        size="small"
                        variant="outlined"
                      />
                    ) : (
                      <Chip
                        icon={<LockIcon />}
                        label="Revoked"
                        color="error"
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(dek.createdAt)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};
