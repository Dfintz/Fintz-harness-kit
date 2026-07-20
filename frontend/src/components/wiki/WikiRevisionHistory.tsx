/**
 * WikiRevisionHistory — Dialog showing page revision history with restore
 * and side-by-side diff viewer.
 *
 * Lists all revisions for a wiki page. Clicking a revision shows a
 * side-by-side diff between that revision and the current content.
 * Users can restore any past revision with one click.
 *
 * @module wiki
 */

import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import RestoreIcon from '@mui/icons-material/Restore';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import React, { useCallback, useMemo, useState } from 'react';

import type { WikiPageRevision } from '@sc-fleet-manager/shared-types';

import { useWikiRevision, useWikiRevisions } from '@/hooks/queries/useWikiQueries';
import { WikiDiffViewer } from './WikiDiffViewer';

// ─── Props ─────────────────────────────────────────────────────

export interface WikiRevisionHistoryProps {
  /** The page id to show revisions for. */
  pageId: string;
  /** Current page content for diffing against. */
  currentContent: string;
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onClose: () => void;
  /** Called when the user wants to restore a revision. */
  onRestore: (revisionId: string) => void;
  /** Whether a restore is currently in progress. */
  restoring?: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────

function formatRevisionDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ─────────────────────────────────────────────────

export const WikiRevisionHistory: React.FC<Readonly<WikiRevisionHistoryProps>> = ({
  pageId,
  currentContent,
  open,
  onClose,
  onRestore,
  restoring = false,
}) => {
  const { data: revisions = [], isLoading, error } = useWikiRevisions(pageId);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);

  // Fetch the full content of the selected revision for the diff
  const { data: selectedRevision, isLoading: revisionLoading } = useWikiRevision(
    pageId,
    selectedRevisionId ?? undefined
  );

  // The current version is the first entry in revisions (index 0)
  const currentVersion = useMemo(() => revisions[0], [revisions]);

  const handleToggleRevision = useCallback((revisionId: string) => {
    setSelectedRevisionId(prev => (prev === revisionId ? null : revisionId));
  }, []);

  const handleClose = useCallback(() => {
    setSelectedRevisionId(null);
    onClose();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Stack direction="row" spacing={1} alignItems="center">
          <CompareArrowsIcon />
          <Typography variant="h6" component="span">
            Revision History
          </Typography>
          {revisions.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({revisions.length} revision{revisions.length !== 1 ? 's' : ''})
            </Typography>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">Failed to load revisions</Alert>
        ) : revisions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No revisions yet.
          </Typography>
        ) : (
          <List disablePadding>
            {revisions.map((revision: WikiPageRevision, index: number) => {
              const isCurrent = index === 0;
              const isSelected = selectedRevisionId === revision.id;

              return (
                <React.Fragment key={revision.id}>
                  {index > 0 && <Divider />}

                  {/* Revision row */}
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => !isCurrent && handleToggleRevision(revision.id)}
                    sx={{
                      cursor: isCurrent ? 'default' : 'pointer',
                      '&:hover': isCurrent ? { bgcolor: 'transparent' } : undefined,
                    }}
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            v{revision.version}
                          </Typography>
                          {revision.changeDescription && (
                            <Typography variant="body2" color="text.secondary" noWrap>
                              — {revision.changeDescription}
                            </Typography>
                          )}
                          {isCurrent && (
                            <Typography
                              variant="caption"
                              sx={{
                                bgcolor: 'success.main',
                                color: 'success.contrastText',
                                px: 0.75,
                                py: 0.125,
                                borderRadius: 1,
                                fontWeight: 600,
                                fontSize: '0.6875rem',
                              }}
                            >
                              Current
                            </Typography>
                          )}
                        </Stack>
                      }
                      secondary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            {formatRevisionDate(revision.editedAt)} by {revision.editedBy}
                          </Typography>
                          {!isCurrent && (
                            <Typography
                              variant="caption"
                              color="primary.main"
                              sx={{ fontWeight: 500 }}
                            >
                              {isSelected ? 'Click to hide diff' : 'Click to compare'}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />

                    {/* Restore button (not for current version) */}
                    {!isCurrent && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<RestoreIcon />}
                        onClick={e => {
                          e.stopPropagation();
                          onRestore(revision.id);
                        }}
                        disabled={restoring}
                        sx={{ ml: 2, flexShrink: 0 }}
                      >
                        Restore
                      </Button>
                    )}
                  </ListItemButton>

                  {/* Diff panel (collapsible) */}
                  <Collapse in={isSelected && !isCurrent} unmountOnExit>
                    <Box sx={{ px: 2, py: 2, bgcolor: 'action.hover' }}>
                      {revisionLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                          <CircularProgress size={24} />
                        </Box>
                      ) : selectedRevision ? (
                        <WikiDiffViewer
                          oldLabel={`v${revision.version} (selected)`}
                          newLabel={`v${currentVersion?.version ?? '?'} (current)`}
                          oldContent={selectedRevision.content}
                          newContent={currentContent}
                        />
                      ) : (
                        <Alert severity="warning" variant="outlined">
                          Could not load revision content for diff.
                        </Alert>
                      )}
                    </Box>
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
