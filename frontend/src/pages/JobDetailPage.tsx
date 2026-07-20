/**
 * JobDetailPage — Public job listing detail page
 *
 * Renders at /directory/jobs/:jobSlug
 * Fetches the job listing and shows the JobPreBoxModal in a full-page context.
 */

import { Alert, Box, CircularProgress } from '@mui/material';
import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { JobPreBoxModal } from '@/components/JobPreviewModal';
import { useJobListing } from '@/hooks/queries/usePublicDirectoryQueries';

export const JobDetailPage: React.FC = () => {
  const { jobSlug } = useParams<{ jobSlug: string }>();
  const navigate = useNavigate();
  const { data: job, isLoading, error } = useJobListing(jobSlug);

  if (isLoading) {
    return (
      <Box
        sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          {error instanceof Error ? error.message : 'Failed to load job listing'}
        </Alert>
      </Box>
    );
  }

  return (
    <JobPreBoxModal
      job={job ?? null}
      isOpen={true}
      onClose={() => {
        // If there's browser history, go back; otherwise navigate to the directory
        if (globalThis.history.length > 1) {
          navigate(-1);
        } else {
          navigate('/directory');
        }
      }}
    />
  );
};
