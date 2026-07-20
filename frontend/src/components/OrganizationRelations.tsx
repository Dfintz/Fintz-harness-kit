import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { rsiCrawlerKeys } from '@/hooks/queries/queryKeys';
import { useAlliances, useReportAllianceIncident } from '@/hooks/queries/useAllianceQueries';
import {
  useCreateRelationship,
  useOrgRelationships,
  useOrgSearch,
  useRelationshipHistory,
  useTerminateRelationship,
  useUpdateRelationship,
} from '@/hooks/queries/useRelationshipQueries';
import { useCreateTicket } from '@/hooks/queries/useTicketQueries';
import { type IncidentSeverity as AllianceIncidentSeverity } from '@/services/allianceService';
import { apiClient, getErrorMessage, isApiClientError } from '@/services/apiClient';
import { extractArrayFromEnvelope } from '@/services/baseService';
import {
  type OrgSearchResult,
  type Relationship,
  type RelationshipStatus,
  type RelationshipType,
  type UpdateRelationshipPayload,
} from '@/services/relationshipService';
import { rsiCrawlerService } from '@/services/rsiCrawlerService';
import { TicketCategory, TicketPriority, TicketRecipientType } from '@/services/ticketService';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupIcon from '@mui/icons-material/Group';
import HandshakeIcon from '@mui/icons-material/Handshake';
import LanguageIcon from '@mui/icons-material/Language';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ReportIcon from '@mui/icons-material/Report';
import SearchIcon from '@mui/icons-material/Search';
import WarningIcon from '@mui/icons-material/Warning';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from 'recharts';
import { AllianceManagement } from './AllianceManagement';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { SecurityLevelManager } from './SecurityLevelManager';
import { ConfirmDialog, useConfirmDialog } from './ui/ConfirmDialog';

// ============================================================================
// Constants
// ============================================================================

const RELATIONSHIP_TYPES: { group: string; types: RelationshipType[] }[] = [
  {
    group: 'Positive',
    types: ['allied', 'partnership', 'cooperative', 'affiliated', 'trading_partner'],
  },
  { group: 'Neutral', types: ['neutral', 'observer', 'interested'] },
  { group: 'Negative', types: ['competitive', 'rival', 'hostile', 'war'] },
  { group: 'Special', types: ['parent', 'subsidiary', 'merger_pending', 'under_negotiation'] },
];

const POSITIVE_TYPES = new Set<RelationshipType>([
  'allied',
  'partnership',
  'cooperative',
  'affiliated',
  'trading_partner',
]);
const NEGATIVE_TYPES = new Set<RelationshipType>(['competitive', 'rival', 'hostile', 'war']);
const SPECIAL_TYPES = new Set<RelationshipType>([
  'parent',
  'subsidiary',
  'merger_pending',
  'under_negotiation',
]);

type TypeSemantic = 'positive' | 'negative' | 'special' | 'neutral';

function getTypeSemantic(type: RelationshipType): TypeSemantic {
  if (POSITIVE_TYPES.has(type)) return 'positive';
  if (NEGATIVE_TYPES.has(type)) return 'negative';
  if (SPECIAL_TYPES.has(type)) return 'special';
  return 'neutral';
}

function formatTypeLabel(type: string): string {
  return type.replaceAll('_', ' ').replaceAll(/\b\w/g, c => c.toUpperCase());
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function extractErrorMessage(err: unknown): string {
  if (isApiClientError(err)) return err.message;
  return getErrorMessage(err);
}

// ============================================================================
// TrustBar
// ============================================================================

type ProgressColor = 'success' | 'warning' | 'error';

const TrustBar: React.FC<{ score?: number }> = ({ score }) => {
  if (score === undefined || score === null) return null;
  const pct = Math.max(0, Math.min(100, score));
  let color: ProgressColor = 'error';
  if (pct >= 70) color = 'success';
  else if (pct >= 40) color = 'warning';
  return (
    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 120 }}>
      <LinearProgress
        variant="determinate"
        value={pct}
        color={color}
        sx={{ flex: 1, borderRadius: 1, height: 6 }}
      />
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ minWidth: 26, textAlign: 'right' }}
      >
        {pct}
      </Typography>
    </Stack>
  );
};

// ============================================================================
// TypeSelect (shared between Add and Edit dialogs)
// ============================================================================

const TypeSelect: React.FC<{
  value: RelationshipType | '';
  onChange: (v: RelationshipType) => void;
  label?: string;
}> = ({ value, onChange, label = 'Relationship Type' }) => (
  <Box>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
      {label}
    </Typography>
    <Select
      value={value}
      onChange={e => onChange(e.target.value as RelationshipType)}
      size="small"
      fullWidth
      displayEmpty
      sx={{ bgcolor: 'background.paper', color: 'text.primary' }}
    >
      <MenuItem value="" disabled>
        Select type...
      </MenuItem>
      {RELATIONSHIP_TYPES.map(group => [
        <MenuItem
          key={`header-${group.group}`}
          disabled
          sx={{
            fontWeight: 'bold',
            fontSize: '11px',
            color: 'text.secondary',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {group.group}
        </MenuItem>,
        ...group.types.map(t => (
          <MenuItem key={t} value={t} sx={{ pl: 3 }}>
            {formatTypeLabel(t)}
          </MenuItem>
        )),
      ])}
    </Select>
  </Box>
);

// ============================================================================
// OrgSearch (MUI Autocomplete + React Query)
// ============================================================================

const OrgSearch: React.FC<{
  onSelect: (org: OrgSearchResult) => void;
  selected: OrgSearchResult | null;
  label?: string;
}> = ({ onSelect, selected, label = 'Target Organization' }) => {
  const [inputValue, setInputValue] = useState('');
  const [rsiLookupLoading, setRsiLookupLoading] = useState(false);
  const { data: results = [], isLoading } = useOrgSearch(inputValue);

  // Combine internal results with an "add by RSI SID" option when no matches
  const options: OrgSearchResult[] = [...results];
  if (inputValue.trim().length >= 2 && !isLoading && results.length === 0) {
    // Add a synthetic option to look up from RSI
    options.push({
      id: `rsi:${inputValue.trim().toUpperCase()}`,
      name: `Look up "${inputValue.trim().toUpperCase()}" on RSI`,
      primaryFocus: 'rsi-lookup',
    });
  }

  const handleSelect = async (org: OrgSearchResult) => {
    if (org.id.startsWith('rsi:')) {
      // RSI lookup — fetch org info from crawler with a timeout
      const sid = org.id.replace('rsi:', '');
      setRsiLookupLoading(true);
      try {
        const response = await apiClient.get<{
          data?: { sid: string; name: string; memberCount?: number; logoUrl?: string };
          sid?: string;
          name?: string;
        }>(`/api/v2/rsi-crawler/organizations/${encodeURIComponent(sid)}`, { timeout: 10000 });
        const rsiOrg = response?.data?.data ?? response?.data;
        if (rsiOrg && (rsiOrg as { name?: string }).name) {
          const resolved = rsiOrg as {
            sid: string;
            name: string;
            memberCount?: number;
            logoUrl?: string;
          };
          onSelect({
            id: `rsi-org:${resolved.sid}`,
            name: `${resolved.name} (RSI: ${resolved.sid})`,
            memberCount: resolved.memberCount,
            logoUrl: resolved.logoUrl,
          });
        } else {
          onSelect({
            id: `rsi-org:${sid}`,
            name: `${sid} (RSI organization)`,
          });
        }
      } catch {
        // RSI lookup failed or timed out — use raw SID as name
        onSelect({
          id: `rsi-org:${sid}`,
          name: `${sid} (RSI organization)`,
        });
      } finally {
        setRsiLookupLoading(false);
      }
    } else {
      onSelect(org);
    }
  };

  return (
    <Autocomplete<OrgSearchResult>
      value={selected}
      onChange={(_, newValue) => {
        if (newValue) handleSelect(newValue);
      }}
      inputValue={inputValue}
      onInputChange={(_, value) => setInputValue(value)}
      options={options}
      getOptionLabel={opt => opt.name}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      loading={isLoading || rsiLookupLoading}
      noOptionsText={inputValue.length < 2 ? 'Type to search...' : 'No organizations found'}
      filterOptions={x => x}
      renderOption={(props, opt) => (
        <Box component="li" {...props} key={opt.id}>
          {opt.primaryFocus === 'rsi-lookup' ? (
            <Typography sx={{ fontStyle: 'italic', color: 'primary.main' }}>
              <SearchIcon sx={{ fontSize: '1rem', verticalAlign: 'middle', mr: 0.5 }} />
              {opt.name}
            </Typography>
          ) : (
            <>
              <Typography sx={{ fontWeight: 500 }}>{opt.name}</Typography>
              {opt.memberCount != null && (
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {opt.memberCount} members
                </Typography>
              )}
            </>
          )}
        </Box>
      )}
      renderInput={params => (
        <TextField
          {...params}
          label={label}
          size="small"
          placeholder="Search organizations or enter RSI SID..."
          helperText="Search platform orgs, or type an RSI org SID to look up externally"
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {isLoading || rsiLookupLoading ? <CircularProgress size={14} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
};

// ============================================================================
// AddRelationshipDialog
// ============================================================================

const AddRelationshipDialog: React.FC<{
  open: boolean;
  orgId: string;
  onClose: () => void;
}> = ({ open, orgId, onClose }) => {
  const [selectedOrg, setSelectedOrg] = useState<OrgSearchResult | null>(null);
  const [type, setType] = useState<RelationshipType | ''>('');
  const [description, setDescription] = useState('');
  // Advanced fields
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [communicationChannels, setCommunicationChannels] = useState<string[]>([]);
  const [error, setError] = useState('');
  const createMutation = useCreateRelationship();

  const reset = () => {
    setSelectedOrg(null);
    setType('');
    setDescription('');
    setNotes('');
    setTags([]);
    setContactName('');
    setContactRole('');
    setCommunicationChannels([]);
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedOrg) {
      setError('Please select a target organization.');
      return;
    }
    if (!type) {
      setError('Please select a relationship type.');
      return;
    }
    setError('');
    try {
      await createMutation.mutateAsync({
        organizationId: orgId,
        targetOrganizationId: selectedOrg.id,
        type,
        status: 'active',
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        contactName: contactName.trim() || undefined,
        contactRole: contactRole.trim() || undefined,
        communicationChannels: communicationChannels.length > 0 ? communicationChannels : undefined,
      });
      handleClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Diplomatic Relationship</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}
          <OrgSearch selected={selectedOrg} onSelect={setSelectedOrg} />
          <TypeSelect value={type} onChange={setType} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Description (optional)
            </Typography>
            <TextField
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
              placeholder="Describe the nature of this relationship..."
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Box>

          {/* Advanced section */}
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              '&:before': { display: 'none' },
              border: 1,
              borderColor: 'divider',
              borderRadius: '8px !important',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Additional Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    Internal Notes
                  </Typography>
                  <TextField
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    multiline
                    rows={2}
                    fullWidth
                    size="small"
                    placeholder="Private notes visible only to your organization..."
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                  />
                </Box>
                <ChipInput
                  label="Tags"
                  value={tags}
                  onChange={setTags}
                  placeholder="e.g. mining, trade-route-alpha"
                />
                <Stack direction="row" spacing={1.25}>
                  <TextField
                    label="Contact Name"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Primary diplomat"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                  <TextField
                    label="Contact Role"
                    value={contactRole}
                    onChange={e => setContactRole(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="e.g. Fleet Commander"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                </Stack>
                <ChipInput
                  label="Communication Channels"
                  value={communicationChannels}
                  onChange={setCommunicationChannels}
                  placeholder="Discord invite, TeamSpeak, etc."
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || !selectedOrg || !type}
          variant="contained"
        >
          {createMutation.isPending ? <CircularProgress size={18} /> : 'Create Relationship'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// ChipInput (for tags and communication channels)
// ============================================================================

const ChipInput: React.FC<{
  value: string[];
  onChange: (v: string[]) => void;
  label: string;
  placeholder?: string;
  maxItems?: number;
}> = ({ value, onChange, label, placeholder = 'Type and press Enter...', maxItems = 10 }) => {
  const [input, setInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      const trimmed = input.trim();
      if (!value.includes(trimmed) && value.length < maxItems) {
        onChange([...value, trimmed]);
      }
      setInput('');
    }
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
        {label}
      </Typography>
      <TextField
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        size="small"
        fullWidth
        placeholder={value.length >= maxItems ? `Maximum ${maxItems} items` : placeholder}
        disabled={value.length >= maxItems}
        slotProps={{ htmlInput: { maxLength: 50 } }}
      />
      {value.length > 0 && (
        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
          {value.map(item => (
            <Chip
              key={item}
              label={item}
              size="small"
              onDelete={() => onChange(value.filter(v => v !== item))}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
};

// ============================================================================
// EditRelationshipDialog
// ============================================================================

const EditRelationshipDialog: React.FC<{
  open: boolean;
  relationship: Relationship;
  orgId: string;
  onClose: () => void;
}> = ({ open, relationship, orgId, onClose }) => {
  // Core fields
  const [type, setType] = useState<RelationshipType>(relationship.type);
  const [status, setStatus] = useState<RelationshipStatus>(relationship.status);
  const [description, setDescription] = useState(relationship.description ?? '');
  // Notes & tags
  const [notes, setNotes] = useState(relationship.notes ?? '');
  const [tags, setTags] = useState<string[]>(relationship.tags ?? []);
  // Contact info
  const [contactName, setContactName] = useState(relationship.contactName ?? '');
  const [contactRole, setContactRole] = useState(relationship.contactRole ?? '');
  const [contactEmail, setContactEmail] = useState(relationship.contactEmail ?? '');
  const [communicationChannels, setCommunicationChannels] = useState<string[]>(
    relationship.communicationChannels ?? []
  );
  // Agreement details
  const [reviewDate, setReviewDate] = useState(relationship.reviewDate?.slice(0, 10) ?? '');
  const [expiryDate, setExpiryDate] = useState(relationship.expiryDate?.slice(0, 10) ?? '');
  const [isPublic, setIsPublic] = useState(relationship.isPublic ?? false);
  const [autoRenew, setAutoRenew] = useState(relationship.autoRenew ?? false);

  const [error, setError] = useState('');
  const updateMutation = useUpdateRelationship(orgId);

  // Sync when relationship prop changes
  React.useEffect(() => {
    setType(relationship.type);
    setStatus(relationship.status);
    setDescription(relationship.description ?? '');
    setNotes(relationship.notes ?? '');
    setTags(relationship.tags ?? []);
    setContactName(relationship.contactName ?? '');
    setContactRole(relationship.contactRole ?? '');
    setContactEmail(relationship.contactEmail ?? '');
    setCommunicationChannels(relationship.communicationChannels ?? []);
    setReviewDate(relationship.reviewDate?.slice(0, 10) ?? '');
    setExpiryDate(relationship.expiryDate?.slice(0, 10) ?? '');
    setIsPublic(relationship.isPublic ?? false);
    setAutoRenew(relationship.autoRenew ?? false);
    setError('');
  }, [relationship]);

  const handleSubmit = async () => {
    setError('');
    try {
      const payload: UpdateRelationshipPayload = {
        type,
        status,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        contactName: contactName.trim() || undefined,
        contactRole: contactRole.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        communicationChannels: communicationChannels.length > 0 ? communicationChannels : undefined,
        reviewDate: reviewDate || undefined,
        expiryDate: expiryDate || undefined,
        isPublic,
        autoRenew,
      };
      await updateMutation.mutateAsync({ id: relationship.id, payload });
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Relationship</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

          {/* Core fields — always visible */}
          <TypeSelect value={type} onChange={setType} />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Status
            </Typography>
            <Select
              value={status}
              onChange={e => setStatus(e.target.value as RelationshipStatus)}
              size="small"
              fullWidth
              sx={{ bgcolor: 'background.paper', color: 'text.primary' }}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="suspended">Suspended</MenuItem>
              {status === 'expired' && (
                <MenuItem value="expired" disabled>
                  Expired
                </MenuItem>
              )}
            </Select>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Description
            </Typography>
            <TextField
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={3}
              fullWidth
              size="small"
              slotProps={{ htmlInput: { maxLength: 1000 } }}
            />
          </Box>

          {/* Contact Information */}
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              '&:before': { display: 'none' },
              border: 1,
              borderColor: 'divider',
              borderRadius: '8px !important',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Contact Information</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.25}>
                  <TextField
                    label="Contact Name"
                    value={contactName}
                    onChange={e => setContactName(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Primary diplomat / liaison"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                  <TextField
                    label="Role"
                    value={contactRole}
                    onChange={e => setContactRole(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="e.g. Fleet Commander"
                    slotProps={{ htmlInput: { maxLength: 100 } }}
                  />
                </Stack>
                <TextField
                  label="Contact Email"
                  type="email"
                  value={contactEmail}
                  onChange={e => setContactEmail(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="diplomat@example.com"
                  slotProps={{ htmlInput: { maxLength: 254 } }}
                />
                <ChipInput
                  label="Communication Channels"
                  value={communicationChannels}
                  onChange={setCommunicationChannels}
                  placeholder="Discord invite, TeamSpeak, etc."
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Notes & Tags */}
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              '&:before': { display: 'none' },
              border: 1,
              borderColor: 'divider',
              borderRadius: '8px !important',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Notes & Tags</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    Internal Notes
                  </Typography>
                  <TextField
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    multiline
                    rows={3}
                    fullWidth
                    size="small"
                    placeholder="Private notes visible only to your organization..."
                    slotProps={{ htmlInput: { maxLength: 1000 } }}
                  />
                </Box>
                <ChipInput
                  label="Tags"
                  value={tags}
                  onChange={setTags}
                  placeholder="e.g. mining, trade-route-alpha"
                />
              </Stack>
            </AccordionDetails>
          </Accordion>

          {/* Agreement Details */}
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              '&:before': { display: 'none' },
              border: 1,
              borderColor: 'divider',
              borderRadius: '8px !important',
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Agreement Details</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1.25}>
                  <TextField
                    label="Next Review Date"
                    type="date"
                    value={reviewDate}
                    onChange={e => setReviewDate(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    label="Expiry Date"
                    type="date"
                    value={expiryDate}
                    onChange={e => setExpiryDate(e.target.value)}
                    size="small"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Stack>
                <Stack direction="row" spacing={2}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoRenew}
                        onChange={(_, v) => setAutoRenew(v)}
                        size="small"
                      />
                    }
                    label="Auto-renew"
                  />
                  <FormControlLabel
                    control={
                      <Switch checked={isPublic} onChange={(_, v) => setIsPublic(v)} size="small" />
                    }
                    label="Publicly visible"
                  />
                </Stack>
              </Stack>
            </AccordionDetails>
          </Accordion>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={updateMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={updateMutation.isPending} variant="contained">
          {updateMutation.isPending ? <CircularProgress size={18} /> : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// HistoryLog (rendered inside expanded row)
// ============================================================================

const HistoryLog: React.FC<{ relationshipId: string }> = ({ relationshipId }) => {
  const { data: rawEntries, isLoading } = useRelationshipHistory(relationshipId);
  const entries = Array.isArray(rawEntries) ? rawEntries : [];

  if (isLoading) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        Loading history...
      </Typography>
    );
  }

  if (!entries.length) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
        No history yet.
      </Typography>
    );
  }

  return (
    <Box sx={{ mt: 1.25 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: 'text.secondary',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'block',
          mb: 0.75,
        }}
      >
        Recent Changes
      </Typography>
      {entries.map(e => (
        <Box
          key={e.id}
          sx={{
            fontSize: '12px',
            color: 'text.secondary',
            py: 0.375,
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Typography component="span" variant="caption" color="text.disabled">
            {formatDate(e.createdAt)}
          </Typography>
          {' · '}
          {e.description}
          {e.actorName && (
            <>
              {' · '}
              <Typography component="span" variant="caption" color="info.main">
                {e.actorName}
              </Typography>
            </>
          )}
        </Box>
      ))}
    </Box>
  );
};

// ============================================================================
// RSI Crawled Organization Profile
// ============================================================================

const MemberCountChart: React.FC<{ sid: string }> = React.memo(({ sid }) => {
  const theme = useTheme();
  const gradientId = `memberGradient-${sid}`;
  const { data, isLoading } = useQuery({
    queryKey: rsiCrawlerKeys.memberCountHistory(sid),
    queryFn: () => rsiCrawlerService.getMemberCountHistory(sid),
    staleTime: 10 * 60 * 1000,
  });

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      members: d.memberCount,
    }));
  }, [data]);

  if (isLoading) return <CircularProgress size={16} />;
  if (chartData.length < 2) {
    return (
      <Typography variant="caption" color="text.secondary">
        Not enough data points yet. Member count changes will be tracked over time.
      </Typography>
    );
  }

  return (
    <Box sx={{ width: '100%', minHeight: 160 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: 'text.secondary',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          mb: 0.5,
          display: 'block',
        }}
      >
        Member Count Over Time
      </Typography>
      <ResponsiveContainer width="100%" height={140} minWidth={100} minHeight={100}>
        <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3} />
              <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} />
          <YAxis
            tick={{ fontSize: 10, fill: theme.palette.text.secondary }}
            allowDecimals={false}
          />
          <RechartsTooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 4,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="members"
            stroke={theme.palette.primary.main}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
});

function isValidExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const RsiOrgProfile: React.FC<{ rsiSid: string }> = React.memo(({ rsiSid }) => {
  const {
    data: org,
    isLoading,
    error,
  } = useQuery({
    queryKey: rsiCrawlerKeys.organization(rsiSid),
    queryFn: () => rsiCrawlerService.getOrganization(rsiSid),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) return <CircularProgress size={16} />;
  if (error || !org) return null;

  const rsiPageUrl = `https://robertsspaceindustries.com/orgs/${rsiSid}`;

  return (
    <Box sx={{ mt: 1.25, px: 1.5, py: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 600,
          color: 'text.secondary',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          display: 'block',
          mb: 0.75,
        }}
      >
        RSI Profile
      </Typography>

      <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 1 }}>
        {org.archetype && (
          <Chip label={org.archetype} size="small" color="info" variant="outlined" />
        )}
        <Tooltip title="Members / Affiliates">
          <Chip
            icon={<GroupIcon sx={{ fontSize: 14 }} />}
            label={
              org.affiliateCount > 0
                ? `${org.memberCount} members · ${org.affiliateCount} affiliates`
                : `${org.memberCount} members`
            }
            size="small"
            variant="outlined"
          />
        </Tooltip>
        {org.focus?.primary && (
          <Chip label={`Focus: ${org.focus.primary}`} size="small" variant="outlined" />
        )}
        {org.commitment && (
          <Chip label={`Commitment: ${org.commitment}`} size="small" variant="outlined" />
        )}
        {org.language && <Chip label={org.language} size="small" variant="outlined" />}
        {org.recruiting && (
          <Chip
            label={`Recruiting: ${org.recruiting}`}
            size="small"
            variant="outlined"
            color={org.recruiting.toLowerCase() === 'yes' ? 'success' : 'default'}
          />
        )}
      </Stack>

      <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center">
        <Link
          href={rsiPageUrl}
          target="_blank"
          rel="noopener noreferrer"
          variant="caption"
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}
        >
          <LanguageIcon sx={{ fontSize: 14 }} /> RSI Page <OpenInNewIcon sx={{ fontSize: 12 }} />
        </Link>
        {org.links?.website && isValidExternalUrl(org.links.website) && (
          <Link
            href={org.links.website}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}
          >
            Website <OpenInNewIcon sx={{ fontSize: 12 }} />
          </Link>
        )}
        {org.links?.discord && isValidExternalUrl(org.links.discord) && (
          <Link
            href={org.links.discord}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3 }}
          >
            Discord <OpenInNewIcon sx={{ fontSize: 12 }} />
          </Link>
        )}
      </Stack>

      {org.lastCrawledAt && (
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.5 }}>
          Last crawled: {formatDate(org.lastCrawledAt)}
        </Typography>
      )}

      <Box sx={{ mt: 1.5 }}>
        <MemberCountChart sid={rsiSid} />
      </Box>
    </Box>
  );
});

// ============================================================================
// RelationshipRow

const RelationshipRow: React.FC<{
  relationship: Relationship;
  canManage: boolean;
  orgId: string;
}> = React.memo(({ relationship, canManage, orgId }) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const terminateMutation = useTerminateRelationship(orgId);
  const { openDialog, closeDialog, dialogProps } = useConfirmDialog<string>();

  const targetName = relationship.targetOrganization?.name ?? relationship.targetOrganizationId;
  const semantic = getTypeSemantic(relationship.type);

  const badgeColorMap: Record<TypeSemantic, string> = {
    positive: theme.palette.success.main,
    negative: theme.palette.error.main,
    special: theme.palette.info.main,
    neutral: theme.palette.text.secondary,
  };
  const badgeColor = badgeColorMap[semantic];

  const handleTerminate = async () => {
    try {
      await terminateMutation.mutateAsync(relationship.id);
      closeDialog();
    } catch (err) {
      logger.error(
        'Failed to terminate relationship',
        err instanceof Error ? err : new Error(String(err))
      );
    }
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        mb: 1,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      {/* Row header — clickable to expand */}
      <Box
        component="button"
        onClick={() => setExpanded(x => !x)}
        sx={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          p: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          color: 'text.primary',
          textAlign: 'left',
        }}
      >
        <Chip
          label={formatTypeLabel(relationship.type)}
          size="small"
          variant="outlined"
          sx={{
            borderColor: badgeColor,
            color: badgeColor,
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            flexShrink: 0,
          }}
        />

        <Typography sx={{ fontWeight: 500, flex: 1 }}>{targetName}</Typography>

        {relationship.status !== 'active' && (
          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
            {formatTypeLabel(relationship.status)}
          </Typography>
        )}

        <TrustBar score={relationship.trustScore} />

        <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, ml: 0.5 }}>
          {expanded ? '▲' : '▼'}
        </Typography>
      </Box>

      {/* Expanded detail */}
      {expanded && (
        <Box sx={{ px: 2, pb: 1.75, borderTop: 1, borderColor: 'divider' }}>
          {relationship.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.5 }}>
              {relationship.description}
            </Typography>
          )}

          {/* Metadata row: mutual, dates, tags */}
          <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
            {relationship.isMutual && (
              <Chip label="Mutual" size="small" color="info" variant="outlined" />
            )}
            {relationship.isPublic && <Chip label="Public" size="small" variant="outlined" />}
            {relationship.autoRenew && <Chip label="Auto-renew" size="small" variant="outlined" />}
            {(relationship.tags ?? []).map(tag => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ fontSize: '11px' }}
              />
            ))}
          </Stack>

          {/* Dates info */}
          {(relationship.establishedDate ?? relationship.reviewDate ?? relationship.expiryDate) && (
            <Stack direction="row" flexWrap="wrap" gap={2} sx={{ mt: 1 }}>
              {relationship.establishedDate && (
                <Typography variant="caption" color="text.secondary">
                  Established: {formatDate(relationship.establishedDate)}
                </Typography>
              )}
              {relationship.reviewDate && (
                <Typography
                  variant="caption"
                  color={
                    new Date(relationship.reviewDate) < new Date() ? 'error.main' : 'text.secondary'
                  }
                >
                  Review: {formatDate(relationship.reviewDate)}
                  {new Date(relationship.reviewDate) < new Date() && ' (overdue)'}
                </Typography>
              )}
              {relationship.expiryDate && (
                <Typography
                  variant="caption"
                  color={
                    new Date(relationship.expiryDate) < new Date() ? 'error.main' : 'warning.main'
                  }
                >
                  Expires: {formatDate(relationship.expiryDate)}
                </Typography>
              )}
            </Stack>
          )}

          {/* Contact info */}
          {(relationship.contactName ?? relationship.contactRole ?? relationship.contactEmail) && (
            <Box sx={{ mt: 1.25, px: 1.5, py: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'text.secondary',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                Contact
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1.5}>
                {relationship.contactName && (
                  <Typography variant="body2">{relationship.contactName}</Typography>
                )}
                {relationship.contactRole && (
                  <Typography variant="body2" color="text.secondary">
                    ({relationship.contactRole})
                  </Typography>
                )}
                {relationship.contactEmail && (
                  <Typography variant="body2" color="primary.main">
                    {relationship.contactEmail}
                  </Typography>
                )}
              </Stack>
              {(relationship.communicationChannels ?? []).length > 0 && (
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 0.5 }}>
                  {relationship.communicationChannels?.map(ch => (
                    <Chip
                      key={ch}
                      label={ch}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '11px' }}
                    />
                  ))}
                </Stack>
              )}
            </Box>
          )}

          {/* Internal notes */}
          {relationship.notes && (
            <Box sx={{ mt: 1, px: 1.5, py: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  color: 'text.secondary',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                Internal Notes
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {relationship.notes}
              </Typography>
            </Box>
          )}

          {/* RSI Profile — show if target org has an RSI SID */}
          {relationship.targetOrganization?.rsiOrgSid && (
            <RsiOrgProfile rsiSid={relationship.targetOrganization.rsiOrgSid} />
          )}

          {/* Interaction summary */}
          {(relationship.interactionCount ?? 0) > 0 && (
            <Stack
              direction="row"
              gap={2}
              sx={{ mt: 1, px: 1.5, py: 0.75, bgcolor: 'action.hover', borderRadius: 1 }}
            >
              <Typography variant="caption" color="text.secondary">
                Interactions: <strong>{relationship.interactionCount}</strong>
              </Typography>
              {(relationship.positiveInteractions ?? 0) > 0 && (
                <Typography variant="caption" color="success.main">
                  +{relationship.positiveInteractions} positive
                </Typography>
              )}
              {(relationship.negativeInteractions ?? 0) > 0 && (
                <Typography variant="caption" color="error.main">
                  {relationship.negativeInteractions} negative
                </Typography>
              )}
              {relationship.relationshipStrength != null && (
                <Typography variant="caption" color="text.secondary">
                  Strength: {Math.round(relationship.relationshipStrength)}%
                </Typography>
              )}
            </Stack>
          )}

          <HistoryLog relationshipId={relationship.id} />

          {terminateMutation.isError && (
            <Alert severity="error" sx={{ mt: 1, fontSize: '12px' }}>
              {extractErrorMessage(terminateMutation.error)}
            </Alert>
          )}

          {canManage && (
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={e => {
                  e.stopPropagation();
                  setEditOpen(true);
                }}
              >
                Edit
              </Button>
              <Button
                size="small"
                color="error"
                variant="outlined"
                onClick={() => openDialog(relationship.id)}
              >
                Terminate
              </Button>
            </Stack>
          )}
        </Box>
      )}

      {editOpen && (
        <EditRelationshipDialog
          open={editOpen}
          relationship={relationship}
          orgId={orgId}
          onClose={() => setEditOpen(false)}
        />
      )}

      <ConfirmDialog
        {...dialogProps}
        title="Terminate Relationship"
        message={`Are you sure you want to terminate the relationship with ${targetName}? This action cannot be undone.`}
        confirmLabel="Terminate"
        confirmColor="error"
        loading={terminateMutation.isPending}
        onConfirm={handleTerminate}
      />
    </Box>
  );
});

// ============================================================================
// IncidentReportDialog
// ============================================================================

interface IncidentReportProps {
  open: boolean;
  orgId: string;
  onClose: () => void;
}

const HTTPS_URL_PATTERN = /^https:\/\/.+/i;

async function uploadScreenshots(files: File[]): Promise<{ url: string; error?: string }[]> {
  const results = await Promise.allSettled(
    files.map(async file => {
      const form = new FormData();
      form.append('image', file);
      const res = await apiClient.postRaw<{ url: string }>('/api/v2/images/upload', form);
      return res.url;
    })
  );
  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? { url: r.value }
      : { url: '', error: `Failed to upload ${files[i].name}` }
  );
}

type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

const SEVERITY_CHIP_COLOR: Record<IncidentSeverity, 'error' | 'warning' | 'success'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'success',
};

const SEVERITY_OPTIONS: {
  value: IncidentSeverity;
  label: string;
  description: string;
  priority: TicketPriority;
}[] = [
  {
    value: 'low',
    label: 'Low',
    description: 'Minor dispute or verbal disagreement',
    priority: TicketPriority.MEDIUM,
  },
  {
    value: 'medium',
    label: 'Medium',
    description: 'Property damage, cargo theft',
    priority: TicketPriority.HIGH,
  },
  {
    value: 'high',
    label: 'High',
    description: 'Organized attack, betrayal of trust',
    priority: TicketPriority.HIGH,
  },
  {
    value: 'critical',
    label: 'Critical',
    description: 'War declaration, mass griefing',
    priority: TicketPriority.URGENT,
  },
];

const IncidentReportDialog: React.FC<IncidentReportProps> = ({ open, orgId, onClose }) => {
  const [reportedOrg, setReportedOrg] = useState<OrgSearchResult | null>(null);
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [persons, setPersons] = useState('');
  const [dates, setDates] = useState('');
  const [location, setLocation] = useState('');
  const [activities, setActivities] = useState('');
  const [description, setDescription] = useState('');
  const [evidenceLinks, setEvidenceLinks] = useState('');
  const [screenshots, setScreenshots] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const createTicketMutation = useCreateTicket();

  const reset = () => {
    setReportedOrg(null);
    setSeverity('medium');
    setPersons('');
    setDates('');
    setLocation('');
    setActivities('');
    setDescription('');
    setEvidenceLinks('');
    setScreenshots([]);
    setUploading(false);
    setSubmitting(false);
    setSuccess(false);
    setTicketNumber('');
    setError('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    setScreenshots(prev => {
      const combined = [...prev, ...selected];
      return combined.slice(0, 5);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => setScreenshots(prev => prev.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    if (!reportedOrg) {
      setError('Please select the organization you are reporting.');
      return;
    }
    if (!description.trim()) {
      setError('Please provide a description of the incident.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      // 1. Upload screenshots (with per-file resilience)
      let screenshotUrls: string[] = [];
      if (screenshots.length > 0) {
        setUploading(true);
        const uploadResults = await uploadScreenshots(screenshots);
        const failures = uploadResults.filter(r => r.error);
        screenshotUrls = uploadResults.filter(r => r.url).map(r => r.url);
        setUploading(false);
        if (failures.length > 0 && screenshotUrls.length === 0) {
          setError('All screenshot uploads failed. Please try again.');
          setSubmitting(false);
          return;
        }
      }

      // 2. Build markdown body
      const lines: string[] = [
        `## Incident Report`,
        ``,
        `**Reported Organization:** ${reportedOrg.name}`,
        `**Severity:** ${severity.toUpperCase()}`,
      ];
      if (persons.trim()) lines.push(`**Persons Involved:** ${persons.trim()}`);
      if (dates.trim()) lines.push(`**Date(s):** ${dates.trim()}`);
      if (location.trim()) lines.push(`**Location / System:** ${location.trim()}`);
      if (activities.trim()) lines.push(`**Activities / Context:** ${activities.trim()}`);
      lines.push(``, `### Description`, ``, description.trim());

      // Sanitize evidence links — only allow https:// URLs
      if (evidenceLinks.trim()) {
        const validLinks = evidenceLinks
          .split('\n')
          .map(l => l.trim())
          .filter(l => HTTPS_URL_PATTERN.test(l));
        if (validLinks.length > 0) {
          lines.push(``, `### Evidence Links`, ``);
          validLinks.forEach(l => lines.push(`- ${l}`));
        }
      }

      if (screenshotUrls.length > 0) {
        lines.push(``, `### Screenshots`, ``);
        screenshotUrls.forEach((url, i) => lines.push(`![Screenshot ${i + 1}](${url})`));
      }
      const body = lines.join('\n');

      // 3. Submit ticket
      const selectedSeverity = SEVERITY_OPTIONS.find(s => s.value === severity);
      const ticket = await createTicketMutation.mutateAsync({
        subject: `[${severity.toUpperCase()}] Incident Report — ${reportedOrg.name}`,
        description: body,
        category: TicketCategory.DIPLOMACY,
        priority: selectedSeverity?.priority ?? TicketPriority.HIGH,
        recipientType: TicketRecipientType.ORG_LEADERSHIP,
        recipientId: orgId,
        recipientName: reportedOrg.name,
        tags: ['incident', 'diplomacy'],
      });

      setTicketNumber(ticket.ticketNumber ?? ticket.id);
      setSuccess(true);
    } catch (err) {
      setError(extractErrorMessage(err));
      setUploading(false);
    } finally {
      setSubmitting(false);
    }
  };

  const busy = uploading || submitting;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Report Incident</DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CheckCircleIcon sx={{ fontSize: '2.5rem', mb: 1.5, color: 'success.main' }} />
            <Typography sx={{ fontWeight: 600, mb: 1 }}>Report Submitted</Typography>
            {ticketNumber && (
              <Typography variant="body2" color="text.secondary">
                Ticket <strong>#{ticketNumber}</strong> has been sent to org leadership for review.
              </Typography>
            )}
          </Box>
        ) : (
          <Stack spacing={1.75} sx={{ pt: 1 }}>
            {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

            <OrgSearch
              selected={reportedOrg}
              onSelect={setReportedOrg}
              label="Reported Organization"
            />

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                Severity
              </Typography>
              <Select
                value={severity}
                onChange={e => setSeverity(e.target.value as IncidentSeverity)}
                size="small"
                fullWidth
                sx={{ bgcolor: 'background.paper', color: 'text.primary' }}
              >
                {SEVERITY_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={opt.label}
                        size="small"
                        color={SEVERITY_CHIP_COLOR[opt.value]}
                        sx={{ fontWeight: 600, minWidth: 60 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {opt.description}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <TextField
              label="Person(s) Involved"
              value={persons}
              onChange={e => setPersons(e.target.value)}
              size="small"
              fullWidth
              placeholder="RSI handles / gamertags"
            />

            <Stack direction="row" spacing={1.25}>
              <TextField
                label="Date(s)"
                value={dates}
                onChange={e => setDates(e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g. 2026-03-01, 2026-03-04"
              />
              <TextField
                label="Location / System"
                value={location}
                onChange={e => setLocation(e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g. Stanton, Hurston"
              />
            </Stack>

            <TextField
              label="Activities / Context"
              value={activities}
              onChange={e => setActivities(e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g. piracy, cargo theft, griefing during mining op"
            />

            <TextField
              label="Description *"
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={4}
              fullWidth
              size="small"
              placeholder="Describe what happened in detail..."
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />

            <TextField
              label="Evidence Links (one per line, https:// only)"
              value={evidenceLinks}
              onChange={e => setEvidenceLinks(e.target.value)}
              multiline
              rows={2}
              fullWidth
              size="small"
              placeholder="https://..."
            />

            {/* Screenshot upload */}
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary">
                  Screenshots ({screenshots.length}/5)
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={screenshots.length >= 5 || busy}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Attach
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  hidden
                  onChange={handleFileChange}
                />
              </Stack>
              {screenshots.length > 0 && (
                <Stack spacing={0.5}>
                  {screenshots.map((f, i) => (
                    <Stack key={`${f.name}-${i}`} direction="row" alignItems="center" spacing={1}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          flex: 1,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {f.name}
                      </Typography>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => removeFile(i)}
                        disabled={busy}
                        sx={{ minWidth: 'auto', p: '0 4px', fontSize: '14px' }}
                      >
                        ✕
                      </Button>
                    </Stack>
                  ))}
                </Stack>
              )}
              {uploading && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75 }}>
                  Uploading screenshots...
                </Typography>
              )}
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {success ? (
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={busy || !reportedOrg || !description.trim()}
              variant="contained"
              color="error"
            >
              {busy ? <CircularProgress size={18} /> : 'Submit Report'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// DiplomaticIncidentDialog (linked to existing alliance/relationship)
// ============================================================================

interface DiplomaticIncidentDialogProps {
  open: boolean;
  orgId: string;
  onClose: () => void;
}

const DiplomaticIncidentDialog: React.FC<DiplomaticIncidentDialogProps> = ({
  open,
  orgId,
  onClose,
}) => {
  const { data: alliancesRaw } = useAlliances();
  const { data: relResponse } = useOrgRelationships(orgId);
  const relationships = extractArrayFromEnvelope<Relationship>(relResponse);
  const reportIncidentMutation = useReportAllianceIncident();

  const alliances = alliancesRaw ?? [];

  const [targetType, setTargetType] = useState<'alliance' | 'relationship'>('alliance');
  const [targetId, setTargetId] = useState('');
  const [severity, setSeverity] = useState<AllianceIncidentSeverity>('medium');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const reset = () => {
    setTargetType('alliance');
    setTargetId('');
    setSeverity('medium');
    setDescription('');
    setError('');
    setSuccess(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!targetId) {
      setError('Please select an alliance or relationship.');
      return;
    }
    if (description.trim().length < 20) {
      setError('Description must be at least 20 characters.');
      return;
    }
    setError('');
    try {
      if (targetType === 'alliance') {
        await reportIncidentMutation.mutateAsync({
          allianceId: targetId,
          data: { description: description.trim(), severity },
        });
      } else {
        // For relationships, record a negative interaction via the relationship API
        await apiClient.post(`/api/v2/relationships/${targetId}/interactions`, {
          sentiment: severity === 'critical' || severity === 'high' ? 'very_negative' : 'negative',
          description: `[INCIDENT - ${severity.toUpperCase()}] ${description.trim()}`,
        });
      }
      setSuccess(true);
    } catch (err) {
      setError(extractErrorMessage(err));
    }
  };

  const busy = reportIncidentMutation.isPending;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Diplomatic Incident</DialogTitle>
      <DialogContent>
        {success ? (
          <Box sx={{ py: 3 }}>
            <Box sx={{ textAlign: 'center', mb: 2 }}>
              <WarningIcon sx={{ fontSize: '2.5rem', mb: 1.5, color: 'warning.main' }} />
              <Typography sx={{ fontWeight: 600, mb: 1 }}>Incident Reported</Typography>
              <Typography variant="body2" color="text.secondary">
                The incident has been logged against the selected {targetType}. Trust scores and
                interaction history have been updated.
              </Typography>
            </Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Follow-up Actions
            </Typography>
            <Stack spacing={1}>
              {targetType === 'alliance' && (
                <Button
                  size="small"
                  variant="outlined"
                  color="warning"
                  fullWidth
                  onClick={async () => {
                    try {
                      await apiClient.post(`/api/v2/alliance-diplomacy/${targetId}/suspend`);
                      handleClose();
                    } catch (err) {
                      setError(extractErrorMessage(err));
                    }
                  }}
                >
                  Suspend Alliance
                </Button>
              )}
              <Button size="small" variant="outlined" fullWidth onClick={handleClose}>
                No Further Action
              </Button>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            {error && <ErrorMessage message={error} onDismiss={() => setError('')} />}

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                Incident Against
              </Typography>
              <Select<'alliance' | 'relationship'>
                value={targetType}
                onChange={e => {
                  setTargetType(e.target.value);
                  setTargetId('');
                }}
                size="small"
                fullWidth
                sx={{ bgcolor: 'background.paper' }}
              >
                <MenuItem value="alliance">Alliance / Treaty</MenuItem>
                <MenuItem value="relationship">Relationship</MenuItem>
              </Select>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                Select {targetType === 'alliance' ? 'Alliance' : 'Relationship'}
              </Typography>
              <Select
                value={targetId}
                onChange={e => setTargetId(e.target.value)}
                size="small"
                fullWidth
                displayEmpty
                sx={{ bgcolor: 'background.paper' }}
              >
                <MenuItem value="" disabled>
                  Select...
                </MenuItem>
                {targetType === 'alliance'
                  ? alliances.map(a => (
                      <MenuItem key={a.id} value={a.id}>
                        {formatTypeLabel(a.allianceType)} — {a.orgId2 ?? a.orgId1}
                      </MenuItem>
                    ))
                  : relationships.map(r => (
                      <MenuItem key={r.id} value={r.id}>
                        {formatTypeLabel(r.type)} —{' '}
                        {r.targetOrganization?.name ?? r.targetOrganizationId}
                      </MenuItem>
                    ))}
              </Select>
            </Box>

            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5 }}
              >
                Severity
              </Typography>
              <Select
                value={severity}
                onChange={e => setSeverity(e.target.value as AllianceIncidentSeverity)}
                size="small"
                fullWidth
                sx={{ bgcolor: 'background.paper' }}
              >
                {SEVERITY_OPTIONS.map(opt => (
                  <MenuItem key={opt.value} value={opt.value}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Chip
                        label={opt.label}
                        size="small"
                        color={SEVERITY_CHIP_COLOR[opt.value]}
                        sx={{ fontWeight: 600, minWidth: 60 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {opt.description}
                      </Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <TextField
              label="Description *"
              value={description}
              onChange={e => setDescription(e.target.value)}
              multiline
              rows={4}
              fullWidth
              size="small"
              placeholder="Describe the incident in detail (min 20 characters)..."
              slotProps={{ htmlInput: { maxLength: 5000 } }}
              helperText={`${description.length}/5000`}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {success ? (
          <Button onClick={handleClose} variant="contained">
            Close
          </Button>
        ) : (
          <>
            <Button onClick={handleClose} disabled={busy}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={busy || !targetId || description.trim().length < 20}
              variant="contained"
              color="error"
            >
              {busy ? <CircularProgress size={18} /> : 'Report Incident'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

// ============================================================================
// IncidentSplitButton
// ============================================================================

const IncidentSplitButton: React.FC<{
  onDiplomaticIncident: () => void;
  onGeneralReport: () => void;
}> = ({ onDiplomaticIncident, onGeneralReport }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  return (
    <>
      <ButtonGroup variant="outlined" color="error" size="small">
        <Button onClick={onDiplomaticIncident} startIcon={<WarningAmberIcon />}>
          Report Incident
        </Button>
        <Button
          size="small"
          onClick={e => setAnchorEl(e.currentTarget)}
          aria-label="Select incident type"
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem
          onClick={() => {
            onDiplomaticIncident();
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <WarningAmberIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Diplomatic Incident"
            secondary="Against an existing alliance or relationship"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            onGeneralReport();
            setAnchorEl(null);
          }}
        >
          <ListItemIcon>
            <ReportIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Report Organization"
            secondary="Report an unknown or new organization"
          />
        </MenuItem>
      </Menu>
    </>
  );
};

// ============================================================================
// RelationshipsTab (extracted from old main component)
// ============================================================================

const RelationshipsTab: React.FC<{
  orgId: string;
  canManage: boolean;
}> = ({ orgId, canManage }) => {
  const [addOpen, setAddOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [diplomaticOpen, setDiplomaticOpen] = useState(false);

  const { data: response, isLoading, error } = useOrgRelationships(orgId);
  const relationships = extractArrayFromEnvelope<Relationship>(response);

  // Fetch watchlist entries for cross-reference has been removed
  // (watchlist now tracks citizens, not orgs — org relationships
  //  are handled entirely on this Relations page)

  return (
    <Box>
      <Stack direction="row" justifyContent="flex-end" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1.25}>
          <IncidentSplitButton
            onDiplomaticIncident={() => setDiplomaticOpen(true)}
            onGeneralReport={() => setReportOpen(true)}
          />
          {canManage && (
            <Button variant="contained" onClick={() => setAddOpen(true)}>
              + Add Relationship
            </Button>
          )}
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load relationships.
        </Alert>
      )}

      {isLoading && <LoadingSpinner message="Loading relationships..." />}

      {!isLoading && relationships.length === 0 && (
        <Box
          sx={{
            textAlign: 'center',
            p: '3rem 1rem',
            color: 'text.secondary',
            bgcolor: 'background.paper',
            borderRadius: 2,
            border: '1px dashed',
            borderColor: 'divider',
          }}
        >
          <HandshakeIcon sx={{ fontSize: '2rem', mb: 1, color: 'text.secondary' }} />
          <Typography>No diplomatic relationships yet.</Typography>
          <Typography variant="body2" sx={{ mt: 0.5 }}>
            Add your first relationship to track alliances, rivals, and agreements with other
            organizations.
          </Typography>
        </Box>
      )}

      {!isLoading && relationships.length > 0 && (
        <Box>
          {relationships.map(rel => {
            return (
              <RelationshipRow
                key={rel.id}
                relationship={rel}
                canManage={canManage}
                orgId={orgId}
              />
            );
          })}
        </Box>
      )}

      <AddRelationshipDialog open={addOpen} orgId={orgId} onClose={() => setAddOpen(false)} />
      <IncidentReportDialog open={reportOpen} orgId={orgId} onClose={() => setReportOpen(false)} />
      <DiplomaticIncidentDialog
        open={diplomaticOpen}
        orgId={orgId}
        onClose={() => setDiplomaticOpen(false)}
      />
    </Box>
  );
};

// ============================================================================
// Main component
// ============================================================================

export const OrganizationRelations: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);

  const orgId = user?.activeOrgId;
  const canManage = ['owner', 'founder', 'admin', 'officer'].includes(user?.orgRole ?? '');
  const isOrgAdmin =
    user?.orgRole === 'owner' || user?.orgRole === 'founder' || user?.orgRole === 'admin';

  if (!orgId) {
    return (
      <Typography sx={{ p: 4 }} color="text.secondary">
        Join an organization to manage diplomatic relations.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
        Organization Relations
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2.5 }}>
        <Tabs
          value={activeTab}
          onChange={(_, v: number) => setActiveTab(v)}
          aria-label="Diplomacy sections"
        >
          <Tab label="Relationships" />
          <Tab label="Alliances" />
          <Tab label="Security Levels" />
        </Tabs>
      </Box>

      {activeTab === 0 && <RelationshipsTab orgId={orgId} canManage={canManage} />}
      {activeTab === 1 && <AllianceManagement organizationId={orgId} />}
      {activeTab === 2 && (
        <SecurityLevelManager
          organizationId={orgId}
          organizationName={user?.activeOrgName ?? orgId}
          isAdmin={isOrgAdmin}
        />
      )}
    </Box>
  );
};

export const OrganizationRelationsWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Organization Relations">
    <OrganizationRelations />
  </FeatureErrorBoundary>
);
