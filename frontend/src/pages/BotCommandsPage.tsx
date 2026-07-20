import {
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
  SmartToy as SmartToyIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';

import { buildBotInviteUrl } from '@/components/landing/DiscordBotPreview';
import { useBotCommands } from '@/hooks/queries/useBotCommandQueries';
import type { CommandDoc, CommandDocSubcommand } from '@/services/botCommandsService';
import { DISCORD_BLUE, DISCORD_BLUE_HOVER } from '@/utils/brandColors';

const CATEGORY_COLORS: Record<
  string,
  'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' | 'default'
> = {
  utility: 'default',
  fleet: 'primary',
  events: 'info',
  organization: 'secondary',
  social: 'success',
  voice: 'warning',
  admin: 'error',
};

function SubcommandTable({ subcommands }: Readonly<{ subcommands: CommandDocSubcommand[] }>) {
  if (subcommands.length === 0) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Subcommands
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Options</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {subcommands.map(sub => (
            <TableRow key={sub.name}>
              <TableCell>
                <Typography variant="body2" fontFamily="monospace">
                  {sub.name}
                </Typography>
              </TableCell>
              <TableCell>{sub.description}</TableCell>
              <TableCell>
                {sub.options.length > 0 ? (
                  <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                    {sub.options.map(opt => (
                      <Tooltip
                        key={opt.name}
                        title={`${opt.description} (${opt.type}${opt.required ? ', required' : ''})`}
                      >
                        <Chip
                          label={opt.name}
                          size="small"
                          variant={opt.required ? 'filled' : 'outlined'}
                        />
                      </Tooltip>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    None
                  </Typography>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

function CommandCard({ command }: Readonly<{ command: CommandDoc }>) {
  const [expanded, setExpanded] = useState(false);
  const hasDetails =
    command.subcommands.length > 0 || command.options.length > 0 || command.examples.length > 0;

  return (
    <Card variant="outlined">
      <CardContent sx={{ pb: hasDetails && expanded ? 0 : undefined }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6" fontFamily="monospace">
              /{command.name}
            </Typography>
            <Chip
              label={command.category}
              size="small"
              color={CATEGORY_COLORS[command.category] ?? 'default'}
            />
            {command.guildOnly && <Chip label="Server only" size="small" variant="outlined" />}
            {command.cooldown > 0 && (
              <Chip label={`${command.cooldown}s cooldown`} size="small" variant="outlined" />
            )}
          </Stack>
          {hasDetails && (
            <IconButton size="small" onClick={() => setExpanded(prev => !prev)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {command.description}
        </Typography>

        {command.permissions.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
            <Typography variant="caption" color="text.secondary">
              Requires:
            </Typography>
            {command.permissions.map(perm => (
              <Chip key={perm} label={perm} size="small" color="warning" variant="outlined" />
            ))}
          </Stack>
        )}
      </CardContent>

      {hasDetails && (
        <Collapse in={expanded}>
          <Divider />
          <CardContent>
            {command.options.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Options
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {command.options.map(opt => (
                    <Tooltip
                      key={opt.name}
                      title={`${opt.description} (${opt.type}${opt.required ? ', required' : ''})`}
                    >
                      <Chip
                        label={opt.name}
                        size="small"
                        variant={opt.required ? 'filled' : 'outlined'}
                      />
                    </Tooltip>
                  ))}
                </Stack>
              </Box>
            )}

            <SubcommandTable subcommands={command.subcommands} />

            {command.examples.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                  Examples
                </Typography>
                <Stack spacing={0.5}>
                  {command.examples.map(ex => (
                    <Typography key={ex} variant="body2" fontFamily="monospace" sx={{ pl: 1 }}>
                      {ex}
                    </Typography>
                  ))}
                </Stack>
              </Box>
            )}
          </CardContent>
        </Collapse>
      )}
    </Card>
  );
}

export const BotCommandsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data, isLoading, error } = useBotCommands(categoryFilter || undefined);
  const botInviteUrl = buildBotInviteUrl();

  const filteredCommands = useMemo(() => {
    const commands = data?.data ?? [];
    if (!search.trim()) return commands;
    const q = search.toLowerCase();
    return commands.filter(
      cmd =>
        cmd.name.includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.subcommands?.some(s => s.name.includes(q) || s.description.toLowerCase().includes(q))
    );
  }, [data, search]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load bot commands</Alert>;
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', py: 3, px: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
        <SmartToyIcon fontSize="large" color="primary" />
        <Box sx={{ flex: 1 }}>
          <Typography variant="h4">Bot Commands</Typography>
          <Typography variant="body2" color="text.secondary">
            Reference for all {data?.meta?.total ?? data?.data?.length ?? 0} Discord bot slash
            commands
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<SmartToyIcon />}
          endIcon={<OpenInNewIcon />}
          href={botInviteUrl || '#'}
          target="_blank"
          rel="noopener noreferrer"
          disabled={!botInviteUrl}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            background: DISCORD_BLUE,
            '&:hover': { background: DISCORD_BLUE_HOVER },
          }}
        >
          Add Bot to Server
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <TextField
          placeholder="Search commands..."
          size="small"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          select
          label="Category"
          size="small"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All</MenuItem>
          {(data?.meta?.categories ?? []).map(cat => (
            <MenuItem key={cat} value={cat}>
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      <Stack spacing={1.5}>
        {filteredCommands.map(cmd => (
          <CommandCard key={cmd.name} command={cmd} />
        ))}
        {filteredCommands.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No commands match your search
          </Typography>
        )}
      </Stack>
    </Box>
  );
};
