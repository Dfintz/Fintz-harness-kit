import { DiscordSettingsPageWithErrorBoundary as DiscordSettingsPage } from '@/pages/DiscordSettings';
import { discordService } from '@/services/discordService';
import { theme } from '@/theme';
import { ThemeProvider } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';

// Mock discord service
jest.mock('../../services/discordService');
const mockedDiscordService = discordService as jest.Mocked<typeof discordService>;

// Mock auth store to provide user with an active org
jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn((selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      user: {
        id: 'user-1',
        activeOrgId: 'org-123',
        orgRole: 'founder',
      },
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock org settings queries (useDiscordGuilds)
jest.mock('../../hooks/queries/useOrgSettingsQueries', () => ({
  useDiscordGuilds: jest.fn(() => ({
    data: [{ guildId: 'guild-123', guildName: 'Test Server', isActive: true }],
    isLoading: false,
  })),
  useGuildSettings: jest.fn(() => ({
    data: {
      teamVoiceSettings: null,
      recruitmentSettings: null,
      ticketSettings: null,
      lfgSettings: null,
      lfgNetworkSettings: null,
      smartLfgPingSettings: null,
      eventSettings: null,
      notificationPreferences: null,
      roleSyncSettings: null,
      crossModerationSettings: null,
      welcomeSettings: null,
      auditLogSettings: null,
      voiceChannelSettings: null,
      assistantRoleIds: [],
      adminUserIds: [],
      serverManagerRoleIds: [],
      timezone: '',
    },
    isLoading: false,
    error: null,
  })),
  useInvalidateGuildSettings: jest.fn(() => jest.fn()),
  useConnectDiscordGuild: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
    error: null,
  })),
  useMyGuildMembership: jest.fn(() => ({
    data: { isInGuild: true, displayName: 'TestUser' },
    isLoading: false,
  })),
  useDiscordGuildRoles: jest.fn(() => ({
    data: [{ id: 'role-1', name: 'Admin', color: '#FF0000' }],
    isLoading: false,
  })),
  useDiscordGuildChannels: jest.fn(() => ({
    data: [
      { id: 'channel-1', name: 'general', type: 0 },
      { id: 'channel-2', name: 'Voice Chat', type: 2 },
      { id: 'channel-3', name: 'Category', type: 4 },
    ],
    isLoading: false,
  })),
}));

describe('DiscordSettings Page', () => {
  const mockSettings = {
    organizationId: 'org-123',
    guildId: 'guild-123',
    guildName: 'Test Server',
    voiceConfig: {
      guildId: 'guild-123',
      nameTemplate: "{user}'s Channel",
      defaultUserLimit: 10,
      bitrate: 64000,
      autoDeleteEmpty: true,
      allowRename: true,
      allowUserLimit: true,
    },
    voiceTemplates: [
      {
        id: 'template-1',
        name: 'Mining Op',
        description: 'For mining operations',
        nameTemplate: "{user}'s Mining Channel",
        userLimit: 5,
        autoDelete: true,
        createdBy: 'user-1',
        createdAt: new Date(),
      },
    ],
    voiceChannels: [
      {
        id: 'channel-1',
        name: "User's Channel",
        guildId: 'guild-123',
        channelId: 'channel-1',
        type: 'voice',
        creatorId: 'user-1',
        isTemporary: true,
        createdAt: new Date(),
      },
    ],
    tunnels: [
      {
        id: 'tunnel-1',
        name: 'Alliance Chat',
        inviteCode: 'abc123',
        isPublic: true,
        contentFilterEnabled: true,
        allowBotMessages: true,
        maxConnectedServers: 0,
        creatorGuildId: 'guild-123',
        creatorChannelId: 'channel-1',
        connectedChannels: [
          { guildId: 'guild-123', channelId: 'channel-1', connectedAt: new Date() },
          { guildId: 'guild-456', channelId: 'channel-2', connectedAt: new Date() },
        ],
        createdAt: new Date(),
        rateLimitConfig: { maxMessages: 5, windowMs: 1000, blockDurationMs: 5000 },
      },
    ],
  };

  const renderPage = () => {
    return render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <DiscordSettingsPage />
        </ThemeProvider>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedDiscordService.getSettings.mockResolvedValue(mockSettings);
    mockedDiscordService.getGuildSettings.mockResolvedValue({
      teamVoiceSettings: null,
      recruitmentSettings: null,
      ticketSettings: null,
      lfgSettings: null,
      eventSettings: null,
      notificationPreferences: null,
      roleSyncSettings: null,
      crossModerationSettings: null,
      welcomeSettings: null,
      auditLogSettings: null,
    });
    mockedDiscordService.getUserPreferences.mockResolvedValue({});
    mockedDiscordService.updateVoiceConfig.mockResolvedValue({} as any);
    mockedDiscordService.createTunnel.mockResolvedValue({} as any);
    mockedDiscordService.deleteTunnel.mockResolvedValue({} as any);
    mockedDiscordService.createVoiceTemplate.mockResolvedValue({} as any);
    mockedDiscordService.deleteVoiceTemplate.mockResolvedValue({} as any);
  });

  it('renders page header', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Discord Dashboard')).toBeInTheDocument();
    });
  });

  it('displays server connection status', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Test Server')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('displays tabs for Voice and Tunnels', async () => {
    renderPage();

    await waitFor(() => {
      // The tabs contain icons with text
      expect(screen.getByText('Temporary Voice Channel Settings')).toBeInTheDocument();
    });
  });

  it('displays Temporary Voice Channel Settings', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Temporary Voice Channel Settings')).toBeInTheDocument();
    });
  });

  it('displays Voice Channel Templates section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Voice Channel Templates')).toBeInTheDocument();
    });
  });

  it('displays existing template', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Mining Op')).toBeInTheDocument();
    });
  });

  it('displays Active Voice Channels section', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Active Voice Channels')).toBeInTheDocument();
    });
  });

  it('switches to Comm Links tab', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Comm Links')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Comm Links'));

    expect(screen.getByText('Create New Comm Link')).toBeInTheDocument();
  });

  it('displays existing tunnel', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Comm Links')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Comm Links'));

    expect(screen.getByText('Alliance Chat')).toBeInTheDocument();
  });

  it('displays How Comm Links Work section', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Comm Links')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Comm Links'));

    expect(screen.getByText(/How Comm Links Work/)).toBeInTheDocument();
  });

  it('displays connect flow when no guild is linked', async () => {
    // Override the mock for this test to return no guilds
    const orgSettingsModule = jest.requireMock('../../hooks/queries/useOrgSettingsQueries');
    const originalImpl = orgSettingsModule.useDiscordGuilds;
    orgSettingsModule.useDiscordGuilds = jest.fn(() => ({ data: [], isLoading: false }));

    render(
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <DiscordSettingsPage />
        </ThemeProvider>
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Connect Your Discord Server')).toBeInTheDocument();
      expect(screen.getByText(/Link Server by Guild ID/)).toBeInTheDocument();
    });

    // Restore the original mock for subsequent tests
    orgSettingsModule.useDiscordGuilds = originalImpl;
  });

  it('displays error message on API failure', async () => {
    mockedDiscordService.getSettings.mockRejectedValue(
      new Error('Failed to load Discord settings')
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load Discord settings')).toBeInTheDocument();
    });
  });

  it('displays Refresh button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Refresh')).toBeInTheDocument();
    });
  });

  it('displays New Template button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('New Template')).toBeInTheDocument();
    });
  });

  it('displays Save Voice Settings button', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Save Voice Settings')).toBeInTheDocument();
    });
  });
});
