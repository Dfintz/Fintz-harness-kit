/**
 * Bounties Page
 *
 * Tabbed layout wrapping BountyBoard and ClaimManagement components.
 * Provides the full bounty lifecycle UI — browse bounties, create new ones,
 * and manage claims.
 *
 * Sprint 0.5 Phase C — Standalone Feature Integration
 */

import { BountyBoard } from '@/components/BountyBoard';
import { ClaimManagement } from '@/components/ClaimManagement';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { useAuthStore } from '@/store/authStore';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ViewListIcon from '@mui/icons-material/ViewList';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import React, { useState } from 'react';

// ============================================================================
// Tab Panel
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
    id={`bounties-tabpanel-${index}`}
    aria-labelledby={`bounties-tab-${index}`}
    sx={{ pt: 2 }}
  >
    {value === index && children}
  </Box>
);

function a11yProps(index: number) {
  return {
    id: `bounties-tab-${index}`,
    'aria-controls': `bounties-tabpanel-${index}`,
    value: index,
  };
}

// ============================================================================
// Bounties Page
// ============================================================================

const BountiesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const user = useAuthStore(state => state.user);

  const organizationId = user?.organizationId;
  const userId = user?.id;

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', mt: 4, px: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1, color: 'var(--text-primary)' }}>
        Bounty Board
      </Typography>
      <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 3 }}>
        Browse available bounties, post new contracts, and manage your claims.
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_e, newValue: number) => setActiveTab(newValue)}
          aria-label="Bounty board tabs"
          sx={{
            '& .MuiTab-root': { textTransform: 'none', minHeight: 48, fontWeight: 500 },
            '& .Mui-selected': { color: 'var(--accent-primary) !important' },
            '& .MuiTabs-indicator': { backgroundColor: 'var(--accent-primary)' },
          }}
        >
          <Tab icon={<ViewListIcon />} iconPosition="start" label="Board" {...a11yProps(0)} />
          <Tab icon={<AssignmentIcon />} iconPosition="start" label="My Claims" {...a11yProps(1)} />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <BountyBoard organizationId={organizationId} userId={userId} />
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <ClaimManagement organizationId={organizationId} userId={userId} />
      </TabPanel>
    </Box>
  );
};

export const BountiesPageWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Bounties">
    <BountiesPage />
  </FeatureErrorBoundary>
);

export { BountiesPage };
