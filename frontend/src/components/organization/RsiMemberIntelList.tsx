/**
 * RsiMemberIntelList
 *
 * Paginated member list with intel summaries showing RSI status,
 * Discord presence, flags, and role mapping issues.
 * Wave 3.3: RSI Sync Enhancements
 */

import CachedIcon from '@mui/icons-material/Cached';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import PersonSearchIcon from '@mui/icons-material/PersonSearch';
import RefreshIcon from '@mui/icons-material/Refresh';
import SecurityIcon from '@mui/icons-material/Security';
import VerifiedIcon from '@mui/icons-material/Verified';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

import {
  useClearCache,
  useEnrichAllMembers,
  useRsiMemberIntelList,
  useRunMemberAudit,
  useValidateRoleMappings,
} from '@/hooks/queries/useRsiMemberIntelQueries';
import type { MemberIntelSummary } from '@/services/rsiMemberIntelService';
import { logger } from '@/utils/logger';

interface RsiMemberIntelListProps {
  organizationId: string;
  onMemberClick?: (rsiHandle: string) => void;
}

export const RsiMemberIntelList: React.FC<Readonly<RsiMemberIntelListProps>> = ({
  organizationId,
  onMemberClick,
}) => {
  const [search, setSearch] = useState('');
  const [actionMessage, setActionMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const { data, isLoading, error, refetch } = useRsiMemberIntelList(organizationId);
  const enrichAll = useEnrichAllMembers();
  const runAudit = useRunMemberAudit();
  const validateRoles = useValidateRoleMappings();
  const clearCache = useClearCache();

  const members = useMemo(() => data?.members ?? [], [data?.members]);
  const listStatus = data?.status;

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return members;
    const term = search.toLowerCase();
    return members.filter(
      m =>
        m.rsiHandle?.toLowerCase().includes(term) ||
        m.displayName?.toLowerCase().includes(term) ||
        m.rsiRank?.toLowerCase().includes(term)
    );
  }, [members, search]);

  const handleEnrichAll = async () => {
    try {
      const result = await enrichAll.mutateAsync({ organizationId });
      setActionMessage({
        type: 'success',
        text: `Enriched ${result.enriched}/${result.total} members (${result.failed} failed)`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to enrich members';
      setActionMessage({ type: 'error', text: msg });
      logger.error('Enrich all failed', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleRunAudit = async () => {
    try {
      const result = await runAudit.mutateAsync({ organizationId });
      setActionMessage({
        type: 'success',
        text: `Audit: checked ${result.totalChecked} members, created ${result.flagsCreated} flags (${result.flagsSkipped} skipped)`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to run audit';
      setActionMessage({ type: 'error', text: msg });
      logger.error('Run audit failed', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleValidateRoles = async () => {
    try {
      const result = await validateRoles.mutateAsync({ organizationId });
      const { summary } = result;
      setActionMessage({
        type: result.mismatches.length > 0 ? 'error' : 'success',
        text: `Validation: ${result.validatedMembers} members checked — ${summary.correctDiscordRoles} correct Discord, ${summary.incorrectDiscordRoles} incorrect, ${result.unmappedRanks.length} unmapped ranks`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to validate roles';
      setActionMessage({ type: 'error', text: msg });
      logger.error('Validate roles failed', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleClearCache = async () => {
    try {
      const result = await clearCache.mutateAsync({ organizationId });
      setActionMessage({
        type: 'success',
        text: `Cache cleared: ${result.crawledMembers} members, ${result.citizenOrgs} citizen orgs, ${result.memberCache} cache entries removed`,
      });
      void refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear cache';
      setActionMessage({ type: 'error', text: msg });
      logger.error('Clear cache failed', err instanceof Error ? err : new Error(String(err)));
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
        Failed to load member intel: {error instanceof Error ? error.message : String(error)}
      </Alert>
    );
  }

  const isAnyActionPending =
    enrichAll.isPending || runAudit.isPending || validateRoles.isPending || clearCache.isPending;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <PersonSearchIcon />
          <Typography variant="h6">Member Intelligence</Typography>
          <Chip label={`${members.length} members`} size="small" variant="outlined" />
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              handleEnrichAll();
            }}
            disabled={isAnyActionPending}
          >
            {enrichAll.isPending ? 'Enriching…' : 'Enrich All'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<SecurityIcon />}
            onClick={() => {
              handleRunAudit();
            }}
            disabled={isAnyActionPending}
          >
            {runAudit.isPending ? 'Auditing…' : 'Run Audit'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<HealthAndSafetyIcon />}
            onClick={() => {
              handleValidateRoles();
            }}
            disabled={isAnyActionPending}
          >
            {validateRoles.isPending ? 'Validating…' : 'Validate Roles'}
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<CachedIcon />}
            onClick={() => {
              handleClearCache();
            }}
            disabled={isAnyActionPending}
          >
            {clearCache.isPending ? 'Clearing…' : 'Clear Cache'}
          </Button>
          <IconButton
            size="small"
            onClick={() => {
              refetch();
            }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {/* Action feedback */}
      {actionMessage && (
        <Alert severity={actionMessage.type} sx={{ mb: 2 }} onClose={() => setActionMessage(null)}>
          {actionMessage.text}
        </Alert>
      )}

      {/* Search */}
      <TextField
        size="small"
        placeholder="Search by handle, name, or rank…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        fullWidth
        sx={{ mb: 2 }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <PersonSearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />

      {/* Table */}
      {filtered.length === 0 ? (
        <Alert severity="info">
          {search
            ? 'No members match your search'
            : listStatus === 'no_schedule'
              ? "No RSI sync schedule configured. Set up an RSI Sync Schedule above to discover your organization's members."
              : listStatus === 'no_members'
                ? 'Sync schedule is configured but no members have been crawled yet. Trigger a sync from the RSI Sync Dashboard above.'
                : 'No RSI members found. Run a sync first.'}
        </Alert>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Handle</TableCell>
                <TableCell>Rank</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="center">Linked</TableCell>
                <TableCell align="center">Discord</TableCell>
                <TableCell align="center">Flags</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map(member => (
                <MemberRow
                  key={member.rsiHandle}
                  member={member}
                  onClick={() => onMemberClick?.(member.rsiHandle)}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

// ─── Row Component ──────────────────────────────────────────────────────

const getMemberTypeLabel = (isMain: boolean, isAffiliate: boolean): string => {
  if (isMain) return 'Main';
  if (isAffiliate) return 'Affiliate';
  return '—';
};

const getMemberTypeColor = (
  isMain: boolean,
  isAffiliate: boolean
): 'success' | 'warning' | 'default' => {
  if (isMain) return 'success';
  if (isAffiliate) return 'warning';
  return 'default';
};

const MemberRow: React.FC<{
  member: MemberIntelSummary;
  onClick?: () => void;
}> = ({ member, onClick }) => {
  const typeLabel = getMemberTypeLabel(member.isMainOrg, member.isAffiliate);
  const typeColor = getMemberTypeColor(member.isMainOrg, member.isAffiliate);

  return (
    <TableRow hover onClick={onClick} sx={{ cursor: onClick ? 'pointer' : 'default' }}>
      <TableCell>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" fontWeight={500}>
            {member.rsiHandle}
          </Typography>
          {member.displayName && member.displayName !== member.rsiHandle && (
            <Typography variant="caption" color="text.secondary">
              ({member.displayName})
            </Typography>
          )}
        </Stack>
      </TableCell>
      <TableCell>
        {member.rsiRank
          ? `${'★'.repeat(member.rsiStars)}${'☆'.repeat(5 - member.rsiStars)} ${member.rsiRank}`
          : '—'}
      </TableCell>
      <TableCell>
        <Chip label={typeLabel} size="small" color={typeColor} variant="outlined" />
      </TableCell>
      <TableCell align="center">
        {member.isLinked ? (
          <Tooltip title="Linked in web app">
            <VerifiedIcon fontSize="small" color="success" />
          </Tooltip>
        ) : (
          <Tooltip title="Not linked">
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          </Tooltip>
        )}
      </TableCell>
      <TableCell align="center">
        {member.isInDiscord ? (
          <Tooltip title="In Discord guild">
            <VerifiedIcon fontSize="small" color="info" />
          </Tooltip>
        ) : (
          <Tooltip title="Not in Discord">
            <Typography variant="caption" color="text.disabled">
              —
            </Typography>
          </Tooltip>
        )}
      </TableCell>
      <TableCell align="center">
        {member.activeFlagCount > 0 ? (
          <Chip label={member.activeFlagCount} size="small" color="error" variant="filled" />
        ) : (
          <Typography variant="caption" color="text.disabled">
            0
          </Typography>
        )}
      </TableCell>
      <TableCell>
        <Stack direction="row" spacing={0.5}>
          {member.isHidden && (
            <Tooltip title="Hidden on RSI">
              <WarningAmberIcon fontSize="small" color="warning" />
            </Tooltip>
          )}
          {member.isRedacted && (
            <Tooltip title="Redacted profile">
              <WarningAmberIcon fontSize="small" color="error" />
            </Tooltip>
          )}
        </Stack>
      </TableCell>
    </TableRow>
  );
};
