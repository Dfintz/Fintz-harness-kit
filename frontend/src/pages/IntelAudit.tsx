/**
 * IntelAudit
 *
 * Top-level page for Membership Audit & Intel (Wave 2.1).
 * Three-tab layout: Audit Flags feed, Citizen Watchlist, and Members.
 * Includes the MemberProfileDrawer triggered from flag cards.
 *
 * Route: /intel/audit
 */
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { FlagStatus } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useMemo, useState } from 'react';

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import {
  MemberProfileDrawer,
  OrgFlagsFeed,
  OrgMembersTab,
  OrgWatchlistPanel,
} from '@/components/intel';
import { RsiMemberIntelCard } from '@/components/organization/RsiMemberIntelCard';
import { RsiMemberIntelList } from '@/components/organization/RsiMemberIntelList';
import { useAuditFlags } from '@/hooks/queries/useMemberAuditQueries';
import { useAuthStore } from '@/store/authStore';

/* ────────────────────────────────────────────────────────────────── */
/*  Tab Panel Helper                                                  */
/* ────────────────────────────────────────────────────────────────── */

interface TabPanelProps {
  children: React.ReactNode;
  value: number;
  index: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    id={`intel-audit-tabpanel-${index}`}
    aria-labelledby={`intel-audit-tab-${index}`}
    sx={{ pt: 2 }}
  >
    {value === index && children}
  </Box>
);

function a11yProps(index: number) {
  return {
    id: `intel-audit-tab-${index}`,
    'aria-controls': `intel-audit-tabpanel-${index}`,
  };
}

/* ────────────────────────────────────────────────────────────────── */
/*  Page Component                                                    */
/* ────────────────────────────────────────────────────────────────── */

export const IntelAudit: React.FC = () => {
  const user = useAuthStore(s => s.user);
  const orgId = user?.activeOrgId ?? user?.organizationId;

  const [tab, setTab] = useState(0);

  /* Member intelligence detail state */
  const [selectedMemberHandle, setSelectedMemberHandle] = useState<string | null>(null);

  /* Profile drawer state */
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  /* Fetch open flags to build per-member flag count map */
  const { data: flagsData } = useAuditFlags(orgId, {
    statuses: [FlagStatus.OPEN, FlagStatus.ESCALATED],
    pageSize: 100,
  });

  const flagCountMap = useMemo(() => {
    const map = new Map<string, number>();
    if (flagsData?.data) {
      for (const flag of flagsData.data) {
        map.set(flag.userId, (map.get(flag.userId) ?? 0) + 1);
      }
    }
    return map;
  }, [flagsData]);

  const handleViewProfile = useCallback((userId: string) => {
    setProfileUserId(userId);
  }, []);

  const handleCloseProfile = useCallback(() => {
    setProfileUserId(null);
  }, []);

  if (!orgId) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="text.secondary">
          Join an organization to access Member Audit &amp; Intel.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" fontWeight={600} sx={{ mb: 2 }}>
        Member Audit &amp; Intel
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v: number) => setTab(v)}
        sx={{ borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Audit Flags" {...a11yProps(0)} />
        <Tab label="Watchlist" {...a11yProps(1)} />
        <Tab label="Members" {...a11yProps(2)} />
        <Tab label="Intelligence" {...a11yProps(3)} />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <OrgFlagsFeed orgId={orgId} onViewProfile={handleViewProfile} />
      </TabPanel>

      <TabPanel value={tab} index={1}>
        <OrgWatchlistPanel orgId={orgId} />
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <OrgMembersTab
          orgId={orgId}
          flagCountMap={flagCountMap}
          onViewProfile={handleViewProfile}
        />
      </TabPanel>

      <TabPanel value={tab} index={3}>
        {selectedMemberHandle ? (
          <RsiMemberIntelCard
            organizationId={orgId}
            rsiHandle={selectedMemberHandle}
            onBack={() => setSelectedMemberHandle(null)}
          />
        ) : (
          <RsiMemberIntelList
            organizationId={orgId}
            onMemberClick={handle => setSelectedMemberHandle(handle)}
          />
        )}
      </TabPanel>

      {/* Member Profile Drawer */}
      <MemberProfileDrawer
        open={!!profileUserId}
        onClose={handleCloseProfile}
        orgId={orgId}
        userId={profileUserId ?? undefined}
      />
    </Box>
  );
};

/* ────────────────────────────────────────────────────────────────── */
/*  Export with Error Boundary (for routes)                           */
/* ────────────────────────────────────────────────────────────────── */

export const IntelAuditWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary
    featureName="Member Audit & Intel"
    fallbackMessage="Unable to load Member Audit & Intel. Please try again later."
    showHomeButton
  >
    <IntelAudit />
  </FeatureErrorBoundary>
);
