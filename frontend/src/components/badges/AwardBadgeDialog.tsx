/**
 * Award Badge Dialog
 *
 * Dialog for awarding a badge/title to a member.
 * Presents an autocomplete populated with org members.
 */

import { useOrganizationMembers } from '@/hooks/queries/useOrganizationQueries';
import type { Achievement } from '@/services/badgeService';
import type { OrganizationMemberV2 } from '@/services/organizationServiceV2';
import { useAuthStore } from '@/store/authStore';
import { sanitizeImageUrl } from '@/utils/sanitize';
import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import React, { useMemo, useState } from 'react';

interface AwardBadgeDialogProps {
  open: boolean;
  onClose: () => void;
  onAward: (userId: string) => void;
  achievement: Achievement | null;
  isPending?: boolean;
}

export const AwardBadgeDialog: React.FC<Readonly<AwardBadgeDialogProps>> = ({
  open,
  onClose,
  onAward,
  achievement,
  isPending,
}) => {
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberV2 | null>(null);

  const { user } = useAuthStore();
  const orgId = user?.activeOrgId;

  const { data: membersResult, isLoading: membersLoading } = useOrganizationMembers(
    orgId,
    { limit: 200 },
    { enabled: open }
  );
  const orgMembers = useMemo(() => membersResult?.items ?? [], [membersResult]);

  const handleClose = () => {
    setSelectedMember(null);
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedMember) {
      onAward(selectedMember.userId);
      setSelectedMember(null);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Award {achievement?.type === 'title' ? 'Title' : 'Badge'}</DialogTitle>
        <DialogContent>
          {achievement && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Award &ldquo;{achievement.name}&rdquo; to a member.
            </Typography>
          )}
          <Autocomplete
            options={orgMembers}
            getOptionLabel={option => option.displayName || option.username || option.userId}
            value={selectedMember}
            onChange={(_e, value) => setSelectedMember(value)}
            loading={membersLoading}
            isOptionEqualToValue={(opt, val) => opt.userId === val.userId}
            renderOption={(props, option) => (
              <li {...props} key={option.userId}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar src={sanitizeImageUrl(option.avatar)} sx={{ width: 24, height: 24 }}>
                    {(option.displayName || option.username || '?').charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">
                      {option.displayName || option.username || option.userId}
                    </Typography>
                    {option.displayName && option.username && (
                      <Typography variant="caption" color="text.secondary">
                        @{option.username}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </li>
            )}
            renderInput={params => (
              <TextField
                {...params}
                autoFocus
                label="Member"
                margin="dense"
                placeholder="Search for a member"
                helperText="Select the member to award"
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {membersLoading ? <CircularProgress size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={!selectedMember || isPending}>
            Award
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
