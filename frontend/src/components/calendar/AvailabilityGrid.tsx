/**
 * AvailabilityGrid — Interactive 7×24 weekly availability heatmap
 * Wave 2.4 — Group Scheduling & Availability
 *
 * Click cells to toggle your own availability.
 * Heatmap overlay shows group availability (darker = more people).
 */

import {
  useGroupHeatmap,
  useMyAvailability,
  useSetMyAvailability,
} from '@/hooks/queries/useAvailabilityQueries';
import { Save as SaveIcon } from '@mui/icons-material';
import {
  alpha,
  Box,
  Button,
  CircularProgress,
  Stack,
  type Theme,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import type { AvailabilitySlot, HeatmapCell } from '@sc-fleet-manager/shared-types';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface AvailabilityGridProps {
  orgId: string;
  /** When set, highlight ±72 h around this event start on the grid */
  activityStartDate?: string;
}

/** Convert a slot to hour-level keys like "3-14" (Wednesday 14:00) */
function slotsToKeys(slots: AvailabilitySlot[]): Set<string> {
  const keys = new Set<string>();
  for (const s of slots) {
    const startH = Math.floor(s.startMinute / 60);
    const endH = Math.ceil(s.endMinute / 60);
    for (let h = startH; h < endH && h < 24; h++) {
      keys.add(`${s.dayOfWeek}-${h}`);
    }
  }
  return keys;
}

/** Convert selected hour keys back to slots */
function keysToSlots(
  keys: Set<string>
): Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> {
  const slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }> = [];
  for (let d = 0; d < 7; d++) {
    let blockStart: number | null = null;
    for (let h = 0; h <= 24; h++) {
      const active = keys.has(`${d}-${h}`);
      if (active && blockStart === null) {
        blockStart = h;
      } else if (!active && blockStart !== null) {
        slots.push({ dayOfWeek: d, startMinute: blockStart * 60, endMinute: h * 60 });
        blockStart = null;
      }
    }
  }
  return slots;
}

function getCellBg(
  theme: Theme,
  isEventCell: boolean,
  isSelected: boolean,
  intensity: number,
  groupCount: number,
  isHighlighted: boolean
): string {
  if (isEventCell) return theme.palette.warning.main;
  if (isSelected) return alpha(theme.palette.primary.main, 0.3 + intensity * 0.5);
  if (groupCount > 0) return alpha(theme.palette.info.main, intensity * 0.3);
  if (isHighlighted) return alpha(theme.palette.warning.main, 0.08);
  return theme.palette.background.default;
}

function getCellBorder(
  theme: Theme,
  isEventCell: boolean,
  isHighlighted: boolean,
  isSelected: boolean
): string {
  if (isEventCell) return `2px solid ${theme.palette.warning.main}`;
  if (isHighlighted) return `1px solid ${alpha(theme.palette.warning.main, 0.35)}`;
  if (isSelected) return `1px solid ${theme.palette.primary.main}`;
  return '1px solid transparent';
}

function getCellTooltip(
  dayLabel: string,
  hour: number,
  groupCount: number,
  totalMembers: number,
  isEventCell: boolean,
  isHighlighted: boolean
): string {
  let suffix = '';
  if (isEventCell) suffix = ' ★ Event start';
  else if (isHighlighted) suffix = ' (±72 h window)';
  return `${dayLabel} ${hour}:00 — ${groupCount} of ${totalMembers} available${suffix}`;
}

export function AvailabilityGrid({ orgId, activityStartDate }: Readonly<AvailabilityGridProps>) {
  const theme = useTheme();
  const [myKeys, setMyKeys] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // React Query hooks
  const { data: myData, isLoading: loadingMy } = useMyAvailability(orgId);
  const { data: groupData, isLoading: loadingGroup } = useGroupHeatmap(orgId);
  const setAvailability = useSetMyAvailability();

  const loading = loadingMy || loadingGroup;
  const saving = setAvailability.isPending;
  const totalMembers = groupData?.totalMembers ?? 0;

  // Build heatmap lookup from query data
  const heatmap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    if (groupData?.cells) {
      for (const c of groupData.cells) {
        map.set(`${c.dayOfWeek}-${c.hour}`, c);
      }
    }
    return map;
  }, [groupData]);

  // Seed local keys from server data (once on initial load)
  useEffect(() => {
    if (myData && !seeded) {
      setMyKeys(slotsToKeys(myData.slots));
      setSeeded(true);
    }
  }, [myData, seeded]);

  // Drag state
  const isDragging = useRef(false);
  const dragMode = useRef<'add' | 'remove'>('add');

  // Compute ±72 h highlight window around event start
  const highlightKeys = useMemo<Set<string>>(() => {
    if (!activityStartDate) return new Set();
    const start = new Date(activityStartDate);
    if (Number.isNaN(start.getTime())) return new Set();
    const keys = new Set<string>();
    // ±72 h window → 6 days centred on event day
    const windowStart = new Date(start.getTime() - 72 * 60 * 60 * 1000);
    const windowEnd = new Date(start.getTime() + 72 * 60 * 60 * 1000);
    // Walk every hour in the window and map to dayOfWeek-hour keys
    const cursor = new Date(windowStart);
    while (cursor <= windowEnd) {
      keys.add(`${cursor.getDay()}-${cursor.getHours()}`);
      cursor.setTime(cursor.getTime() + 60 * 60 * 1000);
    }
    return keys;
  }, [activityStartDate]);

  // Event exact cell
  const eventCell = useMemo<string | null>(() => {
    if (!activityStartDate) return null;
    const d = new Date(activityStartDate);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getDay()}-${d.getHours()}`;
  }, [activityStartDate]);

  // Fetch initial data — handled by React Query hooks above

  const toggleCell = useCallback((key: string) => {
    setMyKeys(prev => {
      const next = new Set(prev);
      if (dragMode.current === 'add') {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
    setDirty(true);
  }, []);

  const handleMouseDown = useCallback(
    (key: string) => {
      isDragging.current = true;
      dragMode.current = myKeys.has(key) ? 'remove' : 'add';
      toggleCell(key);
    },
    [myKeys, toggleCell]
  );

  const handleMouseEnter = useCallback(
    (key: string) => {
      if (isDragging.current) {
        toggleCell(key);
      }
    },
    [toggleCell]
  );

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Global mouse up listener
  useEffect(() => {
    globalThis.addEventListener('mouseup', handleMouseUp);
    return () => globalThis.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  const handleSave = () => {
    const slots = keysToSlots(myKeys);
    setAvailability.mutate({ orgId, slots }, { onSuccess: () => setDirty(false) });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} sx={{ color: theme.palette.primary.main }} />
      </Box>
    );
  }

  if (!orgId) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" color="text.secondary">
          Join an organization to set and view availability.
        </Typography>
      </Box>
    );
  }

  const maxCount = totalMembers || 1;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack>
          <Typography variant="subtitle1" fontWeight={600}>
            Weekly Availability ({totalMembers} member{totalMembers === 1 ? '' : 's'})
          </Typography>
          {activityStartDate && (
            <Typography variant="caption" color="warning.main">
              Highlighted: ±72 h around event start (
              {new Date(activityStartDate).toLocaleString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              )
            </Typography>
          )}
        </Stack>
        <Button
          variant="contained"
          size="small"
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          disabled={!dirty || saving}
          onClick={handleSave}
          sx={{
            backgroundColor: theme.palette.primary.main,
            '&:hover': { backgroundColor: theme.palette.primary.dark },
          }}
        >
          {saving ? 'Saving...' : 'Save My Availability'}
        </Button>
      </Stack>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `48px repeat(7, 1fr)`,
          gap: '1px',
          backgroundColor: theme.palette.divider,
          borderRadius: 1,
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {/* Header row: empty corner + day labels */}
        <Box sx={{ backgroundColor: theme.palette.background.paper, p: 0.5 }} />
        {DAY_LABELS.map(day => (
          <Box
            key={day}
            sx={{
              backgroundColor: theme.palette.background.paper,
              textAlign: 'center',
              py: 0.5,
              fontWeight: 600,
              fontSize: '0.75rem',
              color: theme.palette.text.primary,
            }}
          >
            {day}
          </Box>
        ))}

        {/* Grid rows: hour label + 7 cells */}
        {HOURS.map(hour => (
          <React.Fragment key={hour}>
            <Box
              sx={{
                backgroundColor: theme.palette.background.paper,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                color: theme.palette.text.secondary,
                px: 0.5,
              }}
            >
              {hour.toString().padStart(2, '0')}:00
            </Box>
            {Array.from({ length: 7 }, (_, d) => {
              const key = `${d}-${hour}`;
              const isSelected = myKeys.has(key);
              const cell = heatmap.get(key);
              const groupCount = cell?.count ?? 0;
              const intensity = groupCount / maxCount;
              const isHighlighted = highlightKeys.size > 0 && highlightKeys.has(key);
              const isEventCell = eventCell === key;

              const tooltip = getCellTooltip(
                DAY_LABELS[d],
                hour,
                groupCount,
                totalMembers,
                isEventCell,
                isHighlighted
              );
              const bgColor = getCellBg(
                theme,
                isEventCell,
                isSelected,
                intensity,
                groupCount,
                isHighlighted
              );
              const borderStyle = getCellBorder(theme, isEventCell, isHighlighted, isSelected);

              return (
                <Tooltip key={key} title={tooltip} arrow placement="top">
                  <Box
                    onMouseDown={() => handleMouseDown(key)}
                    onMouseEnter={() => handleMouseEnter(key)}
                    sx={{
                      height: 22,
                      cursor: 'pointer',
                      backgroundColor: bgColor,
                      border: borderStyle,
                      transition: theme.transitions.create('background-color', { duration: 100 }),
                      '&:hover': {
                        backgroundColor: isSelected
                          ? alpha(theme.palette.primary.main, 0.5 + intensity * 0.3)
                          : alpha(theme.palette.primary.main, 0.15),
                      },
                    }}
                  />
                </Tooltip>
              );
            })}
          </React.Fragment>
        ))}
      </Box>

      <Stack
        direction="row"
        spacing={2}
        sx={{ mt: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}
      >
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: 14,
              height: 14,
              backgroundColor: alpha(theme.palette.primary.main, 0.5),
              borderRadius: '2px',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Your availability
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.5}>
          <Box
            sx={{
              width: 14,
              height: 14,
              backgroundColor: alpha(theme.palette.info.main, 0.3),
              borderRadius: '2px',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Group overlap
          </Typography>
        </Stack>
        {activityStartDate && (
          <>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  backgroundColor: theme.palette.warning.main,
                  borderRadius: '2px',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                Event start
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
                  backgroundColor: alpha(theme.palette.warning.main, 0.08),
                  borderRadius: '2px',
                }}
              />
              <Typography variant="caption" color="text.secondary">
                ±72 h window
              </Typography>
            </Stack>
          </>
        )}
      </Stack>
    </Box>
  );
}
