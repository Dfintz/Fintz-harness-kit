import { useNotification } from '@/store/uiStore';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';

import { type OrganizationMemberV2, organizationServiceV2 } from '@/services/organizationServiceV2';
import { organizationShipService } from '@/services/organizationShipService';
import {
  CREW_ROLE_OPTIONS,
  getRoleBgColor,
  getRoleColor,
  getRoleLabel,
} from '@/utils/crewRoleHelpers';
import { logger } from '@/utils/logger';

interface OrgShip {
  id: string;
  shipName: string;
  customName?: string;
  maxCrew?: number;
  assignedCrew?: string[];
  assignedCaptain?: string;
}

interface CrewManagementDialogProps {
  open: boolean;
  onClose: () => void;
  ship: OrgShip | null;
  organizationId: string;
  /** Called after a crew change to refresh the parent data */
  onCrewChanged?: () => void;
}

/**
 * CrewManagementDialog — manage crew members for an organization ship.
 *
 * Uses the existing OrganizationShipService endpoints:
 * - addCrewMember(orgId, shipId, userId)
 * - removeCrewMember(orgId, shipId, userId)
 *
 * Uses OrganizationServiceV2.getOrganizationMembers() for the member autocomplete.
 */
const CrewManagementDialog: React.FC<CrewManagementDialogProps> = ({
  open,
  onClose,
  ship,
  organizationId,
  onCrewChanged,
}) => {
  // Local state
  const [orgMembers, setOrgMembers] = useState<OrganizationMemberV2[]>([]);
  const [crewList, setCrewList] = useState<string[]>([]);
  const [selectedMember, setSelectedMember] = useState<OrganizationMemberV2 | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>('pilot');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const notification = useNotification();

  // Load org members and current crew when dialog opens
  useEffect(() => {
    if (!open || !ship || !organizationId) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // Load org members for autocomplete
        const membersResult = await organizationServiceV2.getOrganizationMembers(organizationId, {
          page: 1,
          limit: 200,
        });
        setOrgMembers(membersResult.items || []);

        // Current crew from ship data
        setCrewList(ship.assignedCrew || []);
      } catch (error) {
        logger.error('Failed to load crew data', error);
        notification.error('Failed to load crew data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [open, ship, organizationId]);

  // Filter out members already in the crew for the autocomplete
  const availableMembers = orgMembers.filter(member => !crewList.includes(member.userId));

  // Resolve member display name
  const getMemberName = useCallback(
    (userId: string): string => {
      const member = orgMembers.find(m => m.userId === userId);
      return member?.displayName || member?.username || userId.slice(0, 8);
    },
    [orgMembers]
  );

  /**
   * Add a crew member to the ship
   */
  const handleAddCrew = async () => {
    if (!selectedMember || !ship) return;

    setActionLoading(true);
    try {
      await organizationShipService.addCrewMember(
        organizationId,
        ship.id,
        selectedMember.userId,
        selectedRole || undefined
      );

      // Update local state
      setCrewList(prev => [...prev, selectedMember.userId]);
      setSelectedMember(null);
      notification.success(
        `${selectedMember.displayName || selectedMember.username} added to crew`
      );
      onCrewChanged?.();
    } catch (error) {
      logger.error('Failed to add crew member', error);
      notification.error('Failed to add crew member');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Remove a crew member from the ship
   */
  const handleRemoveCrew = async (userId: string) => {
    if (!ship) return;

    setActionLoading(true);
    try {
      await organizationShipService.removeCrewMember(organizationId, ship.id, userId);

      // Update local state
      setCrewList(prev => prev.filter(id => id !== userId));
      notification.success(`${getMemberName(userId)} removed from crew`);
      onCrewChanged?.();
    } catch (error) {
      logger.error('Failed to remove crew member', error);
      notification.error('Failed to remove crew member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRoleChange = (event: SelectChangeEvent<string>) => {
    setSelectedRole(event.target.value);
  };

  if (!ship) return null;

  const shipDisplayName = ship.customName || ship.shipName;
  const maxCrew = ship.maxCrew || 0;
  const crewCount = crewList.length;
  const isFull = maxCrew > 0 && crewCount >= maxCrew;

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" component="span">
              Manage Crew — {shipDisplayName}
            </Typography>
            <IconButton onClick={onClose} size="small" aria-label="Close">
              <CloseIcon />
            </IconButton>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {crewCount} / {maxCrew || '∞'} crew assigned
          </Typography>
        </DialogTitle>

        <DialogContent dividers>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {/* Add Crew Member Section */}
              <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                Add Crew Member
              </Typography>
              <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 2 }}>
                <Autocomplete
                  sx={{ flex: 1 }}
                  size="small"
                  options={availableMembers}
                  getOptionLabel={option => option.displayName || option.username || option.userId}
                  value={selectedMember}
                  onChange={(_e, value) => setSelectedMember(value)}
                  disabled={isFull || actionLoading}
                  renderInput={params => (
                    <TextField {...params} label="Search members" placeholder="Type to search..." />
                  )}
                  renderOption={(props, option) => (
                    <li {...props} key={option.userId}>
                      <Stack>
                        <Typography variant="body2">
                          {option.displayName || option.username}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.role}
                        </Typography>
                      </Stack>
                    </li>
                  )}
                  noOptionsText="No available members"
                />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={selectedRole}
                    label="Role"
                    onChange={handleRoleChange}
                    disabled={isFull || actionLoading}
                  >
                    {CREW_ROLE_OPTIONS.map(role => (
                      <MenuItem key={role.value} value={role.value}>
                        {role.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<PersonAddIcon />}
                  onClick={handleAddCrew}
                  disabled={!selectedMember || isFull || actionLoading}
                  sx={{ minWidth: 80, height: 40 }}
                >
                  Add
                </Button>
              </Stack>

              {isFull && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Crew is at maximum capacity ({maxCrew}).
                </Alert>
              )}

              <Divider sx={{ my: 1 }} />

              {/* Current Crew List */}
              <Typography variant="subtitle2" gutterBottom>
                Current Crew ({crewCount})
              </Typography>

              {crewList.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: 'center', py: 3 }}
                >
                  No crew assigned yet. Add members above.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {crewList.map(userId => {
                    const isCaptain = ship.assignedCaptain === userId;
                    return (
                      <ListItem
                        key={userId}
                        sx={{ px: 0 }}
                        secondaryAction={
                          <Tooltip title="Remove from crew">
                            <IconButton
                              edge="end"
                              size="small"
                              onClick={() => handleRemoveCrew(userId)}
                              disabled={actionLoading}
                              aria-label={`Remove ${getMemberName(userId)} from crew`}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        }
                      >
                        <ListItemText
                          primary={
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">{getMemberName(userId)}</Typography>
                              {isCaptain && (
                                <Chip
                                  label={getRoleLabel('captain')}
                                  size="small"
                                  sx={{
                                    color: getRoleColor('captain'),
                                    backgroundColor: getRoleBgColor('captain'),
                                    fontWeight: 600,
                                  }}
                                />
                              )}
                            </Stack>
                          }
                        />
                      </ListItem>
                    );
                  })}
                </List>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export { CrewManagementDialog };
