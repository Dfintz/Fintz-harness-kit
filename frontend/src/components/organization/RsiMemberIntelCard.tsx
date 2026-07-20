/**
 * RsiMemberIntelCard
 *
 * Full member intelligence card showing RSI data, other org affiliations,
 * Discord status, web app link status, active flags, and role mapping validation.
 * Wave 3.3: RSI Sync Enhancements
 */

import { sanitizeImageUrl } from '@/utils/sanitize';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Autocomplete,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useState } from 'react';

import {
  useEnrichMember,
  useLinkCandidates,
  useManualLink,
  useRsiMemberIntelCard,
  useUnlinkMember,
} from '@/hooks/queries/useRsiMemberIntelQueries';
import type { LinkCandidate } from '@/services/rsiMemberIntelService';
import { logger } from '@/utils/logger';

interface RsiMemberIntelCardProps {
  organizationId: string;
  rsiHandle: string;
  onBack?: () => void;
}

const getOrgTypeLabel = (isMain: boolean, isAffiliate: boolean): string => {
  if (isMain) return 'Main Org';
  if (isAffiliate) return 'Affiliate';
  return 'Member';
};

const getOrgTypeColor = (
  isMain: boolean,
  isAffiliate: boolean
): 'success' | 'warning' | 'default' => {
  if (isMain) return 'success';
  if (isAffiliate) return 'warning';
  return 'default';
};

const getFlagAlertSeverity = (severity: string): 'error' | 'warning' | 'info' => {
  if (severity === 'critical' || severity === 'high') return 'error';
  if (severity === 'medium') return 'warning';
  return 'info';
};

export const RsiMemberIntelCard: React.FC<Readonly<RsiMemberIntelCardProps>> = ({
  organizationId,
  rsiHandle,
  onBack,
}) => {
  const { data: card, isLoading, error } = useRsiMemberIntelCard(organizationId, rsiHandle);
  const enrichMember = useEnrichMember();
  const unlinkMember = useUnlinkMember();
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);

  const handleEnrich = async () => {
    try {
      await enrichMember.mutateAsync({ organizationId, rsiHandle });
    } catch (err: unknown) {
      logger.error('Enrich failed', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUnlink = async () => {
    try {
      await unlinkMember.mutateAsync({ organizationId, rsiHandle });
    } catch (err: unknown) {
      logger.error('Unlink failed', err instanceof Error ? err : new Error(String(err)));
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ py: 3, textAlign: 'center' }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load member card: {error instanceof Error ? error.message : String(error)}
      </Alert>
    );
  }

  if (!card) {
    return <Alert severity="info">Member not found in RSI org data.</Alert>;
  }

  return (
    <Box>
      {/* Back button */}
      {onBack && (
        <Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ mb: 2 }}>
          Back to list
        </Button>
      )}

      {/* RSI Identity */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center">
            {card.avatar && (
              <Avatar
                src={sanitizeImageUrl(card.avatar)}
                alt={card.rsiHandle}
                sx={{ width: 56, height: 56 }}
              />
            )}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6">{card.rsiHandle}</Typography>
              {card.displayName && card.displayName !== card.rsiHandle && (
                <Typography variant="body2" color="text.secondary">
                  {card.displayName}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              {card.rsiRank && (
                <Chip
                  label={`${'★'.repeat(card.rsiStars)}${'☆'.repeat(5 - card.rsiStars)} ${card.rsiRank}`}
                  size="small"
                />
              )}
              {card.rsiRoles &&
                card.rsiRoles.length > 0 &&
                card.rsiRoles.map(role => (
                  <Chip key={role} label={role} size="small" color="info" variant="outlined" />
                ))}
              <Chip
                label={getOrgTypeLabel(card.isMainOrg, card.isAffiliate)}
                size="small"
                color={getOrgTypeColor(card.isMainOrg, card.isAffiliate)}
                variant="outlined"
              />
              {card.isHidden && (
                <Chip label="Hidden" size="small" color="warning" variant="filled" />
              )}
              {card.isRedacted && (
                <Chip label="Redacted" size="small" color="error" variant="filled" />
              )}
            </Stack>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => void handleEnrich()}
              disabled={enrichMember.isPending}
            >
              {enrichMember.isPending ? 'Enriching…' : 'Enrich'}
            </Button>
          </Stack>
          {card.enlisted && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              Enlisted: {card.enlisted}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          alignItems: 'start',
        }}
      >
        {/* Left column */}
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {/* Web App Status */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Web App Status
              </Typography>
              <Stack spacing={0.5}>
                <StatusRow
                  label="Linked"
                  value={card.webAppStatus.isLinked}
                  detail={card.webAppStatus.syncStatus}
                />
                <StatusRow
                  label="Active Member"
                  value={card.webAppStatus.isActiveMember}
                  detail={card.webAppStatus.membershipRole}
                />
              </Stack>
              <Box sx={{ mt: 1.5 }}>
                {card.webAppStatus.isLinked ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={<LinkOffIcon />}
                    onClick={() => void handleUnlink()}
                    disabled={unlinkMember.isPending}
                  >
                    {unlinkMember.isPending ? 'Unlinking…' : 'Unlink User'}
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<LinkIcon />}
                    onClick={() => setLinkDialogOpen(true)}
                  >
                    Link to User
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>

          {/* Discord Status */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Discord Status
              </Typography>
              <Stack spacing={0.5}>
                <StatusRow label="In Guild" value={card.discordStatus.isInGuild} />
                <StatusRow
                  label="Correct Role"
                  value={card.discordStatus.hasCorrectRole}
                  detail={
                    card.discordStatus.expectedDiscordRoleId
                      ? `Expected: ${card.discordStatus.expectedDiscordRoleName ?? card.discordStatus.expectedDiscordRoleId}`
                      : 'No mapping'
                  }
                />
                {card.discordStatus.discordRoles.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Current roles:
                    </Typography>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ mt: 0.5 }}>
                      {card.discordStatus.discordRoles.map(r => (
                        <Chip key={r.id} label={r.name} size="small" variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>

          {/* Role Mapping Validation */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Role Mapping Status
              </Typography>
              {card.roleMappingStatus.expectedMapping ? (
                <Stack spacing={0.5}>
                  <StatusRow
                    label="Rank Mapped"
                    value={card.roleMappingStatus.isRankMatchingMapping}
                    detail={card.roleMappingStatus.expectedMapping.rsiRank}
                  />
                  <StatusRow
                    label="Discord Role Correct"
                    value={card.roleMappingStatus.isDiscordRoleCorrect}
                  />
                  <StatusRow
                    label="Internal Role Correct"
                    value={card.roleMappingStatus.isInternalRoleCorrect}
                  />
                  {card.roleMappingStatus.mismatches.length > 0 && (
                    <Box sx={{ mt: 1 }}>
                      {card.roleMappingStatus.mismatches.map((m, i) => (
                        <Alert
                          key={`mismatch-${i}-${m.slice(0, 20)}`}
                          severity="warning"
                          sx={{ py: 0, mt: 0.5 }}
                        >
                          {m}
                        </Alert>
                      ))}
                    </Box>
                  )}
                </Stack>
              ) : (
                <Alert severity="info" sx={{ py: 0 }}>
                  No role mapping defined for rank &quot;{card.rsiRank ?? 'unknown'}&quot;
                </Alert>
              )}
            </CardContent>
          </Card>
        </Stack>

        {/* Right column */}
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {/* RSI Organizations */}
          <Card>
            <CardContent>
              {/* Primary Org */}
              <Typography variant="subtitle2" gutterBottom>
                Primary Org
              </Typography>
              {(() => {
                const primaryOrg = card.otherOrgs.find(o => o.isMain);
                if (card.isMainOrg) {
                  return (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      This organization
                    </Typography>
                  );
                }
                if (primaryOrg) {
                  if (primaryOrg.sid === 'REDACTED') {
                    return (
                      <Chip
                        label="Hidden – org visibility is private on RSI"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ mb: 2 }}
                      />
                    );
                  }
                  return (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 2 }}>
                      <Chip
                        label={primaryOrg.name}
                        size="small"
                        color="success"
                        variant="outlined"
                      />
                      {primaryOrg.rank && primaryOrg.rank !== '—' && (
                        <Typography variant="caption" color="text.secondary">
                          {primaryOrg.rank}
                        </Typography>
                      )}
                    </Stack>
                  );
                }
                return (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    No known primary org — click Enrich to fetch
                  </Typography>
                );
              })()}

              {/* Affiliate Orgs */}
              {(() => {
                const affiliateOrgs = card.otherOrgs.filter(o => !o.isMain);
                return (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Affiliate Orgs ({affiliateOrgs.length})
                    </Typography>
                    {affiliateOrgs.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No affiliate orgs found. Click Enrich to fetch.
                      </Typography>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Org</TableCell>
                              <TableCell>Rank</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {affiliateOrgs.map(org => (
                              <TableRow key={org.sid}>
                                <TableCell>
                                  <Typography variant="body2">{org.name}</Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {org.sid}
                                  </Typography>
                                </TableCell>
                                <TableCell>{org.rank ?? '—'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Active Flags */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom>
                Active Flags ({card.activeFlags.length})
              </Typography>
              {card.activeFlags.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No active flags
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {card.activeFlags.map(flag => (
                    <Alert
                      key={flag.id}
                      severity={getFlagAlertSeverity(flag.severity)}
                      sx={{ py: 0 }}
                    >
                      <Stack>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={flag.flagType.replaceAll('_', ' ')}
                            size="small"
                            color={getFlagAlertSeverity(flag.severity)}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {new Date(flag.createdAt).toLocaleDateString()}
                          </Typography>
                        </Stack>
                        <Typography variant="body2">{flag.description}</Typography>
                      </Stack>
                    </Alert>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Box>

      {/* Manual Link Dialog */}
      <ManualLinkDialog
        open={linkDialogOpen}
        onClose={() => setLinkDialogOpen(false)}
        organizationId={organizationId}
        rsiHandle={rsiHandle}
        onLinked={() => setLinkDialogOpen(false)}
      />
    </Box>
  );
};

// ─── Manual Link Dialog ────────────────────────────────────────────────

interface ManualLinkDialogProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  rsiHandle: string;
  onLinked: () => void;
}

const ManualLinkDialog: React.FC<ManualLinkDialogProps> = ({
  open,
  onClose,
  organizationId,
  rsiHandle,
  onLinked,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<LinkCandidate | null>(null);

  const { data: candidates, isLoading: candidatesLoading } = useLinkCandidates(
    open ? organizationId : undefined,
    searchQuery || undefined,
    { staleTime: 30_000 }
  );
  const manualLink = useManualLink();

  const handleLink = useCallback(async () => {
    if (!selectedUser) return;
    try {
      await manualLink.mutateAsync({
        organizationId,
        rsiHandle,
        input: {
          userId: selectedUser.userId,
          discordUserId: selectedUser.discordId,
        },
      });
      setSelectedUser(null);
      setSearchQuery('');
      onLinked();
    } catch (err: unknown) {
      logger.error('Manual link failed', err instanceof Error ? err : new Error(String(err)));
    }
  }, [selectedUser, organizationId, rsiHandle, manualLink, onLinked]);

  const handleClose = () => {
    setSelectedUser(null);
    setSearchQuery('');
    onClose();
  };

  const availableCandidates = (candidates ?? []).filter(c => !c.isAlreadyLinked);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Link &quot;{rsiHandle}&quot; to Platform User</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Search for an active organization member to link to this RSI handle. Only unlinked members
          are available for selection.
        </Typography>
        <Autocomplete
          options={availableCandidates}
          getOptionLabel={option => option.username}
          value={selectedUser}
          onChange={(_, value) => setSelectedUser(value)}
          inputValue={searchQuery}
          onInputChange={(_, value) => setSearchQuery(value)}
          loading={candidatesLoading}
          isOptionEqualToValue={(option, value) => option.userId === value.userId}
          renderOption={(props, option) => (
            <li {...props} key={option.userId}>
              <Stack>
                <Typography variant="body2">{option.username}</Typography>
                {option.discordId && (
                  <Typography variant="caption" color="text.secondary">
                    Discord: {option.discordId}
                  </Typography>
                )}
              </Stack>
            </li>
          )}
          renderInput={params => (
            <TextField
              {...params}
              label="Search members"
              placeholder="Type a username…"
              slotProps={{
                input: {
                  ...params.InputProps,
                  startAdornment: (
                    <>
                      <SearchIcon fontSize="small" sx={{ mr: 0.5, color: 'text.secondary' }} />
                      {params.InputProps.startAdornment}
                    </>
                  ),
                  endAdornment: (
                    <>
                      {candidatesLoading ? <CircularProgress size={18} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                },
              }}
            />
          )}
          noOptionsText={
            searchQuery.length > 0 ? 'No matching unlinked members found' : 'Type to search members'
          }
          sx={{ mt: 1 }}
        />
        {manualLink.isError && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {manualLink.error instanceof Error ? manualLink.error.message : 'Failed to create link'}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => void handleLink()}
          disabled={!selectedUser || manualLink.isPending}
          startIcon={manualLink.isPending ? <CircularProgress size={16} /> : <LinkIcon />}
        >
          {manualLink.isPending ? 'Linking…' : 'Link'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ─── Helper Components ─────────────────────────────────────────────────

const StatusRow: React.FC<{
  label: string;
  value: boolean;
  detail?: string;
}> = ({ label, value, detail }) => (
  <Stack direction="row" spacing={1} alignItems="center">
    {value ? (
      <CheckCircleIcon fontSize="small" color="success" />
    ) : (
      <ErrorIcon fontSize="small" color="error" />
    )}
    <Typography variant="body2">{label}</Typography>
    {detail && (
      <Typography variant="caption" color="text.secondary">
        ({detail})
      </Typography>
    )}
  </Stack>
);
