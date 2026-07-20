/**
 * KeyPairManager
 *
 * UI component for generating, registering, and managing the user's
 * RSA-OAEP 4096-bit key pair used in hybrid DEK encryption.
 *
 * Flow:
 * 1. Check if user already has a key pair (via context + server)
 * 2. If not, show "Generate Key Pair" button
 * 3. On click: generateUserKeyPair() → storePrivateKey() → registerPublicKey()
 * 4. Show key fingerprint for verification
 * 5. Allow regenerating (revoke old + create new)
 */

import { useEncryptionKeys } from '@/components/encryption/EncryptionKeyProvider';
import {
    usePublicKey,
    useRegisterPublicKey,
    useRevokePublicKey,
} from '@/hooks/queries/useHybridEncryptionQueries';
import { generateUserKeyPair } from '@/services/crypto/encryptionService';
import { useAuthStore } from '@/store/authStore';
import { useNotification } from '@/store/uiStore';
import { logger } from '@/utils/logger';
import {
    CheckCircle as CheckCircleIcon,
    Key as KeyIcon,
    Refresh as RefreshIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useState } from 'react';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface KeyPairManagerProps {
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getKeyErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// ---------------------------------------------------------------------------
// Sub-components (extracted to reduce cognitive complexity of main component)
// ---------------------------------------------------------------------------

function KeyPairStatusChips({
  hasServerKey,
  hasKeyPair,
}: Readonly<{
  hasServerKey: boolean;
  hasKeyPair: boolean;
}>) {
  return (
    <Box display="flex" gap={1} mb={2} flexWrap="wrap">
      <Chip
        icon={hasServerKey ? <CheckCircleIcon /> : <WarningIcon />}
        label={hasServerKey ? 'Public Key Registered' : 'No Public Key'}
        color={hasServerKey ? 'success' : 'warning'}
        size="small"
        variant="outlined"
      />
      <Chip
        icon={hasKeyPair ? <CheckCircleIcon /> : <WarningIcon />}
        label={hasKeyPair ? 'Private Key Stored' : 'No Private Key'}
        color={hasKeyPair ? 'success' : 'warning'}
        size="small"
        variant="outlined"
      />
    </Box>
  );
}

function KeyPairActionButtons({
  hasServerKey,
  hasKeyPair,
  isGenerating,
  isUnlocked,
  onGenerate,
  onRegenerate,
}: Readonly<{
  hasServerKey: boolean;
  hasKeyPair: boolean;
  isGenerating: boolean;
  isUnlocked: boolean;
  onGenerate: () => void;
  onRegenerate: () => void;
}>) {
  if (!hasServerKey && !hasKeyPair) {
    return (
      <Button
        variant="contained"
        startIcon={isGenerating ? <CircularProgress size={16} /> : <KeyIcon />}
        onClick={onGenerate}
        disabled={isGenerating || !isUnlocked}
      >
        {isGenerating ? 'Generating...' : 'Generate Key Pair'}
      </Button>
    );
  }

  return (
    <Button
      variant="outlined"
      color="warning"
      startIcon={isGenerating ? <CircularProgress size={16} /> : <RefreshIcon />}
      onClick={onRegenerate}
      disabled={isGenerating || !isUnlocked}
    >
      {isGenerating ? 'Regenerating...' : 'Regenerate Key Pair'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const KeyPairManager: React.FC<Readonly<KeyPairManagerProps>> = ({ organizationId }) => {
  const theme = useTheme();
  const user = useAuthStore(state => state.user);
  const userId = user?.id;

  const { hasKeyPair, storePrivateKey, clearPrivateKey, isUnlocked } = useEncryptionKeys();
  const { data: serverPublicKey, isLoading: isLoadingPublicKey } = usePublicKey(
    organizationId,
    userId
  );
  const registerPublicKey = useRegisterPublicKey();
  const revokePublicKey = useRevokePublicKey();

  const [isGenerating, setIsGenerating] = useState(false);
  const notification = useNotification();

  // Pre-computed booleans to simplify JSX conditionals
  const hasServerKey = !!serverPublicKey?.publicKey && serverPublicKey.isActive;
  const isFullyConfigured = hasServerKey && hasKeyPair;
  const showMismatchWarning = hasServerKey && !hasKeyPair;

  const handleGenerate = useCallback(async () => {
    if (!userId) return;
    setIsGenerating(true);

    try {
      const keyPair = await generateUserKeyPair();
      await storePrivateKey(keyPair.privateKey);
      await registerPublicKey.mutateAsync({
        organizationId,
        publicKey: keyPair.publicKeyBase64,
        keyFingerprint: keyPair.keyFingerprint,
        keySize: 4096,
      });
      notification.success('Key pair generated and registered successfully');
    } catch (err) {
      notification.error(getKeyErrorMessage(err, 'Failed to generate key pair'));
      logger.error('Key pair generation failed', toError(err));
    } finally {
      setIsGenerating(false);
    }
  }, [userId, organizationId, storePrivateKey, registerPublicKey]);

  const handleRegenerate = useCallback(async () => {
    if (!userId) return;
    setIsGenerating(true);

    try {
      if (hasServerKey) {
        await revokePublicKey.mutateAsync({ organizationId, userId });
      }
      await clearPrivateKey();
      const keyPair = await generateUserKeyPair();
      await storePrivateKey(keyPair.privateKey);
      await registerPublicKey.mutateAsync({
        organizationId,
        publicKey: keyPair.publicKeyBase64,
        keyFingerprint: keyPair.keyFingerprint,
        keySize: 4096,
      });
      notification.success('Key pair regenerated successfully');
    } catch (err) {
      notification.error(getKeyErrorMessage(err, 'Failed to regenerate key pair'));
      logger.error('Key pair regeneration failed', toError(err));
    } finally {
      setIsGenerating(false);
    }
  }, [
    userId,
    organizationId,
    hasServerKey,
    revokePublicKey,
    clearPrivateKey,
    storePrivateKey,
    registerPublicKey,
  ]);

  if (isLoadingPublicKey) {
    return (
      <Box display="flex" alignItems="center" gap={1} p={2}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Checking key pair status...
        </Typography>
      </Box>
    );
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 3,
        borderColor: isFullyConfigured ? theme.palette.success.main : theme.palette.warning.main,
      }}
    >
      <Box display="flex" alignItems="center" gap={1} mb={2}>
        <KeyIcon color={isFullyConfigured ? 'success' : 'warning'} />
        <Typography variant="h6">Hybrid Encryption Key Pair</Typography>
      </Box>

      <KeyPairStatusChips hasServerKey={hasServerKey} hasKeyPair={hasKeyPair} />

      {serverPublicKey?.keyFingerprint && (
        <Box mb={2}>
          <Typography variant="caption" color="text.secondary">
            Key Fingerprint
          </Typography>
          <Typography
            variant="body2"
            fontFamily="monospace"
            sx={{
              wordBreak: 'break-all',
              backgroundColor: theme.palette.action.hover,
              p: 1,
              borderRadius: 1,
            }}
          >
            {serverPublicKey.keyFingerprint}
          </Typography>
        </Box>
      )}

      {showMismatchWarning && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your public key is registered on the server, but no matching private key was found on this
          device. You may need to regenerate your key pair if you lost access to your private key.
        </Alert>
      )}

      <Box display="flex" gap={1}>
        <KeyPairActionButtons
          hasServerKey={hasServerKey}
          hasKeyPair={hasKeyPair}
          isGenerating={isGenerating}
          isUnlocked={isUnlocked}
          onGenerate={handleGenerate}
          onRegenerate={handleRegenerate}
        />
      </Box>

      {!isUnlocked && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Unlock the encryption vault first to manage key pairs.
        </Typography>
      )}
    </Paper>
  );
};
