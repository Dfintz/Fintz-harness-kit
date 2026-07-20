/**
 * Organization Members & Permissions Page
 *
 * Dedicated page for member management, org chart, roles, and permissions.
 * Split from OrgSettings for cleaner tab organization.
 */
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { FlagManagementPanel } from '@/components/members/FlagManagementPanel';
import { MemberRosterTable } from '@/components/members/MemberRosterTable';
import { MembersByRoleList } from '@/components/members/MembersByRoleList';
import { ApplicationReviewPanel } from '@/components/organization/ApplicationReviewPanel';
import { InvitationReviewPanel } from '@/components/organization/InvitationReviewPanel';
import { OrgChartTab } from '@/components/organization/OrgChartTab';
import { RoleManagementPanel } from '@/components/organization/RoleManagementPanel';
import { PermissionManager } from '@/components/PermissionManager';
import { HelpTooltip } from '@/components/ui/HelpTooltip';
import { useRemoveMember, useUpdateMemberRole } from '@/hooks/queries/useOrganizationQueries';
import { useAuthStore } from '@/store/authStore';
import { logger } from '@/utils/logger';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import FlagIcon from '@mui/icons-material/Flag';
import GroupIcon from '@mui/icons-material/Group';
import RuleIcon from '@mui/icons-material/Rule';
import ShieldIcon from '@mui/icons-material/Shield';
import { Alert, Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import React, { useState } from 'react';

// ============================================================================
// Tab Panel Helper
// ============================================================================

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    id={`org-members-tabpanel-${index}`}
    aria-labelledby={`org-members-tab-${index}`}
    sx={{ pt: 2 }}
  >
    {value === index && children}
  </Box>
);

function a11yProps(index: number) {
  return {
    id: `org-members-tab-${index}`,
    'aria-controls': `org-members-tabpanel-${index}`,
  };
}

// ============================================================================
// Component
// ============================================================================

export const OrgMembers: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const [activeTab, setActiveTab] = useState(0);
  const updateRole = useUpdateMemberRole();
  const removeMember = useRemoveMember();

  const orgId = user?.activeOrgId;
  const isOwner = user?.orgRole === 'owner' || user?.orgRole === 'founder';
  const isOrgAdmin = isOwner || user?.orgRole === 'admin';

  const handleRoleChange = (userId: string, newRole: string) => {
    if (!orgId) {
      return;
    }
    updateRole.mutate(
      { organizationId: orgId, memberId: userId, role: newRole },
      {
        onError: err => {
          logger.error(
            'Failed to update member role',
            err instanceof Error ? err : new Error(String(err))
          );
        },
      }
    );
  };

  const handleRemoveMember = (userId: string) => {
    if (!orgId) {
      return;
    }
    removeMember.mutate(
      { organizationId: orgId, memberId: userId },
      {
        onError: err => {
          logger.error(
            'Failed to remove member',
            err instanceof Error ? err : new Error(String(err))
          );
        },
      }
    );
  };

  if (!orgId) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="info">You need to be a member of an organization to manage members.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 0, color: 'text.primary' }}>
          Members & Permissions
        </Typography>
        <HelpTooltip
          content="Manage organization members, review applications, configure roles and granular permissions."
          icon
          iconSize="sm"
          position="right"
        />
      </Stack>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3, mt: 1 }}>
        {user.activeOrgName || orgId} — Member management
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_e, newValue: number) => setActiveTab(newValue)}
          aria-label="Members and permissions tabs"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', minHeight: 48, fontWeight: 500 },
            '& .Mui-selected': { color: 'primary.main' },
            '& .MuiTabs-indicator': { backgroundColor: 'primary.main' },
          }}
        >
          <Tab icon={<GroupIcon />} iconPosition="start" label="Members" {...a11yProps(0)} />
          <Tab
            icon={<AccountTreeIcon />}
            iconPosition="start"
            label="Org Chart"
            {...a11yProps(1)}
          />
          <Tab icon={<ShieldIcon />} iconPosition="start" label="Permissions" {...a11yProps(2)} />
          <Tab icon={<RuleIcon />} iconPosition="start" label="Roles" {...a11yProps(3)} />
          <Tab icon={<FlagIcon />} iconPosition="start" label="Flags & Audit" {...a11yProps(4)} />
        </Tabs>
      </Box>

      {/* Members Tab */}
      <TabPanel value={activeTab} index={0}>
        <Stack spacing={3}>
          <MemberRosterTable
            organizationId={orgId}
            isAdmin={isOrgAdmin}
            onRoleChange={handleRoleChange}
            onRemoveMember={handleRemoveMember}
          />
          <ApplicationReviewPanel organizationId={orgId} />
          <InvitationReviewPanel organizationId={orgId} />
        </Stack>
      </TabPanel>

      {/* Org Chart Tab */}
      <TabPanel value={activeTab} index={1}>
        <OrgChartTab organizationId={orgId} />
      </TabPanel>

      {/* Permissions Tab */}
      <TabPanel value={activeTab} index={2}>
        <PermissionManager userId={user.id} organizationId={orgId} />
      </TabPanel>

      {/* Roles Tab */}
      <TabPanel value={activeTab} index={3}>
        <Stack spacing={3}>
          <RoleManagementPanel organizationId={orgId} isAdmin={isOrgAdmin} />
          <MembersByRoleList organizationId={orgId} />
        </Stack>
      </TabPanel>

      {/* Flags & Audit Tab */}
      <TabPanel value={activeTab} index={4}>
        <FlagManagementPanel organizationId={orgId} />
      </TabPanel>
    </Box>
  );
};

export const OrgMembersWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Organization Members">
    <OrgMembers />
  </FeatureErrorBoundary>
);
