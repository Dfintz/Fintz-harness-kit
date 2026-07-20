import ShieldIcon from '@mui/icons-material/Shield';
import VerifiedIcon from '@mui/icons-material/Verified';
import { Box, Chip, CircularProgress, Divider, Stack, Tooltip, Typography } from '@mui/material';
import { type Theme, alpha, useTheme } from '@mui/material/styles';
import React from 'react';

import { useOrgTrustScore } from '@/hooks/queries/useOrgTrustScoreQueries';
import type { CategoryAverages, OrgTrustScore } from '@/services/orgTrustScoreService';

function getScoreColor(score: number, theme: Theme): string {
  if (score >= 75) return theme.palette.success.main;
  if (score >= 60) return theme.palette.info.main;
  if (score >= 40) return theme.palette.warning.main;
  return theme.palette.error.main;
}

function getTierIcon(tier: string): React.ReactNode {
  if (tier === 'Platinum' || tier === 'Gold') {
    return <VerifiedIcon sx={{ fontSize: 16, mr: 0.5 }} />;
  }
  return <ShieldIcon sx={{ fontSize: 16, mr: 0.5 }} />;
}

const CATEGORY_LABELS: Record<keyof CategoryAverages, string> = {
  communication: 'Communication',
  teamwork: 'Teamwork',
  skill: 'Skill',
  reliability: 'Reliability',
  leadership: 'Leadership',
};

function BreakdownTooltipContent({ data }: Readonly<{ data: OrgTrustScore }>) {
  const theme = useTheme();
  const { breakdown: b } = data;
  return (
    <Box sx={{ p: 0.5, minWidth: 200 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Trust Score: {data.score}/100 ({data.tier})
      </Typography>
      <Divider sx={{ my: 0.5, borderColor: alpha(theme.palette.common.white, 0.2) }} />

      <Typography variant="caption" sx={{ display: 'block', mb: 0.25 }}>
        RSI Verified Org: {b.orgRsiVerified ? '✓ Yes' : '✗ No'}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.25 }}>
        Verified Members: {b.verifiedMemberCount}/{b.totalMembers} (
        {b.verifiedMemberRate.toFixed(0)}%)
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.25 }}>
        Avg Member Reputation: {b.avgMemberReputation.toFixed(1)}/100
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', mb: 0.25 }}>
        Avg Relationship Trust: {b.avgRelationshipTrust.toFixed(1)}/100 ({b.activeRelationships}{' '}
        active)
      </Typography>

      <Divider sx={{ my: 0.5, borderColor: alpha(theme.palette.common.white, 0.2) }} />
      <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.25 }}>
        Category Averages
      </Typography>
      {(Object.keys(CATEGORY_LABELS) as Array<keyof CategoryAverages>).map(cat => (
        <Typography key={cat} variant="caption" sx={{ display: 'block' }}>
          {CATEGORY_LABELS[cat]}: {b.categoryAverages[cat].toFixed(1)}
        </Typography>
      ))}
    </Box>
  );
}

interface OrgTrustBadgeProps {
  organizationId: string;
  /** Compact shows score only; full shows tier + icon */
  variant?: 'compact' | 'full';
}

export const OrgTrustBadge: React.FC<Readonly<OrgTrustBadgeProps>> = ({
  organizationId,
  variant = 'full',
}) => {
  const theme = useTheme();
  const { data, isLoading, error } = useOrgTrustScore(organizationId);

  if (isLoading) return <CircularProgress size={16} />;
  if (error || !data) return null;

  const color = getScoreColor(data.score, theme);

  if (variant === 'compact') {
    return (
      <Tooltip title={<BreakdownTooltipContent data={data} />} arrow>
        <Chip
          label={`${data.score}/100`}
          size="small"
          sx={{
            bgcolor: alpha(color, 0.12),
            color,
            fontWeight: 600,
            fontSize: '0.7rem',
            height: 22,
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={<BreakdownTooltipContent data={data} />} arrow>
      <Chip
        icon={
          <Stack direction="row" alignItems="center">
            {getTierIcon(data.tier)}
          </Stack>
        }
        label={`Trust: ${data.score} — ${data.tier}`}
        size="small"
        sx={{
          bgcolor: alpha(color, 0.12),
          color,
          fontWeight: 600,
          fontSize: '0.78rem',
          height: 26,
          border: `1px solid ${alpha(color, 0.27)}`,
          '& .MuiChip-icon': { color: `${color} !important` },
        }}
      />
    </Tooltip>
  );
};
