/**
 * WikiDiffViewer — Side-by-side diff viewer for wiki page revisions.
 *
 * Uses the `diff` library (`diffLines`) to compute a line-level diff
 * and renders it in a side-by-side layout with colour-coded additions,
 * removals, and unchanged lines.
 *
 * @module wiki
 */

import { Box, Chip, Divider, Paper, Stack, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { diffLines, type Change } from 'diff';
import React, { useMemo } from 'react';

// ─── Props ─────────────────────────────────────────────────────

export interface WikiDiffViewerProps {
  /** Title or label for the "old" side. */
  oldLabel: string;
  /** Title or label for the "new" side. */
  newLabel: string;
  /** The old (previous) content string. */
  oldContent: string;
  /** The new (current) content string. */
  newContent: string;
}

// ─── Helpers ───────────────────────────────────────────────────

interface DiffLine {
  text: string;
  type: 'added' | 'removed' | 'unchanged';
}

/**
 * Convert `diff` Change[] into paired left/right lines for side-by-side display.
 * Each entry is a tuple: [leftLine | null, rightLine | null].
 */
function buildSideBySideLines(changes: Change[]): Array<[DiffLine | null, DiffLine | null]> {
  const rows: Array<[DiffLine | null, DiffLine | null]> = [];

  for (const change of changes) {
    // Split the value into individual lines (strip trailing newline to avoid empty line)
    const raw = change.value.endsWith('\n') ? change.value.slice(0, -1) : change.value;
    const lines = raw.split('\n');

    if (change.added) {
      for (const text of lines) {
        rows.push([null, { text, type: 'added' }]);
      }
    } else if (change.removed) {
      for (const text of lines) {
        rows.push([{ text, type: 'removed' }, null]);
      }
    } else {
      for (const text of lines) {
        rows.push([
          { text, type: 'unchanged' },
          { text, type: 'unchanged' },
        ]);
      }
    }
  }

  // Merge adjacent removed+added into true side-by-side rows
  const merged: Array<[DiffLine | null, DiffLine | null]> = [];
  let i = 0;
  while (i < rows.length) {
    const [left, right] = rows[i];
    if (left && !right && i + 1 < rows.length) {
      const [nextLeft, nextRight] = rows[i + 1];
      if (!nextLeft && nextRight) {
        // Combine removal and addition into one row
        merged.push([left, nextRight]);
        i += 2;
        continue;
      }
    }
    merged.push(rows[i]);
    i += 1;
  }

  return merged;
}

// ─── Diff Stats ────────────────────────────────────────────────

interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

function computeStats(changes: Change[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const change of changes) {
    const lineCount = change.count ?? 0;
    if (change.added) {
      additions += lineCount;
    } else if (change.removed) {
      deletions += lineCount;
    } else {
      unchanged += lineCount;
    }
  }

  return { additions, deletions, unchanged };
}

// ─── Component ─────────────────────────────────────────────────

export const WikiDiffViewer: React.FC<Readonly<WikiDiffViewerProps>> = ({
  oldLabel,
  newLabel,
  oldContent,
  newContent,
}) => {
  const theme = useTheme();

  const changes = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);
  const rows = useMemo(() => buildSideBySideLines(changes), [changes]);
  const stats = useMemo(() => computeStats(changes), [changes]);

  const bgAdded =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.success.main, 0.15)
      : alpha(theme.palette.success.light, 0.2);
  const bgRemoved =
    theme.palette.mode === 'dark'
      ? alpha(theme.palette.error.main, 0.15)
      : alpha(theme.palette.error.light, 0.2);
  const fgAdded =
    theme.palette.mode === 'dark' ? theme.palette.success.light : theme.palette.success.dark;
  const fgRemoved =
    theme.palette.mode === 'dark' ? theme.palette.error.light : theme.palette.error.dark;

  const noChanges = stats.additions === 0 && stats.deletions === 0;

  return (
    <Box>
      {/* Stats bar */}
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }} alignItems="center">
        {stats.additions > 0 && (
          <Chip
            label={`+${stats.additions} added`}
            size="small"
            sx={{ bgcolor: bgAdded, color: fgAdded, fontWeight: 600 }}
          />
        )}
        {stats.deletions > 0 && (
          <Chip
            label={`-${stats.deletions} removed`}
            size="small"
            sx={{ bgcolor: bgRemoved, color: fgRemoved, fontWeight: 600 }}
          />
        )}
        {noChanges && (
          <Typography variant="body2" color="text.secondary">
            No differences
          </Typography>
        )}
      </Stack>

      {/* Side-by-side panels */}
      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        {/* Headers */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            bgcolor: 'action.hover',
          }}
        >
          <Box sx={{ px: 2, py: 1, borderRight: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2" color="text.secondary">
              {oldLabel}
            </Typography>
          </Box>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2" color="text.secondary">
              {newLabel}
            </Typography>
          </Box>
        </Box>

        <Divider />

        {/* Diff rows */}
        <Box sx={{ maxHeight: 500, overflow: 'auto' }}>
          {rows.map((row, idx) => {
            const [left, right] = row;
            return (
              <Box
                key={idx}
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  borderBottom: idx < rows.length - 1 ? 1 : 0,
                  borderColor: 'divider',
                  minHeight: 28,
                }}
              >
                {/* Left (old) */}
                <Box
                  sx={{
                    px: 2,
                    py: 0.25,
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    borderRight: 1,
                    borderColor: 'divider',
                    bgcolor: left?.type === 'removed' ? bgRemoved : undefined,
                    color: left?.type === 'removed' ? fgRemoved : 'text.primary',
                  }}
                >
                  {left ? (left.type === 'removed' ? `- ${left.text}` : `  ${left.text}`) : ''}
                </Box>

                {/* Right (new) */}
                <Box
                  sx={{
                    px: 2,
                    py: 0.25,
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    bgcolor: right?.type === 'added' ? bgAdded : undefined,
                    color: right?.type === 'added' ? fgAdded : 'text.primary',
                  }}
                >
                  {right ? (right.type === 'added' ? `+ ${right.text}` : `  ${right.text}`) : ''}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Paper>
    </Box>
  );
};
