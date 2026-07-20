/**
 * Tests for Participation Query Hooks
 * Sprint 20-E: useUnifiedParticipation Hook
 */

import {
  useMyParticipation,
  useSystemParticipation,
  useUserParticipation,
} from '@/hooks/queries/useParticipationQueries';
import { participationService } from '@/services/participationService';
import type { ParticipationSummary, ParticipationSystemType } from '@sc-fleet-manager/shared-types';
import { SystemRole } from '@sc-fleet-manager/shared-types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';

jest.mock('../../../services/participationService');

// Mock auth store — useMyParticipation reads userId from here and gates `enabled`
// on it. Provide a fake user so the query actually runs.
jest.mock('@/store/authStore', () => ({
  useAuthStore: jest.fn(<T>(selector?: (state: { user: { id: string } | null }) => T) => {
    const state = { user: { id: 'user-123' } };
    return selector ? selector(state) : state;
  }),
}));

const mockedService = participationService as jest.Mocked<typeof participationService>;

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
};

const mockSummary: ParticipationSummary = {
  userId: 'user-123',
  totalParticipations: 3,
  systems: [
    {
      system: 'team',
      participants: [
        {
          userId: 'user-123',
          username: 'TestUser',
          roles: [SystemRole.ORG_MEMBER],
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
      ],
    },
    {
      system: 'activity',
      participants: [
        {
          userId: 'user-123',
          username: 'TestUser',
          roles: [SystemRole.ACTIVITY_PARTICIPANT],
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
      ],
    },
    {
      system: 'lfg',
      participants: [
        {
          userId: 'user-123',
          username: 'TestUser',
          roles: [SystemRole.LFG_MEMBER],
          status: 'pending',
          joinedAt: new Date().toISOString(),
        },
      ],
    },
  ],
  activeCount: 2,
  pendingCount: 1,
  allRoles: [SystemRole.ORG_MEMBER, SystemRole.ACTIVITY_PARTICIPANT, SystemRole.LFG_MEMBER],
};

// ── useMyParticipation ─────────────────────────────────────────────────

describe('useMyParticipation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch current user participation summary', async () => {
    mockedService.getMySummary.mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useMyParticipation(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.getMySummary).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual(mockSummary);
  });

  it('should pass filters to the service', async () => {
    mockedService.getMySummary.mockResolvedValue(mockSummary);
    const params = {
      organizationId: 'org-456',
      systems: ['team', 'activity'] as ParticipationSystemType[],
    };

    const { result } = renderHook(() => useMyParticipation(params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.getMySummary).toHaveBeenCalledWith(params);
  });

  it('should return loading state initially', () => {
    mockedService.getMySummary.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useMyParticipation(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('should return error state on failure', async () => {
    mockedService.getMySummary.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useMyParticipation(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeDefined();
  });
});

// ── useUserParticipation ───────────────────────────────────────────────

describe('useUserParticipation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch participation for a specific user', async () => {
    mockedService.getUserSummary.mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useUserParticipation('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.getUserSummary).toHaveBeenCalledWith('user-123', undefined);
    expect(result.current.data).toEqual(mockSummary);
  });

  it('should not fetch when userId is undefined (enabled guard)', () => {
    const { result } = renderHook(() => useUserParticipation(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedService.getUserSummary).not.toHaveBeenCalled();
  });

  it('should pass filters along with userId', async () => {
    mockedService.getUserSummary.mockResolvedValue(mockSummary);
    const params = { organizationId: 'org-789', systems: ['job'] as ParticipationSystemType[] };

    const { result } = renderHook(() => useUserParticipation('user-123', params), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.getUserSummary).toHaveBeenCalledWith('user-123', params);
  });

  it('should return error on service failure', async () => {
    mockedService.getUserSummary.mockRejectedValue(new Error('Forbidden'));

    const { result } = renderHook(() => useUserParticipation('user-123'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useSystemParticipation ─────────────────────────────────────────────

describe('useSystemParticipation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch participation for a single system', async () => {
    mockedService.getUserSummary.mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useSystemParticipation('user-123', 'team', 'org-456'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.getUserSummary).toHaveBeenCalledWith('user-123', {
      organizationId: 'org-456',
      systems: ['team'],
    });
  });

  it('should not fetch when userId is undefined', () => {
    const { result } = renderHook(() => useSystemParticipation(undefined, 'activity'), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedService.getUserSummary).not.toHaveBeenCalled();
  });

  it('should work without organizationId', async () => {
    mockedService.getUserSummary.mockResolvedValue(mockSummary);

    const { result } = renderHook(() => useSystemParticipation('user-123', 'lfg'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockedService.getUserSummary).toHaveBeenCalledWith('user-123', {
      organizationId: undefined,
      systems: ['lfg'],
    });
  });
});
