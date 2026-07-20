/**
 * TeamsPage — Wave 2.6 Teams/Squads System
 *
 * Main page for viewing and managing teams within an organization.
 * Left panel: team tree hierarchy. Right panel: selected team detail + members.
 */

import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import GroupsIcon from '@mui/icons-material/Groups';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type {
  AddTeamMemberRequest,
  TeamTreeNode,
  UpdateTeamMemberRequest,
  UpdateTeamRequest,
} from '@sc-fleet-manager/shared-types';
import React, { useState } from 'react';

import { TeamCreateDialog } from '@/components/team/TeamCreateDialog';
import { TeamEditDialog } from '@/components/team/TeamEditDialog';
import { TeamMemberPanel } from '@/components/team/TeamMemberPanel';
import { TeamTreeView } from '@/components/team/TeamTreeView';
import {
  useAddTeamMember,
  useCreateTeam,
  useDeleteTeam,
  useRemoveTeamMember,
  useTeamMembers,
  useTeamTree,
  useUpdateTeam,
  useUpdateTeamMember,
} from '@/hooks/queries/useTeamQueries';
import { isApiClientError } from '@/services/apiClient';
import { useAuthStore, useHasMinOrgRole } from '@/store/authStore';
import { logger } from '@/utils/logger';
import { sanitizeImageUrl } from '@/utils/sanitize';

export const TeamsPage: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId || user?.organizationId || '';
  const canManageTeams = useHasMinOrgRole('officer');

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // React Query hooks for server data
  const {
    data: treeData,
    isLoading: loading,
    error: treeError,
  } = useTeamTree(orgId, { enabled: !!orgId });
  const tree = treeData?.tree ?? [];

  const teamsDisabled =
    isApiClientError(treeError) &&
    treeError.statusCode === 403 &&
    treeError.message.toLowerCase().includes('teams feature is disabled');
  const error = (() => {
    if (!treeError || teamsDisabled) return null;
    return treeError instanceof Error ? treeError.message : 'Failed to load teams';
  })();

  const { data: membersData, isLoading: membersLoading } = useTeamMembers(
    selectedTeamId ?? undefined,
    { enabled: !!selectedTeamId }
  );
  const members = membersData ?? [];

  // Mutation hooks
  const createTeamMutation = useCreateTeam(orgId);
  const updateTeamMutation = useUpdateTeam(orgId);
  const deleteTeamMutation = useDeleteTeam(orgId);
  const addMemberMutation = useAddTeamMember(selectedTeamId ?? '', orgId);
  const updateMemberMutation = useUpdateTeamMember(selectedTeamId ?? '');
  const removeMemberMutation = useRemoveTeamMember(selectedTeamId ?? '', orgId);

  const actionLoading =
    createTeamMutation.isPending ||
    updateTeamMutation.isPending ||
    deleteTeamMutation.isPending ||
    addMemberMutation.isPending ||
    removeMemberMutation.isPending;

  const handleSelectTeam = (teamId: string) => {
    setSelectedTeamId(teamId);
  };

  // ── Find selected node in tree ───────────────────────────────────────────

  const findNode = (nodes: TeamTreeNode[], id: string): TeamTreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = findNode(node.children, id);
      if (found) return found;
    }
    return null;
  };

  const selectedNode = selectedTeamId ? findNode(tree, selectedTeamId) : null;

  // ── Actions (using React Query mutations) ────────────────────────────────

  const handleCreateTeam = async (data: Parameters<typeof createTeamMutation.mutateAsync>[0]) => {
    try {
      await createTeamMutation.mutateAsync(data);
      setShowCreateDialog(false);
    } catch (err: unknown) {
      logger.error('Failed to create team', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUpdateTeam = async (data: UpdateTeamRequest) => {
    if (!selectedTeamId) return;
    try {
      await updateTeamMutation.mutateAsync({ teamId: selectedTeamId, data });
      setShowEditDialog(false);
    } catch (err: unknown) {
      logger.error('Failed to update team', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeamId) return;
    try {
      await deleteTeamMutation.mutateAsync(selectedTeamId);
      setSelectedTeamId(null);
    } catch (err: unknown) {
      logger.error('Failed to delete team', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleAddMember = async (data: AddTeamMemberRequest) => {
    if (!selectedTeamId) return;
    try {
      await addMemberMutation.mutateAsync(data);
    } catch (err: unknown) {
      logger.error('Failed to add member', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleUpdateMember = async (memberId: string, data: UpdateTeamMemberRequest) => {
    if (!selectedTeamId) return;
    try {
      await updateMemberMutation.mutateAsync({ memberId, data });
    } catch (err: unknown) {
      logger.error('Failed to update member', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeamId) return;
    try {
      await removeMemberMutation.mutateAsync(memberId);
    } catch (err: unknown) {
      logger.error('Failed to remove member', err instanceof Error ? err : new Error(String(err)));
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (!orgId) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="info">Join an organization to manage teams.</Alert>
      </Box>
    );
  }

  if (teamsDisabled) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="warning">
          The Teams feature is disabled for your organization. An organization leader can enable it
          in <strong>Organization Settings &rarr; Feature Toggles</strong>.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 3, px: 2 }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
            Teams
          </Typography>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mt: 0.5 }}>
            Organize members into squads, divisions, and operational units
          </Typography>
        </Box>
        {canManageTeams && (
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => setShowCreateDialog(true)}
            sx={{ bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.dark' } }}
          >
            Create Team
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: 'primary.main' }} />
        </Box>
      ) : (
        <Box sx={{ display: 'flex', gap: 2, minHeight: 500 }}>
          {/* Left: Tree */}
          <Card
            sx={{
              flex: '0 0 380px',
              bgcolor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              overflow: 'auto',
              maxHeight: 'calc(100vh - 200px)',
            }}
          >
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                <Typography variant="subtitle2" sx={{ color: 'var(--text-secondary)' }}>
                  Team Hierarchy
                </Typography>
              </Box>
              <TeamTreeView
                tree={tree}
                onSelectTeam={handleSelectTeam}
                selectedTeamId={selectedTeamId || undefined}
                organizationId={orgId}
              />
            </CardContent>
          </Card>

          {/* Right: Detail + Members */}
          <Card
            sx={{
              flex: 1,
              bgcolor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              overflow: 'auto',
              maxHeight: 'calc(100vh - 200px)',
            }}
          >
            <CardContent>
              {selectedNode ? (
                <Box>
                  {/* Team header */}
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="flex-start"
                    sx={{ mb: 3 }}
                  >
                    <Stack direction="row" spacing={2} alignItems="flex-start" sx={{ flex: 1 }}>
                      <Avatar
                        src={sanitizeImageUrl(selectedNode.emblem) || undefined}
                        variant="rounded"
                        sx={{
                          width: 56,
                          height: 56,
                          bgcolor: 'action.hover',
                          flexShrink: 0,
                        }}
                      >
                        <GroupsIcon />
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                          <Typography variant="h5" sx={{ fontWeight: 600 }}>
                            {selectedNode.name}
                          </Typography>
                          <Chip
                            label={selectedNode.type}
                            size="small"
                            sx={{ textTransform: 'capitalize' }}
                          />
                          {!selectedNode.isActive && (
                            <Chip label="Inactive" size="small" color="warning" />
                          )}
                        </Stack>
                        {selectedNode.description && (
                          <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                            {selectedNode.description}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: 'var(--text-secondary)' }}>
                          Level {selectedNode.level} &bull; Max {selectedNode.maxMembers} members
                        </Typography>
                      </Box>
                    </Stack>
                    {canManageTeams && (
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Edit team">
                          <IconButton
                            size="small"
                            onClick={() => setShowEditDialog(true)}
                            disabled={actionLoading}
                            sx={{ color: 'primary.main' }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete team">
                          <IconButton
                            size="small"
                            onClick={handleDeleteTeam}
                            disabled={actionLoading}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    )}
                  </Stack>

                  {/* Members */}
                  {membersLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress size={28} sx={{ color: 'primary.main' }} />
                    </Box>
                  ) : (
                    <TeamMemberPanel
                      teamId={selectedNode.id}
                      teamName={selectedNode.name}
                      organizationId={orgId}
                      members={members}
                      maxMembers={selectedNode.maxMembers}
                      onAddMember={handleAddMember}
                      onUpdateMember={handleUpdateMember}
                      onRemoveMember={handleRemoveMember}
                      loading={actionLoading}
                    />
                  )}
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h6" sx={{ color: 'var(--text-secondary)', mb: 1 }}>
                    Select a team
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'var(--text-secondary)' }}>
                    Click on a team in the hierarchy to view details and manage members.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}

      {/* Create Dialog */}
      <TeamCreateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateTeam}
        parentOptions={tree}
        loading={actionLoading}
      />

      {/* Edit Dialog */}
      {selectedNode && (
        <TeamEditDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          onSubmit={handleUpdateTeam}
          team={selectedNode}
          parentOptions={tree}
          loading={actionLoading}
        />
      )}
    </Box>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const TeamsPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Teams">
    <TeamsPage />
  </FeatureErrorBoundary>
);
