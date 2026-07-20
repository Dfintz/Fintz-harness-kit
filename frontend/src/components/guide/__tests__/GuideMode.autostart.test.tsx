import { muiTheme } from '@/theme/muiTheme';
import { useAuthStore } from '@/store/authStore';
import type { User } from '@/types/store';
import { ThemeProvider as MuiThemeProvider } from '@mui/material';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('@/config/env', () => {
  const actual = jest.requireActual('@/config/env');
  return {
    ...actual,
    ENABLE_LIVE_DEMO_GUIDE: true,
  };
});

import { GuideModeProvider } from '../GuideMode';
import { GuideScript } from '../guideScript';
import {
  getGuideNewUserDismissedStorageKey,
  GUIDE_AUTOSTART_SESSION_KEY,
  ONBOARDING_COMPLETED_KEY,
} from '@/utils/guideAutostart';

const shortScript: GuideScript = {
  id: 'autostart-test',
  title: 'Autostart Test',
  steps: [{ id: 'a', scene: 'One', title: 'First step', body: 'first body' }],
};

const testUser: User = {
  id: 'guide-new-user',
  username: 'guide-new-user',
  email: 'guide-new-user@example.com',
  role: 'user',
  permissions: [],
  twoFactorEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function resetAuthState(): void {
  useAuthStore.setState({
    user: null,
    token: null,
    refreshToken: null,
    isAuthenticated: false,
    expiresAt: null,
    loading: false,
    error: null,
    _logoutInProgress: false,
  });
}

describe('GuideMode env auto-start', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    globalThis.sessionStorage.clear();
    globalThis.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    globalThis.localStorage.removeItem(getGuideNewUserDismissedStorageKey(testUser.id));
    act(() => {
      resetAuthState();
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    globalThis.sessionStorage.clear();
    globalThis.localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
    globalThis.localStorage.removeItem(getGuideNewUserDismissedStorageKey(testUser.id));
    act(() => {
      resetAuthState();
    });
  });

  function renderHost(initialPath: string = '/dashboard'): { unmount: () => void } {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <MuiThemeProvider theme={muiTheme}>
          <GuideModeProvider script={shortScript}>
            <div>guide host</div>
          </GuideModeProvider>
        </MuiThemeProvider>
      </MemoryRouter>
    );
  }

  it('auto-starts once and persists marker after delayed start', async () => {
    renderHost();

    expect(globalThis.sessionStorage.getItem(GUIDE_AUTOSTART_SESSION_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(299);
    });

    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    expect(globalThis.sessionStorage.getItem(GUIDE_AUTOSTART_SESSION_KEY)).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1);
    });

    expect(await screen.findByTestId('guide-overlay')).toBeInTheDocument();
    expect(globalThis.sessionStorage.getItem(GUIDE_AUTOSTART_SESSION_KEY)).toBe('true');
  });

  it('does not auto-start when session marker already exists', () => {
    globalThis.sessionStorage.setItem(GUIDE_AUTOSTART_SESSION_KEY, 'true');

    renderHost();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
  });

  it('does not persist marker if delayed start timer is cancelled before firing', () => {
    const { unmount } = renderHost();

    act(() => {
      jest.advanceTimersByTime(100);
    });

    unmount();

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(globalThis.sessionStorage.getItem(GUIDE_AUTOSTART_SESSION_KEY)).toBeNull();
  });

  it('auto-starts for new users on first protected page and persists skip preference', async () => {
    globalThis.sessionStorage.setItem(GUIDE_AUTOSTART_SESSION_KEY, 'true');
    act(() => {
      useAuthStore.setState({
        user: testUser,
        token: 'cookie-auth',
        isAuthenticated: true,
      });
    });

    renderHost('/fleet');

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(await screen.findByTestId('guide-overlay')).toBeInTheDocument();

    act(() => {
      screen.getByRole('button', { name: /skip guide auto-start/i }).click();
    });

    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
    expect(globalThis.localStorage.getItem(getGuideNewUserDismissedStorageKey(testUser.id))).toBe(
      'true'
    );
  });

  it('does not auto-start for users who previously skipped', () => {
    globalThis.sessionStorage.setItem(GUIDE_AUTOSTART_SESSION_KEY, 'true');
    globalThis.localStorage.setItem(getGuideNewUserDismissedStorageKey(testUser.id), 'true');
    act(() => {
      useAuthStore.setState({
        user: testUser,
        token: 'cookie-auth',
        isAuthenticated: true,
      });
    });

    renderHost();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(screen.queryByTestId('guide-overlay')).not.toBeInTheDocument();
  });
});
