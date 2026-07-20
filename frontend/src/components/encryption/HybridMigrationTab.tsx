/**
 * HybridMigrationTab
 *
 * Migration controls for transitioning encrypted data from flat org-level
 * master key encryption to per-resource DEK (hybrid) encryption model.
 *
 * Phase 4: Flat-to-Hybrid Migration UI
 */

import { useEncryptionKeys } from '@/components/encryption/EncryptionKeyProvider';
import {
    useCompleteMigrationItem,
    useCreateDEK,
    useInitiateMigration,
    useMigrationCandidates,
    useMigrationProgress,
} from '@/hooks/queries/useHybridEncryptionQueries';
import {
    decryptData,
    encryptData,
    generateDEK,
    wrapDEKForRecipients,
} from '@/services/crypto/encryptionService';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    LinearProgress,
    Stack,
    Typography,
} from '@mui/material';
import React, { useCallback, useRef, useState } from 'react';

interface HybridMigrationTabProps {
  organizationId: string;
  isOwner: boolean;
}

export const HybridMigrationTab: React.FC<Readonly<HybridMigrationTabProps>> = ({
  organizationId,
  isOwner,
}) => {
  const { isUnlocked, orgKey, recipientKeys } = useEncryptionKeys();
  const notification = useNotification();
  const [isMigrating, setIsMigrating] = useState(false);
  const migratedCountRef = useRef(0);

  const { data: progress, isLoading: progressLoading } = useMigrationProgress(organizationId, {
    refetchInterval: isMigrating ? 10000 : false, // 10s poll during migration to stay under rate limits
  });

  const { data: candidates, refetch: refetchCandidates } = useMigrationCandidates(
    organizationId,
    { limit: 20 },
    { enabled: isMigrating }
  );

  const initiateMigration = useInitiateMigration();
  const completeMigrationItem = useCompleteMigrationItem();
  const createDEK = useCreateDEK();

  const handleInitiate = useCallback(async () => {
    try {
      await initiateMigration.mutateAsync(organizationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initiate migration';
      notification.error(message);
      logger.error(
        'Migration initiation failed',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  }, [organizationId, initiateMigration]);

  /**
   * Process migration candidates in batches.
   *
   * For each candidate:
   * 1. Decrypt the data with the org master key
   * 2. Generate a per-resource DEK
   * 3. Re-encrypt the plaintext with the DEK
   * 4. Wrap the DEK for all authorized members
   * 5. Register the DEK and submit re-encrypted data to the server
   */
  const handleStartBatchMigration = useCallback(async () => {
    if (!orgKey || recipientKeys.size === 0) {
      notification.error('Encryption vault must be unlocked with recipient keys available');
      return;
    }

    setIsMigrating(true);
    migratedCountRef.current = 0;

    try {
      const result = await refetchCandidates();
      const items = result.data?.data;

      if (!items || items.length === 0) {
        setIsMigrating(false);
        return;
      }

      for (const item of items) {
        try {
          // 1. Decrypt with the org master key
          const blob = {
            encrypted: item.encryptedData,
            iv: item.encryptionMetadata.iv,
            authTag: item.encryptionMetadata.authTag,
            algorithm: item.encryptionMetadata.algorithm,
          };
          const plaintext = await decryptData(blob, orgKey);

          // 2. Generate a fresh per-resource DEK
          const { dek, dekId } = await generateDEK();

          // 3. Re-encrypt with the DEK
          const reEncrypted = await encryptData(plaintext, dek);

          // 4. Wrap DEK for all authorized recipients
          const wrappedDEKs = await wrapDEKForRecipients(dek, recipientKeys);

          // 5a. Register the DEK on the server
          await createDEK.mutateAsync({
            organizationId,
            dekId,
            dataType: item.dataType,
            resourceId: item.resourceId,
            wrappedKeys: wrappedDEKs,
          });

          // 5b. Submit re-encrypted data and mark migration complete
          await completeMigrationItem.mutateAsync({
            organizationId,
            dataId: item.id,
            dekId,
            encryptedData: reEncrypted.encrypted,
            encryptionMetadata: {
              iv: reEncrypted.iv,
              authTag: reEncrypted.authTag,
              algorithm: reEncrypted.algorithm,
              version: 1,
            },
          });

          migratedCountRef.current += 1;
        } catch (err) {
          logger.error(
            `Failed to migrate item ${item.id}`,
            err instanceof Error ? err : new Error(String(err))
          );
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Migration batch failed';
      notification.error(message);
      logger.error('Batch migration failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsMigrating(false);
    }
  }, [organizationId, orgKey, recipientKeys, refetchCandidates, completeMigrationItem, createDEK]);

  if (progressLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const hasItems = progress && progress.totalItems > 0;
  const hasPending = progress && progress.pendingItems > 0;
  const isComplete =
    progress && progress.totalItems > 0 && progress.flatItems === 0 && progress.pendingItems === 0;

  return (
    <Stack spacing={3}>
      <Typography variant="h6">Hybrid Encryption Migration</Typography>
      <Typography variant="body2" color="text.secondary">
        Migrate encrypted data from the organization-level master key to per-resource Data
        Encryption Keys (DEKs). This provides stronger isolation — each document or resource gets
        its own encryption key, wrapped individually for each authorized user.
      </Typography>

      {/* Progress Card */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1">Migration Progress</Typography>
              {isComplete && <Chip label="Complete" color="success" size="small" />}
              {hasPending && <Chip label="In Progress" color="warning" size="small" />}
              {!hasItems && <Chip label="No Data" color="default" size="small" />}
            </Stack>

            {hasItems && (
              <>
                <LinearProgress
                  variant="determinate"
                  value={progress.percentComplete}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Stack direction="row" spacing={3}>
                  <Typography variant="body2" color="text.secondary">
                    Total: {progress.totalItems}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Flat (legacy): {progress.flatItems}
                  </Typography>
                  <Typography variant="body2" color="warning.main">
                    Pending: {progress.pendingItems}
                  </Typography>
                  <Typography variant="body2" color="success.main">
                    Migrated: {progress.migratedItems}
                  </Typography>
                </Stack>
              </>
            )}

            {!hasItems && (
              <Typography variant="body2" color="text.secondary">
                No encrypted data items found. Migration is not needed until data has been stored
                with the legacy encryption mode.
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {isOwner && hasItems && !isComplete && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="subtitle2">Migration Actions</Typography>

              {!hasPending && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Mark all legacy-encrypted items as pending migration. This does not change any
                    data — it flags items for the re-encryption process.
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={handleInitiate}
                    disabled={initiateMigration.isPending}
                  >
                    {initiateMigration.isPending ? 'Initiating...' : 'Initiate Migration'}
                  </Button>
                </Box>
              )}

              {hasPending && (
                <Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Process pending items: decrypt with the org master key, re-encrypt with
                    per-resource DEKs, and submit. Items are processed in batches of 20.
                  </Typography>
                  {!isUnlocked && (
                    <Alert severity="warning" sx={{ mb: 1 }}>
                      Unlock the encryption vault before starting migration.
                    </Alert>
                  )}
                  <Button
                    variant="contained"
                    onClick={handleStartBatchMigration}
                    disabled={isMigrating || !isUnlocked}
                  >
                    {isMigrating
                      ? `Migrating... (${migratedCountRef.current} done)`
                      : `Start Batch Migration (${progress.pendingItems} pending)`}
                  </Button>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      )}

      {!isOwner && hasItems && !isComplete && (
        <Alert severity="info">
          Only organization owners and administrators can initiate and run data migration.
        </Alert>
      )}

      {isComplete && (
        <Alert severity="success">
          All encrypted data has been successfully migrated to the hybrid DEK model. Each resource
          now has its own encryption key with per-user access control.
        </Alert>
      )}

      {/* Candidates preview (while migrating) */}
      {isMigrating && candidates && candidates.data.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Current Batch ({candidates.data.length} items)
            </Typography>
            {candidates.data.map(item => (
              <Stack key={item.id} direction="row" spacing={2} alignItems="center" sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {item.id.slice(0, 8)}...
                </Typography>
                <Chip label={item.dataType} size="small" variant="outlined" />
                <Chip
                  label={item.migrationStatus}
                  size="small"
                  color={item.migrationStatus === 'migrated' ? 'success' : 'warning'}
                />
              </Stack>
            ))}
          </CardContent>
        </Card>
      )}
    </Stack>
  );
};
