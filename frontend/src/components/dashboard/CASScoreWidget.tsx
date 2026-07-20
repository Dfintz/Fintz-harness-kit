/**
 * CASScoreWidget — Dashboard widget showing org activity score, tier, sparkline, and breakdown.
 *
 * Uses MUI theme colors exclusively (no hardcoded hex).
 * Sparkline has explicit dimensions (avoid Recharts -1 bug).
 */

import { useCASHistory, useOrgCAS } from '@/hooks/queries/useCASQueries';
import {
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  TrendingUp as TrendingUpIcon,
} from '@mui/icons-material';
import { Box, Chip, Skeleton, Stack, Tooltip, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React from 'react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';

interface CASScoreWidgetProps {
  organizationId: string;
}

const TIER_SEMANTICS: Record<string, 'positive' | 'neutral' | 'negative'> = {
  VERY_ACTIVE: 'positive',
  ACTIVE: 'positive',
  MODERATE: 'neutral',
  QUIET: 'negative',
  DORMANT: 'negative',
};

const TIER_LABELS: Record<string, string> = {
  VERY_ACTIVE: 'Very Active',
  ACTIVE: 'Active',
  MODERATE: 'Moderate',
  QUIET: 'Quiet',
  DORMANT: 'Dormant',
};

export const CASScoreWidget: React.FC<Readonly<CASScoreWidgetProps>> = ({ organizationId }) => {
  const theme = useTheme();
  const { data: cas, isLoading: scoreLoading } = useOrgCAS(organizationId);
  const { data: history } = useCASHistory(organizationId, 7);

  const getTierColor = (tierSemantic: 'positive' | 'neutral' | 'negative'): string => {
    if (tierSemantic === 'positive') {
      return theme.palette.success.main;
    }
    if (tierSemantic === 'negative') {
      return theme.palette.error.main;
    }
    return theme.palette.warning.main;
  };

  const getTrendColor = (trendValue: number): string => {
    if (trendValue > 1) {
      return theme.palette.success.main;
    }
    if (trendValue < -1) {
      return theme.palette.error.main;
    }
    return theme.palette.text.secondary;
  };

  const getTrendIcon = (
    trendValue: number
  ): typeof TrendingUpIcon | typeof TrendingDownIcon | typeof TrendingFlatIcon => {
    if (trendValue > 1) {
      return TrendingUpIcon;
    }
    if (trendValue < -1) {
      return TrendingDownIcon;
    }
    return TrendingFlatIcon;
  };

  if (scoreLoading) {
    return (
      <Stack gap={1}>
        <Skeleton variant="rounded" height={60} />
        <Skeleton variant="rounded" height={40} />
      </Stack>
    );
  }

  if (!cas) {
    return (
      <Typography variant="body2" color="text.secondary">
        Activity score will appear after the first computation cycle (~15 minutes).
      </Typography>
    );
  }

  const semantic = TIER_SEMANTICS[cas.tier] ?? 'neutral';
  const tierColor = getTierColor(semantic);

  // Trend from 24h ago
  const trend = history && history.length >= 2 ? cas.score - history[0].score : 0;

  const TrendIcon = getTrendIcon(trend);
  const trendColor = getTrendColor(trend);

  // Sparkline data (last 7 days)
  const sparkData = (history ?? []).map(h => ({ value: h.score }));

  // Breakdown tooltip
  const breakdownText = cas.breakdown
    ? `Presence: ${cas.breakdown.onlinePresence}\nEngagement: ${cas.breakdown.engagement}\nConsistency: ${cas.breakdown.consistency}\nVoice: ${cas.breakdown.voiceActivity}\nSite: ${cas.breakdown.siteActivity}`
    : '';

  return (
    <Stack gap={1.5}>
      {/* Score + Tier */}
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Tooltip title={breakdownText} placement="bottom-start">
          <Stack direction="row" alignItems="baseline" gap={1}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: tierColor, lineHeight: 1 }}>
              {Math.round(cas.score)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              /100
            </Typography>
          </Stack>
        </Tooltip>

        <Stack alignItems="flex-end" gap={0.5}>
          <Chip
            label={TIER_LABELS[cas.tier] ?? cas.tier}
            size="small"
            sx={{ bgcolor: tierColor, color: 'white', fontWeight: 600 }}
          />
          <Stack direction="row" alignItems="center" gap={0.5}>
            <TrendIcon sx={{ fontSize: 16, color: trendColor }} />
            <Typography variant="caption" sx={{ color: trendColor }}>
              {trend > 0 ? '+' : ''}
              {Math.round(trend * 10) / 10}
            </Typography>
          </Stack>
        </Stack>
      </Stack>

      {/* Sparkline */}
      {sparkData.length > 2 && (
        <Box sx={{ width: '100%', height: 48, minWidth: 100, minHeight: 48 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={48}>
            <AreaChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <defs>
                <linearGradient id="casGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tierColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={tierColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke={tierColor}
                fill="url(#casGradient)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* Computed timestamp */}
      <Typography variant="caption" color="text.disabled">
        Updated {new Date(cas.computedAt).toLocaleTimeString()}
      </Typography>
    </Stack>
  );
};
