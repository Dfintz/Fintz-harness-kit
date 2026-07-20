import { ThemeProvider } from '@mui/material/styles';
import type { ParticipantInfo } from '@sc-fleet-manager/shared-types';
import { SystemRole } from '@sc-fleet-manager/shared-types';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { ParticipantCard } from '@/components/common/ParticipantCard';
import { theme } from '@/theme';

const baseParticipant: ParticipantInfo = {
  userId: 'user-1',
  username: 'starfighter42',
  displayName: 'Star Fighter',
  avatar: 'https://example.com/avatar.png',
  roles: [SystemRole.ORG_MEMBER],
  status: 'active',
  joinedAt: '2026-01-01T00:00:00Z',
};

function renderCard(props: Partial<React.ComponentProps<typeof ParticipantCard>> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ParticipantCard participant={baseParticipant} {...props} />
    </ThemeProvider>
  );
}

describe('ParticipantCard', () => {
  it('renders participant display name', () => {
    renderCard();
    expect(screen.getByText('Star Fighter')).toBeInTheDocument();
  });

  it('falls back to username when displayName is undefined', () => {
    const p = { ...baseParticipant, displayName: undefined };
    renderCard({ participant: p });
    expect(screen.getByText('starfighter42')).toBeInTheDocument();
  });

  it('renders avatar with first letter when no src', () => {
    const p = { ...baseParticipant, avatar: undefined };
    renderCard({ participant: p });
    expect(screen.getByText('S')).toBeInTheDocument();
  });

  it('renders role chip by default', () => {
    renderCard();
    expect(screen.getByText('Member')).toBeInTheDocument();
  });

  it('hides role chip when showRole=false', () => {
    renderCard({ showRole: false });
    expect(screen.queryByText('Member')).not.toBeInTheDocument();
  });

  it('renders trust score when showTrustScore is true', () => {
    const p = { ...baseParticipant, trustScore: 85 };
    renderCard({ participant: p, showTrustScore: true });
    expect(screen.getByText('85/100')).toBeInTheDocument();
  });

  it('renders compact trust score for small size', () => {
    const p = { ...baseParticipant, trustScore: 72 };
    renderCard({ participant: p, showTrustScore: true, size: 'small' });
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.queryByText('72/100')).not.toBeInTheDocument();
  });

  it('does not render trust score when trustScore is undefined', () => {
    renderCard({ showTrustScore: true });
    expect(screen.queryByText('/100')).not.toBeInTheDocument();
  });

  it('renders system badges', () => {
    const { container } = renderCard({ systems: ['teams', 'activity', 'jobs'] });
    // 3 system badge circles should be present
    const badges = container.querySelectorAll('[class*="MuiBox-root"]');
    expect(badges.length).toBeGreaterThanOrEqual(3);
  });

  it('renders primary role from participants.primaryRole', () => {
    const p = { ...baseParticipant, primaryRole: 'Fleet Commander' };
    renderCard({ participant: p });
    expect(screen.getByText('Fleet Commander')).toBeInTheDocument();
  });

  it('renders admin icon for ADMIN role', () => {
    const p = { ...baseParticipant, roles: [SystemRole.ADMIN, SystemRole.ORG_LEADER] };
    const { container } = renderCard({ participant: p });
    // Admin icon should render (SVG with testID AdminPanelSettingsIcon)
    const adminIcons = container.querySelectorAll('[data-testid="AdminPanelSettingsIcon"]');
    expect(adminIcons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders source chip in large size', () => {
    const p = { ...baseParticipant, source: 'discord_voice' as const };
    renderCard({ participant: p, size: 'large' });
    expect(screen.getByText('discord voice')).toBeInTheDocument();
  });

  it('renders extra role chips in large size', () => {
    const p = {
      ...baseParticipant,
      roles: [SystemRole.ORG_LEADER, SystemRole.ACTIVITY_HOST, SystemRole.MODERATOR],
    };
    renderCard({ participant: p, size: 'large' });
    expect(screen.getByText('Host')).toBeInTheDocument();
    expect(screen.getByText('Moderator')).toBeInTheDocument();
  });

  it('calls onClick when card is clicked', () => {
    const handleClick = jest.fn();
    renderCard({ onClick: handleClick });
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not render clickable area without onClick', () => {
    renderCard();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders all three sizes without errors', () => {
    const { unmount: u1 } = renderCard({ size: 'small' });
    u1();
    const { unmount: u2 } = renderCard({ size: 'medium' });
    u2();
    renderCard({ size: 'large' });
  });
});
