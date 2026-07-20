/**
 * SecureNotes — first domain wired to hybrid encryption (Step D).
 *
 * Lets org members create, list, and decrypt end-to-end encrypted notes.
 * Each note gets its own DEK, wrapped for every registered member.
 */

import AddIcon from '@mui/icons-material/Add';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

import { useEncryptionKeys } from '@/components/encryption/EncryptionKeyProvider';
import { useHybridEncryptedDataList } from '@/hooks/queries/useHybridEncryptionQueries';
import { useHybridCrypto } from '@/hooks/useHybridCrypto';
import type { HybridEncryptedDataListItem } from '@/services/crypto/encryptionApiService';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_TYPE = 'secure-note';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SecureNotesProps {
  organizationId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function NoteDecryptIcon({
  isDecrypting,
  isDecrypted,
}: Readonly<{
  isDecrypting: boolean;
  isDecrypted: boolean;
}>) {
  if (isDecrypting) return <CircularProgress size={18} />;
  if (isDecrypted) return <VisibilityOffIcon />;
  return <VisibilityIcon />;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SecureNotes: React.FC<Readonly<SecureNotesProps>> = ({ organizationId }) => {
  const { isUnlocked } = useEncryptionKeys();
  const { encryptAndStore, fetchAndDecrypt, isReady, isEncrypting } =
    useHybridCrypto(organizationId);
  const {
    data: listData,
    isLoading,
    error,
  } = useHybridEncryptedDataList(organizationId, { dataType: DATA_TYPE });

  const [noteText, setNoteText] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Map of dataId → decrypted text
  const [decryptedNotes, setDecryptedNotes] = useState<Record<string, string>>({});
  const [decryptingIds, setDecryptingIds] = useState<Set<string>>(new Set());

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleSave = useCallback(async () => {
    if (!noteText.trim()) return;
    setSaveError(null);

    try {
      await encryptAndStore(noteText.trim(), DATA_TYPE);
      setNoteText('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save note';
      setSaveError(message);
      logger.error('SecureNotes save failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [noteText, encryptAndStore]);

  const handleToggleDecrypt = useCallback(
    async (item: HybridEncryptedDataListItem) => {
      const id = item.id;

      // If already decrypted, hide it
      if (decryptedNotes[id] !== undefined) {
        setDecryptedNotes(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        return;
      }

      // Decrypt
      setDecryptingIds(prev => new Set(prev).add(id));
      try {
        const plaintext = await fetchAndDecrypt(id);
        setDecryptedNotes(prev => ({ ...prev, [id]: plaintext }));
      } catch (err) {
        logger.error(
          'SecureNotes decrypt failed',
          err instanceof Error ? err : new Error(String(err))
        );
      } finally {
        setDecryptingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [decryptedNotes, fetchAndDecrypt]
  );

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (!isUnlocked) {
    return (
      <Alert severity="info" icon={<LockIcon />}>
        Unlock the encryption vault to view and create secure notes.
      </Alert>
    );
  }

  const notes = listData?.data ?? [];

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <LockOpenIcon color="success" fontSize="small" />
          <Typography variant="h6">Secure Notes</Typography>
        </Box>

        {/* Create note */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            maxRows={4}
            placeholder="Type an encrypted note…"
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            disabled={!isReady || isEncrypting}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleSave}
            disabled={!isReady || isEncrypting || !noteText.trim()}
            sx={{ alignSelf: 'flex-start' }}
          >
            Save
          </Button>
        </Box>

        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {saveError}
          </Alert>
        )}

        {!isReady && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Register a key pair before creating encrypted notes.
          </Alert>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Note list */}
        {isLoading && <CircularProgress size={24} />}
        {error && (
          <Alert severity="error">
            Failed to load notes: {error instanceof Error ? error.message : 'Unknown error'}
          </Alert>
        )}

        {!isLoading && !error && notes.length === 0 && (
          <Typography color="text.secondary" variant="body2">
            No secure notes yet. Create one above.
          </Typography>
        )}

        {notes.length > 0 && (
          <List disablePadding>
            {notes.map(item => {
              const isDecrypted = decryptedNotes[item.id] !== undefined;
              const isDecrypting = decryptingIds.has(item.id);

              return (
                <ListItem
                  key={item.id}
                  divider
                  secondaryAction={
                    <Tooltip title={isDecrypted ? 'Hide' : 'Decrypt'}>
                      <span>
                        <IconButton
                          edge="end"
                          onClick={() => handleToggleDecrypt(item)}
                          disabled={isDecrypting}
                          aria-label={isDecrypted ? 'hide note' : 'decrypt note'}
                        >
                          <NoteDecryptIcon isDecrypting={isDecrypting} isDecrypted={isDecrypted} />
                        </IconButton>
                      </span>
                    </Tooltip>
                  }
                >
                  <ListItemText
                    primary={isDecrypted ? decryptedNotes[item.id] : '••••••••••••••••'}
                    secondary={`Created ${new Date(item.createdAt).toLocaleString()}`}
                    slotProps={{
                      primary: {
                        sx: isDecrypted
                          ? undefined
                          : { fontFamily: 'monospace', color: 'text.disabled' },
                      },
                    }}
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
