import { DISCORD_STATUS } from '@/utils/brandColors';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import SpeedIcon from '@mui/icons-material/Speed';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';
import TerminalIcon from '@mui/icons-material/Terminal';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Tooltip as MuiTooltip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  useActivityHeatmap,
  useAllCommandStats,
  useGameHistory,
  usePresenceStats,
  useSystemCommandStats,
} from '@/hooks/queries/useBotStatsQueries';
import { useAuthStore } from '@/store/authStore';

// ==================== KPI Card ====================

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}

const KpiCard: React.FC<Readonly<KpiCardProps>> = ({ title, value, subtitle, icon }) => {
  const theme = useTheme();
  return (
    <Card sx={{ flex: 1, minWidth: 200 }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              p: 1,
              borderRadius: 1,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {title}
            </Typography>
            <Typography variant="h5" fontWeight="bold">
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

// ==================== Activity Heatmap ====================

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface HeatmapCellProps {
  count: number;
  maxCount: number;
}

const HeatmapCell: React.FC<Readonly<HeatmapCellProps>> = ({ count, maxCount }) => {
  const theme = useTheme();
  const intensity = maxCount > 0 ? count / maxCount : 0;
  return (
    <MuiTooltip title={`${count} active`}>
      <Box
        sx={{
          width: 18,
          height: 18,
          borderRadius: 0.5,
          backgroundColor:
            count === 0
              ? theme.palette.action.hover
              : alpha(theme.palette.primary.main, 0.15 + intensity * 0.85),
        }}
      />
    </MuiTooltip>
  );
};

// ==================== Main Dashboard ====================

export const BotStatsDashboard: React.FC = () => {
  const theme = useTheme();
  const user = useAuthStore(s => s.user);
  const guildId = (user as unknown as Record<string, unknown> | null)?.discordGuildId as
    | string
    | undefined;

  const systemStats = useSystemCommandStats();
  const commandStats = useAllCommandStats();
  const presence = usePresenceStats(guildId);
  const heatmap = useActivityHeatmap(guildId);
  const games = useGameHistory(guildId);

  const isLoading = systemStats.isLoading || commandStats.isLoading;

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 400 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading bot statistics...</Typography>
      </Stack>
    );
  }

  if (systemStats.error) {
    return <Alert severity="error">Failed to load bot statistics</Alert>;
  }

  const system = systemStats.data;
  const commands = commandStats.data ?? [];
  const presenceData = presence.data;
  const heatmapData = heatmap.data ?? [];
  const gamesData = games.data ?? [];

  // Format command stats for bar chart (top 15)
  const topCommandsChart = [...commands]
    .sort((a, b) => b.totalExecutions - a.totalExecutions)
    .slice(0, 15)
    .map(c => ({
      name: `/${c.commandName}`,
      executions: c.totalExecutions,
      success: c.successfulExecutions,
      failed: c.failedExecutions,
    }));

  // Game chart data from presence
  const gameChartData = presenceData
    ? Object.entries(presenceData.currentPlayers)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([game, count]) => ({ name: game, players: count }))
    : [];

  // Status totals
  const statusCounts = presenceData?.statusCounts ?? { online: 0, idle: 0, dnd: 0, offline: 0 };
  const totalMembers =
    statusCounts.online + statusCounts.idle + statusCounts.dnd + statusCounts.offline;

  // Heatmap grid: build 7×24 matrix
  const heatmapMax = heatmapData.reduce((m, d) => Math.max(m, d.count), 0);
  const heatmapGrid: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  for (const dp of heatmapData) {
    if (dp.dayOfWeek >= 0 && dp.dayOfWeek < 7 && dp.hour >= 0 && dp.hour < 24) {
      heatmapGrid[dp.dayOfWeek][dp.hour] = dp.count;
    }
  }

  // Game history for bar chart
  const gameHistoryChart = [...gamesData]
    .sort((a, b) => b.totalSessions - a.totalSessions)
    .slice(0, 10)
    .map(g => ({ name: g.gameName, sessions: g.totalSessions, players: g.uniquePlayers }));

  const getSuccessRate = (): number => {
    if (!system || system.totalCommands === 0) return 0;
    return Math.round((system.successfulCommands / system.totalCommands) * 100);
  };
  const successRate = getSuccessRate();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Discord Bot Statistics
      </Typography>

      {/* KPI Row */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
        <KpiCard
          title="Total Commands"
          value={system?.totalCommands ?? 0}
          subtitle={`${system?.uniqueUsers ?? 0} unique users`}
          icon={<TerminalIcon />}
        />
        <KpiCard
          title="Success Rate"
          value={`${successRate}%`}
          subtitle={`${system?.failedCommands ?? 0} failures`}
          icon={<SmartToyIcon />}
        />
        <KpiCard
          title="Avg Execution Time"
          value={`${Math.round(system?.averageExecutionTime ?? 0)}ms`}
          subtitle={`${system?.uniqueGuilds ?? 0} guilds`}
          icon={<SpeedIcon />}
        />
        <KpiCard
          title="Members Online"
          value={statusCounts.online + statusCounts.idle + statusCounts.dnd}
          subtitle={`${totalMembers} total tracked`}
          icon={<SportsEsportsIcon />}
        />
      </Stack>

      {/* Online Status Chips */}
      {presenceData && (
        <Stack direction="row" spacing={1} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
          <Chip
            label={`${statusCounts.online} Online`}
            sx={{
              backgroundColor: alpha(DISCORD_STATUS.online, 0.15),
              color: DISCORD_STATUS.online,
              fontWeight: 600,
            }}
          />
          <Chip
            label={`${statusCounts.idle} Idle`}
            sx={{
              backgroundColor: alpha(DISCORD_STATUS.idle, 0.15),
              color: DISCORD_STATUS.idle,
              fontWeight: 600,
            }}
          />
          <Chip
            label={`${statusCounts.dnd} DND`}
            sx={{
              backgroundColor: alpha(DISCORD_STATUS.dnd, 0.15),
              color: DISCORD_STATUS.dnd,
              fontWeight: 600,
            }}
          />
          <Chip
            label={`${statusCounts.offline} Offline`}
            sx={{
              backgroundColor: alpha(DISCORD_STATUS.offline, 0.15),
              color: DISCORD_STATUS.offline,
              fontWeight: 600,
            }}
          />
        </Stack>
      )}

      {/* Charts Row 1: Command Usage + Current Game Activity */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <Card sx={{ flex: 2, minWidth: 0 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top Commands
            </Typography>
            <Box sx={{ width: '100%', height: 350 }}>
              <ResponsiveContainer width="100%" height={350} minWidth={100} minHeight={100}>
                <BarChart data={topCommandsChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="success"
                    stackId="a"
                    fill={theme.palette.success.main}
                    name="Success"
                  />
                  <Bar dataKey="failed" stackId="a" fill={theme.palette.error.main} name="Failed" />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>

        {gameChartData.length > 0 && (
          <Card sx={{ flex: 1, minWidth: 0 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Game Activity
              </Typography>
              <Box sx={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height={350} minWidth={100} minHeight={100}>
                  <BarChart data={gameChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="players" fill={theme.palette.info.main} name="Players">
                      {gameChartData.map((entry, index) => (
                        <Cell
                          key={`game-${entry.name}`}
                          fill={alpha(
                            theme.palette.info.main,
                            0.5 + (index / gameChartData.length) * 0.5
                          )}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        )}
      </Stack>

      {/* Activity Heatmap */}
      {heatmapData.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Activity Heatmap (7-day)
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Member activity by hour and day of week
            </Typography>
            <Box sx={{ overflowX: 'auto' }}>
              <Box sx={{ display: 'flex', gap: 0.25, mb: 0.5, ml: 5 }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <Typography
                    key={h}
                    variant="caption"
                    sx={{ width: 18, textAlign: 'center', fontSize: 9, color: 'text.secondary' }}
                  >
                    {h}
                  </Typography>
                ))}
              </Box>
              {DAYS.map((day, dayIdx) => (
                <Box key={day} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mb: 0.25 }}>
                  <Typography
                    variant="caption"
                    sx={{ width: 36, textAlign: 'right', mr: 0.5, color: 'text.secondary' }}
                  >
                    {day}
                  </Typography>
                  {heatmapGrid[dayIdx].map((count, hour) => (
                    <HeatmapCell key={`${dayIdx}-${hour}`} count={count} maxCount={heatmapMax} />
                  ))}
                </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Game History Bar Chart */}
      {gameHistoryChart.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Top Games (7-day History)
            </Typography>
            <Box sx={{ width: '100%', height: 300 }}>
              <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={100}>
                <BarChart data={gameHistoryChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sessions" fill={theme.palette.primary.main} name="Sessions" />
                  <Bar
                    dataKey="players"
                    fill={theme.palette.secondary.main}
                    name="Unique Players"
                  />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Command Detail Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Command Breakdown
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Command</TableCell>
                  <TableCell align="right">Executions</TableCell>
                  <TableCell align="right">Success</TableCell>
                  <TableCell align="right">Failed</TableCell>
                  <TableCell align="right">Avg Time</TableCell>
                  <TableCell align="right">Users</TableCell>
                  <TableCell align="right">Last Used</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[...commands]
                  .sort((a, b) => b.totalExecutions - a.totalExecutions)
                  .map(cmd => (
                    <TableRow key={cmd.commandName}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          /{cmd.commandName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{cmd.totalExecutions}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main">
                          {cmd.successfulExecutions}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          color={cmd.failedExecutions > 0 ? 'error.main' : 'text.secondary'}
                        >
                          {cmd.failedExecutions}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{Math.round(cmd.averageExecutionTime)}ms</TableCell>
                      <TableCell align="right">{cmd.uniqueUsers}</TableCell>
                      <TableCell align="right">
                        <Typography variant="caption" color="text.secondary">
                          {cmd.lastUsed ? new Date(cmd.lastUsed).toLocaleDateString() : '—'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                {commands.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">
                        No command data available yet. Commands will appear here as they are used.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};
