/**
 * Changelog Page
 *
 * Displays platform release notes grouped by month/year with collapsible sections.
 * Accessible at /changelog.
 *
 * @module pages/Changelog
 */

import { changelogEntries, type ChangelogEntry } from '@/data/changelogContent';
import {
  Add as AddIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as FixedIcon,
  Build as ImprovedIcon,
  NewReleases,
  Remove as RemovedIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Container,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useTheme,
} from '@mui/material';
import React, { useMemo } from 'react';

import { SEOHead } from '@/components/SEOHead';

const categoryConfig: Record<
  string,
  { label: string; color: 'success' | 'error' | 'info' | 'warning'; icon: React.ReactElement }
> = {
  added: { label: 'Added', color: 'success', icon: <AddIcon fontSize="small" /> },
  fixed: { label: 'Fixed', color: 'error', icon: <FixedIcon fontSize="small" /> },
  improved: { label: 'Improved', color: 'info', icon: <ImprovedIcon fontSize="small" /> },
  removed: { label: 'Removed', color: 'warning', icon: <RemovedIcon fontSize="small" /> },
};

interface MonthGroup {
  key: string;
  label: string;
  entries: ChangelogEntry[];
  highlights: string[];
}

function groupByMonth(entries: ChangelogEntry[]): MonthGroup[] {
  const groups = new Map<string, ChangelogEntry[]>();

  for (const entry of entries) {
    const d = new Date(entry.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return Array.from(groups.entries()).map(([key, groupEntries]) => {
    const d = new Date(groupEntries[0].date);
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    const highlights: string[] = [];
    for (const entry of groupEntries) {
      for (const h of entry.highlights) {
        if (highlights.length < 5) {
          highlights.push(h);
        }
      }
    }

    return { key, label, entries: groupEntries, highlights };
  });
}

function VersionEntry({ entry }: Readonly<{ entry: ChangelogEntry }>) {
  const theme = useTheme();

  return (
    <Accordion
      disableGutters
      variant="outlined"
      sx={{
        mb: 1,
        '&:before': { display: 'none' },
        borderRadius: 1,
        overflow: 'hidden',
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: '100%', mr: 1 }}>
          <Chip label={`v${entry.version}`} color="primary" size="small" />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {entry.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {new Date(entry.date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2.5, pt: 0, pb: 2 }}>
        {entry.highlights.length > 0 && (
          <Box sx={{ mb: 2, pl: 1, borderLeft: `3px solid ${theme.palette.primary.main}` }}>
            <Stack spacing={0.5} sx={{ pl: 1.5 }}>
              {entry.highlights.map(h => (
                <Typography key={h} variant="body2" color="text.secondary">
                  {h}
                </Typography>
              ))}
            </Stack>
          </Box>
        )}

        {entry.changes.map(group => {
          const config = categoryConfig[group.category];
          return (
            <Box key={group.category} sx={{ mb: 1.5 }}>
              <Chip
                label={config.label}
                color={config.color}
                size="small"
                variant="outlined"
                icon={config.icon}
                sx={{ mb: 0.5 }}
              />
              <List dense disablePadding>
                {group.items.map(item => (
                  <ListItem key={item} sx={{ py: 0.25, pl: 2 }}>
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: `${config.color}.main`,
                        }}
                      />
                    </ListItemIcon>
                    <ListItemText primary={item} slotProps={{ primary: { variant: 'body2' } }} />
                  </ListItem>
                ))}
              </List>
            </Box>
          );
        })}
      </AccordionDetails>
    </Accordion>
  );
}

function MonthSection({
  group,
  defaultExpanded,
}: Readonly<{ group: MonthGroup; defaultExpanded: boolean }>) {
  const theme = useTheme();

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      sx={{
        mb: 2,
        '&:before': { display: 'none' },
        backgroundColor: 'transparent',
        boxShadow: 'none',
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          px: 2,
          borderRadius: 1,
          backgroundColor: theme.palette.action.hover,
          '& .MuiAccordionSummary-content': {
            overflow: 'hidden',
            minWidth: 0,
          },
        }}
      >
        <Stack spacing={0.5} sx={{ width: '100%', minWidth: 0, mr: 1, overflow: 'hidden' }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography variant="h6">{group.label}</Typography>
            <Chip
              label={`${group.entries.length} update${group.entries.length === 1 ? '' : 's'}`}
              size="small"
              variant="outlined"
            />
          </Stack>
          {group.highlights.length > 0 && (
            <Stack spacing={0.25} sx={{ minWidth: 0, overflow: 'hidden' }}>
              {group.highlights.map(h => (
                <Typography
                  key={h}
                  variant="body2"
                  color="text.secondary"
                  noWrap
                  sx={{ textOverflow: 'ellipsis' }}
                >
                  &bull; {h}
                </Typography>
              ))}
            </Stack>
          )}
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 1.5 }}>
        {group.entries.map(entry => (
          <VersionEntry key={`${entry.version}-${entry.title}`} entry={entry} />
        ))}
      </AccordionDetails>
    </Accordion>
  );
}

export const ChangelogPage: React.FC = () => {
  const monthGroups = useMemo(() => groupByMonth(changelogEntries), []);

  return (
    <Container maxWidth="md" sx={{ py: 3 }}>
      <SEOHead
        title="Changelog — What's New"
        description="See the latest features, improvements, and bug fixes in Fringe Core. Stay up to date with platform updates."
        canonical="https://fringecore.space/changelog"
        keywords={['changelog', 'updates', 'release notes', 'what is new']}
      />
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 4 }}>
        <NewReleases fontSize="large" color="primary" />
        <Box>
          <Typography variant="h4">Changelog</Typography>
          <Typography variant="body2" color="text.secondary">
            What&apos;s new in Fringe Core
          </Typography>
        </Box>
      </Stack>

      {monthGroups.map((group, i) => (
        <MonthSection key={group.key} group={group} defaultExpanded={i === 0} />
      ))}
    </Container>
  );
};
