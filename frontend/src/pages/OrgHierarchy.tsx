/**
 * Organization Hierarchy Page
 *
 * Standalone page for the organization chart / hierarchy view.
 * Renders the OrgChartTab component with page-level layout.
 */
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { OrgChartTab } from '@/components/organization/OrgChartTab';
import { PageHeader } from '@/components/PageHeader';
import { useAuthStore } from '@/store/authStore';
import { Alert, Box } from '@mui/material';
import React from 'react';

export const OrgHierarchy: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const orgId = user?.activeOrgId;

  if (!orgId) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
        <Alert severity="info">
          You need to be a member of an organization to view the hierarchy.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto', mt: 4, px: 2 }}>
      <PageHeader title="Org Hierarchy" description="Organization structure and member tiers" />
      <OrgChartTab organizationId={orgId} />
    </Box>
  );
};

export const OrgHierarchyWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Organization Hierarchy">
    <OrgHierarchy />
  </FeatureErrorBoundary>
);
