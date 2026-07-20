/**
 * LFG Page
 *
 * Looking-For-Group web interface — browse open groups, create new sessions,
 * join/leave groups, and view your active sessions.
 *
 * Uses the same backend data as the Discord /lfg command.
 */

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import {
  useCancelSocialLfgSession,
  useCompleteSocialLfgSession,
  useCreateSocialLfgSession,
  useJoinSocialGroup,
  useJoinSocialLfgSession,
  useLeaveSocialLfgSession,
  useSocialGroups,
  useSocialLfgSessions,
  useStartSocialLfgSession,
} from '@/hooks/queries/useSocialLfgQueries';
import type { LfgSession, SocialGroup } from '@/services/socialLfgService';
import { useAuthStore } from '@/store/authStore';
import {
  Add,
  Cancel as CancelIcon,
  CheckCircle,
  ExitToApp,
  Groups as GroupsIcon,
  Person,
  PlayArrow,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

// ── Tab Panel ────────────────────────────────────────────────

interface TabPanelProps {
  readonly children: React.ReactNode;
  readonly value: number;
  readonly index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
    {value === index && children}
  </Box>
);

// ── Group Card ───────────────────────────────────────────────

interface GroupCardProps {
  readonly group: SocialGroup;
  readonly userId: string;
  readonly onJoin: (id: string) => void;
  readonly joining: boolean;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, userId, onJoin, joining }) => {
  const isMember = group.members.includes(userId);
  const isFull = group.currentPlayers >= group.maxPlayers;

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: isMember ? 'primary.main' : 'divider',
        borderWidth: isMember ? 2 : 1,
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{group.activity}</Typography>
          <Chip
            label={group.status}
            size="small"
            color={
              group.status === 'open' ? 'success' : group.status === 'full' ? 'warning' : 'default'
            }
          />
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {group.description || 'No description'}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <Person fontSize="small" />
            <Typography variant="body2">
              {group.currentPlayers}/{group.maxPlayers}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            by {group.creatorName}
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={(group.currentPlayers / group.maxPlayers) * 100}
          sx={{ mt: 1, borderRadius: 1 }}
        />
      </CardContent>
      <CardActions>
        {!isMember && group.status === 'open' && !isFull && (
          <Button
            size="small"
            variant="contained"
            onClick={() => onJoin(group.id)}
            disabled={joining}
            startIcon={joining ? <CircularProgress size={14} /> : <GroupsIcon />}
          >
            Join
          </Button>
        )}
        {isMember && <Chip label="You're in this group" color="primary" size="small" />}
      </CardActions>
    </Card>
  );
};

// ── Session Card ─────────────────────────────────────────────

interface SessionCardProps {
  readonly session: LfgSession;
  readonly userId: string;
  readonly onJoin: (id: string) => void;
  readonly onLeave: (id: string) => void;
  readonly onStart: (id: string) => void;
  readonly onComplete: (id: string) => void;
  readonly onCancel: (id: string) => void;
  readonly joining: boolean;
  readonly actionPending: boolean;
}

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  userId,
  onJoin,
  onLeave,
  onStart,
  onComplete,
  onCancel,
  joining,
  actionPending,
}) => {
  const isMember = session.currentPlayers.includes(userId);
  const isHost = session.hostUserId === userId;
  const isFull = session.currentPlayers.length >= session.maxPlayers;
  const isOpen = session.status === 'open';
  const isInProgress = session.status === 'in-progress';
  const isActive = isOpen || session.status === 'full' || isInProgress;

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: isMember ? 'primary.main' : 'divider',
        borderWidth: isMember ? 2 : 1,
      }}
    >
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{session.title}</Typography>
          <Chip
            label={session.status}
            size="small"
            color={(() => {
              if (session.status === 'open') return 'success';
              if (session.status === 'in-progress') return 'info';
              if (session.status === 'full') return 'warning';
              return 'default';
            })()}
          />
        </Stack>
        <Chip label={session.activityType} size="small" sx={{ mt: 0.5 }} />
        {session.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {session.description}
          </Typography>
        )}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Person fontSize="small" />
          <Typography variant="body2">
            {session.currentPlayers.length}/{session.maxPlayers} players
          </Typography>
        </Stack>
      </CardContent>
      <CardActions>
        {!isMember && isOpen && !isFull && (
          <Button
            size="small"
            variant="contained"
            onClick={() => onJoin(session.id)}
            disabled={joining}
            startIcon={joining ? <CircularProgress size={14} /> : <GroupsIcon />}
          >
            Join Session
          </Button>
        )}
        {isMember && !isHost && isActive && (
          <Button
            size="small"
            variant="outlined"
            onClick={() => onLeave(session.id)}
            disabled={actionPending}
            startIcon={<ExitToApp />}
          >
            Leave
          </Button>
        )}
        {isHost && isActive && (
          <Stack direction="row" spacing={1}>
            {isOpen && (
              <Button
                size="small"
                variant="contained"
                color="info"
                onClick={() => onStart(session.id)}
                disabled={actionPending}
                startIcon={<PlayArrow />}
              >
                Start
              </Button>
            )}
            {(isOpen || isInProgress) && (
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => onComplete(session.id)}
                disabled={actionPending}
                startIcon={<CheckCircle />}
              >
                Complete
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              color="error"
              onClick={() => onCancel(session.id)}
              disabled={actionPending}
              startIcon={<CancelIcon />}
            >
              Cancel
            </Button>
          </Stack>
        )}
        {isMember && <Chip label="You're in this session" color="primary" size="small" />}
      </CardActions>
    </Card>
  );
};

// ── Main Page ────────────────────────────────────────────────

const LfgPage: React.FC = () => {
  const { user } = useAuthStore();
  const organizationId = user?.activeOrgId ?? '';
  const userId = user?.id ?? '';

  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newActivity, setNewActivity] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxPlayers, setNewMaxPlayers] = useState(4);

  // Data queries
  const { data: groups = [], isLoading: groupsLoading } = useSocialGroups();
  const { data: sessions = [], isLoading: sessionsLoading } = useSocialLfgSessions({
    organizationId: organizationId || undefined,
    status: 'open,full,in-progress',
  });

  // Mutations
  const joinGroup = useJoinSocialGroup();
  const joinSession = useJoinSocialLfgSession();
  const leaveSession = useLeaveSocialLfgSession();
  const startSession = useStartSocialLfgSession();
  const completeSession = useCompleteSocialLfgSession();
  const cancelSession = useCancelSocialLfgSession();
  const createSession = useCreateSocialLfgSession();

  const sessionActionPending =
    leaveSession.isPending ||
    startSession.isPending ||
    completeSession.isPending ||
    cancelSession.isPending;

  const handleCreateSession = async () => {
    if (!newTitle.trim() || !newActivity.trim()) return;
    await createSession.mutateAsync({
      organizationId,
      activityType: newActivity.trim(),
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      maxPlayers: newMaxPlayers,
    });
    setCreateOpen(false);
    setNewTitle('');
    setNewActivity('');
    setNewDescription('');
    setNewMaxPlayers(4);
  };

  // Filter by search
  const filteredGroups = groups.filter(
    g =>
      !search ||
      g.activity.toLowerCase().includes(search.toLowerCase()) ||
      g.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredSessions = sessions.filter(
    s =>
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.activityType.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Looking For Group
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Find players for any activity or create a new group
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<Add />} onClick={() => setCreateOpen(true)}>
          Create LFG
        </Button>
      </Stack>

      <TextField
        fullWidth
        size="small"
        placeholder="Search groups and sessions..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        slotProps={{
          input: { startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} /> },
        }}
        sx={{ mb: 2 }}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)}>
        <Tab label={`Groups (${filteredGroups.length})`} />
        <Tab label={`Sessions (${filteredSessions.length})`} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        {groupsLoading ? (
          <LoadingSpinner />
        ) : filteredGroups.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No open groups right now. Create one or check Discord with /lfg create.
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {filteredGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                userId={userId}
                onJoin={id => joinGroup.mutate(id)}
                joining={joinGroup.isPending}
              />
            ))}
          </Stack>
        )}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        {sessionsLoading ? (
          <LoadingSpinner />
        ) : filteredSessions.length === 0 ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            No open LFG sessions. Create one to start finding players!
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ mt: 1 }}>
            {filteredSessions.map(session => (
              <SessionCard
                key={session.id}
                session={session}
                userId={userId}
                onJoin={id => joinSession.mutate(id)}
                onLeave={id => leaveSession.mutate(id)}
                onStart={id => startSession.mutate(id)}
                onComplete={id => completeSession.mutate(id)}
                onCancel={id => cancelSession.mutate(id)}
                joining={joinSession.isPending}
                actionPending={sessionActionPending}
              />
            ))}
          </Stack>
        )}
      </TabPanel>

      {/* Create LFG Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create LFG Session</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Title"
              placeholder="e.g., Mining run in Stanton"
              fullWidth
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              required
            />
            <TextField
              label="Activity Type"
              placeholder="e.g., Mining, Trading, Combat, Exploration"
              fullWidth
              value={newActivity}
              onChange={e => setNewActivity(e.target.value)}
              required
            />
            <TextField
              label="Description"
              placeholder="Optional details about the session"
              fullWidth
              multiline
              rows={3}
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
            />
            <TextField
              label="Max Players"
              type="number"
              value={newMaxPlayers}
              onChange={e => setNewMaxPlayers(Math.max(2, Math.min(50, Number(e.target.value))))}
              slotProps={{ htmlInput: { min: 2, max: 50 } }}
              sx={{ maxWidth: 150 }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateSession}
            disabled={!newTitle.trim() || !newActivity.trim() || createSession.isPending}
            startIcon={createSession.isPending ? <CircularProgress size={16} /> : <Add />}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export const LfgPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="LFG"
    fallbackMessage="Unable to load LFG. Please try again later."
    showHomeButton
  >
    <LfgPage />
  </FeatureErrorBoundary>
);

export { LfgPage };
