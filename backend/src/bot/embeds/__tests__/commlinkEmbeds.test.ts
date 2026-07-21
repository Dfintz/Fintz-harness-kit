import { EmbedColors } from '../../utils/embedBuilder';
import {
  buildAvailableTunnelsEmbed,
  buildTunnelCreatedEmbed,
  buildTunnelInfoEmbed,
} from '../commlinkEmbeds';

describe('commlinkEmbeds', () => {
  it('buildTunnelCreatedEmbed preserves title/color/fields and optional invite code', () => {
    const withInvite = buildTunnelCreatedEmbed({
      tunnelName: 'Stanton Relay',
      tunnelId: 'tun-001',
      isPublicFromPassword: true,
      inviteCode: 'ABC123',
    });

    expect(withInvite.data.title).toBe('✅ Tunnel Created');
    expect(withInvite.data.color).toBe(EmbedColors.SUCCESS);
    expect(withInvite.data.fields).toHaveLength(4);
    expect(withInvite.data.fields?.[2]).toMatchObject({
      name: 'Public',
      value: 'Yes',
      inline: true,
    });
    expect(withInvite.data.fields?.[3]).toMatchObject({ name: 'Invite Code', value: '`ABC123`' });

    const withoutInvite = buildTunnelCreatedEmbed({
      tunnelName: 'Private Relay',
      tunnelId: 'tun-002',
      isPublicFromPassword: false,
    });

    expect(withoutInvite.data.fields).toHaveLength(3);
    expect(withoutInvite.data.fields?.[2]).toMatchObject({
      name: 'Public',
      value: 'No',
      inline: true,
    });
  });

  it('buildTunnelInfoEmbed preserves shared tunnel-info contract', () => {
    const embed = buildTunnelInfoEmbed({
      tunnelName: 'Pyro Bridge',
      tunnelId: 'tun-xyz',
      isPublic: false,
      connectedChannelsCount: 7,
      inviteCode: 'JOINME',
    });

    expect(embed.data.title).toBe('🔗 Tunnel: Pyro Bridge');
    expect(embed.data.color).toBe(EmbedColors.SC_BLUE);
    expect(embed.data.fields).toHaveLength(4);
    expect(embed.data.fields?.[1]).toMatchObject({ name: 'Public', value: 'No', inline: true });
    expect(embed.data.fields?.[2]).toMatchObject({ name: 'Connections', value: '7', inline: true });
    expect(embed.data.fields?.[3]).toMatchObject({ name: 'Invite Code', value: '`JOINME`' });
  });

  it('buildAvailableTunnelsEmbed preserves list sections and empty-state text', () => {
    const populated = buildAvailableTunnelsEmbed({
      guildTunnels: [{ id: 'g1', name: 'Guild Tunnel', isPublic: true, connectedChannelsCount: 2 }],
      publicTunnels: [
        { id: 'g1', name: 'Guild Tunnel', isPublic: true, connectedChannelsCount: 2 },
        { id: 'p1', name: 'Public Tunnel', isPublic: true, connectedChannelsCount: 5 },
      ],
    });

    expect(populated.data.title).toBe('🌉 Available Tunnels');
    expect(populated.data.color).toBe(EmbedColors.SC_BLUE);
    expect(populated.data.fields).toHaveLength(2);
    expect(populated.data.fields?.[0].name).toBe("Your Server's Tunnels");
    expect(populated.data.fields?.[1].name).toBe('Public Tunnels');
    expect(populated.data.description).toBeUndefined();

    const empty = buildAvailableTunnelsEmbed({ guildTunnels: [], publicTunnels: [] });
    expect(empty.data.fields ?? []).toHaveLength(0);
    expect(empty.data.description).toBe(
      'No tunnels available. Create one with `/commlink create`!'
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
