import { ConvertLfgToTeamDialog } from '@/components/ConvertLfgToTeamDialog';
import { useSocialGroups } from '@/hooks/queries/useSocialLfgQueries';
import type { SocialGroup } from '@/services/socialLfgService';
import {
  GroupAdd as ConvertIcon,
  Groups as GroupsIcon,
  Person as PersonIcon,
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
  Stack,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';

interface LfgGroupListProps {
  organizationId: string;
  currentUserId?: string;
}

export const LfgGroupList: React.FC<Readonly<LfgGroupListProps>> = ({
  organizationId,
  currentUserId,
}) => {
  const { data: groups, isLoading, error } = useSocialGroups();
  const [convertTarget, setConvertTarget] = useState<SocialGroup | null>(null);

  if (isLoading) return <CircularProgress />;
  if (error) return <Alert severity="error">Failed to load LFG groups</Alert>;
  if (!groups || groups.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        No active LFG groups right now.
      </Typography>
    );
  }

  return (
    <Box>
      <Stack spacing={2}>
        {groups.map(group => (
          <Card key={group.id} variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {group.activity}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {group.description}
                  </Typography>
                </Box>
                <Chip
                  label={group.status}
                  size="small"
                  color={
                    group.status === 'open'
                      ? 'success'
                      : group.status === 'full'
                        ? 'warning'
                        : 'default'
                  }
                  variant="outlined"
                />
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 1 }} alignItems="center">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {group.currentPlayers}/{group.maxPlayers} players
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <GroupsIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    by {group.creatorName}
                  </Typography>
                </Stack>
              </Stack>
            </CardContent>
            {currentUserId === group.creatorId && group.status !== 'closed' && (
              <CardActions>
                <Button
                  size="small"
                  startIcon={<ConvertIcon />}
                  onClick={() => setConvertTarget(group)}
                >
                  Found good crew? Convert to Team
                </Button>
              </CardActions>
            )}
          </Card>
        ))}
      </Stack>

      {convertTarget && (
        <ConvertLfgToTeamDialog
          open={!!convertTarget}
          onClose={() => setConvertTarget(null)}
          groupId={convertTarget.id}
          groupName={convertTarget.activity}
          organizationId={organizationId}
          memberCount={convertTarget.currentPlayers}
        />
      )}
    </Box>
  );
};
