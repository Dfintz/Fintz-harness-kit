import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { MissionCard } from '@/components/missions/MissionCard';
import { MissionPriorityBadge } from '@/components/missions/MissionPriorityBadge';
import { MissionStatusBadge } from '@/components/missions/MissionStatusBadge';
import { MissionTypeBadge } from '@/components/missions/MissionTypeBadge';
import { theme } from '@/theme';
import type {
  Mission,
  MissionPriority,
  MissionStatus,
  MissionType,
} from '@sc-fleet-manager/shared-types';

const renderWithTheme = (component: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);

// ── Fixtures ──

const baseMission: Mission = {
  id: 'mission-1',
  title: 'Vanduul Border Patrol',
  description: 'Patrol the Stanton-Pyro jump point for Vanduul activity.',
  missionType: 'combat' as MissionType,
  status: 'planned' as MissionStatus,
  priority: 'high' as MissionPriority,
  difficulty: 'hard',
  organizationId: 'org-1',
  createdBy: 'user-1',
  location: 'Pyro Jump Point',
  startDate: new Date('2026-03-01').toISOString(),
  endDate: new Date('2026-03-02').toISOString(),
  tags: ['combat', 'patrol'],
  objectives: [
    { id: 'obj-1', title: 'Reach waypoint', completed: true },
    { id: 'obj-2', title: 'Scan sector', completed: false },
  ],
  participants: [
    { userId: 'u1', role: 'pilot', status: 'confirmed' },
    { userId: 'u2', role: 'gunner', status: 'pending' },
    { userId: 'u3', role: 'medic', status: 'confirmed' },
  ],
  createdAt: new Date('2026-02-28').toISOString(),
  updatedAt: new Date('2026-02-28').toISOString(),
} as unknown as Mission;

// ──────────────────────────────────────────────────────────────────────
// MissionStatusBadge
// ──────────────────────────────────────────────────────────────────────

describe('MissionStatusBadge', () => {
  const statuses: { status: MissionStatus; label: string }[] = [
    { status: 'draft' as MissionStatus, label: 'Draft' },
    { status: 'planned' as MissionStatus, label: 'Planned' },
    { status: 'briefed' as MissionStatus, label: 'Briefed' },
    { status: 'in_progress' as MissionStatus, label: 'In Progress' },
    { status: 'completed' as MissionStatus, label: 'Completed' },
    { status: 'failed' as MissionStatus, label: 'Failed' },
    { status: 'cancelled' as MissionStatus, label: 'Cancelled' },
  ];

  it.each(statuses)('renders "$label" for status "$status"', ({ status, label }) => {
    renderWithTheme(<MissionStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders with medium size', () => {
    renderWithTheme(<MissionStatusBadge status={'planned' as MissionStatus} size="medium" />);
    expect(screen.getByText('Planned')).toBeInTheDocument();
  });

  it('handles unknown status gracefully', () => {
    renderWithTheme(<MissionStatusBadge status={'unknown_status' as MissionStatus} />);
    expect(screen.getByText('unknown_status')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────
// MissionTypeBadge
// ──────────────────────────────────────────────────────────────────────

describe('MissionTypeBadge', () => {
  const types: { type: MissionType; label: string }[] = [
    { type: 'combat' as MissionType, label: 'Combat' },
    { type: 'mining' as MissionType, label: 'Mining' },
    { type: 'trading' as MissionType, label: 'Trading' },
    { type: 'exploration' as MissionType, label: 'Exploration' },
    { type: 'logistics' as MissionType, label: 'Logistics' },
    { type: 'rescue' as MissionType, label: 'Rescue' },
    { type: 'reconnaissance' as MissionType, label: 'Recon' },
    { type: 'escort' as MissionType, label: 'Escort' },
    { type: 'salvage' as MissionType, label: 'Salvage' },
    { type: 'custom' as MissionType, label: 'Custom' },
  ];

  it.each(types)('renders "$label" for type "$type"', ({ type, label }) => {
    renderWithTheme(<MissionTypeBadge missionType={type} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders with medium size', () => {
    renderWithTheme(<MissionTypeBadge missionType={'combat' as MissionType} size="medium" />);
    expect(screen.getByText('Combat')).toBeInTheDocument();
  });

  it('handles unknown type gracefully', () => {
    renderWithTheme(<MissionTypeBadge missionType={'alien' as MissionType} />);
    expect(screen.getByText('alien')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────
// MissionPriorityBadge
// ──────────────────────────────────────────────────────────────────────

describe('MissionPriorityBadge', () => {
  const priorities: { priority: MissionPriority; label: string }[] = [
    { priority: 'low' as MissionPriority, label: 'Low' },
    { priority: 'normal' as MissionPriority, label: 'Normal' },
    { priority: 'high' as MissionPriority, label: 'High' },
    { priority: 'critical' as MissionPriority, label: 'Critical' },
  ];

  it.each(priorities)('renders "$label" for priority "$priority"', ({ priority, label }) => {
    renderWithTheme(<MissionPriorityBadge priority={priority} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('renders with medium size', () => {
    renderWithTheme(
      <MissionPriorityBadge priority={'critical' as MissionPriority} size="medium" />
    );
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('handles unknown priority gracefully', () => {
    renderWithTheme(<MissionPriorityBadge priority={'legendary' as MissionPriority} />);
    expect(screen.getByText('legendary')).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────
// MissionCard
// ──────────────────────────────────────────────────────────────────────

describe('MissionCard', () => {
  it('renders mission title', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    expect(screen.getByText('Vanduul Border Patrol')).toBeInTheDocument();
  });

  it('renders mission description', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    expect(screen.getByText(/Patrol the Stanton-Pyro jump point/)).toBeInTheDocument();
  });

  it('renders status, type, and priority badges', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(screen.getByText('Combat')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  it('renders difficulty badge', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    expect(screen.getByText('Hard')).toBeInTheDocument();
  });

  it('renders location', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    expect(screen.getByText('Pyro Jump Point')).toBeInTheDocument();
  });

  it('renders objective progress', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    // 1 completed out of 2
    expect(screen.getByText('1/2')).toBeInTheDocument();
  });

  it('renders participant count', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    // 2 confirmed out of 3
    expect(screen.getByText('2/3')).toBeInTheDocument();
  });

  it('hides description in compact mode', () => {
    renderWithTheme(<MissionCard mission={baseMission} compact />);
    expect(screen.queryByText(/Patrol the Stanton-Pyro jump point/)).not.toBeInTheDocument();
  });

  it('calls onClick with mission id when clicked', () => {
    const handleClick = jest.fn();
    renderWithTheme(<MissionCard mission={baseMission} onClick={handleClick} />);

    fireEvent.click(screen.getByText('Vanduul Border Patrol'));
    expect(handleClick).toHaveBeenCalledWith('mission-1');
  });

  it('renders without optional fields', () => {
    const minimal: Mission = {
      ...baseMission,
      description: undefined,
      location: undefined,
      startDate: undefined,
      endDate: undefined,
      tags: [],
      objectives: [],
      participants: [],
    } as unknown as Mission;

    renderWithTheme(<MissionCard mission={minimal} />);
    expect(screen.getByText('Vanduul Border Patrol')).toBeInTheDocument();
    expect(screen.getByText('Planned')).toBeInTheDocument();
  });

  it('renders date range when both start and end dates provided', () => {
    renderWithTheme(<MissionCard mission={baseMission} />);
    // Should show formatted dates like "Mar 1 – Mar 2"
    expect(screen.getByText(/Mar/)).toBeInTheDocument();
  });
});
