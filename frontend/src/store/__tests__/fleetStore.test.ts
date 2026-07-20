import { useFleetStore } from '@/store/fleetStore';
import { act, renderHook } from '@testing-library/react';

const mockGet = jest.fn();
const mockPost = jest.fn();
const mockDelete = jest.fn();
const mockPut = jest.fn();

jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: (...args: unknown[]) => mockGet(...args),
    post: (...args: unknown[]) => mockPost(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
    put: (...args: unknown[]) => mockPut(...args),
  },
  isApiClientError: (e: unknown) =>
    e && typeof e === 'object' && 'statusCode' in (e as Record<string, unknown>),
  getErrorMessage: (e: unknown) => (e as Error)?.message || 'An unexpected error occurred',
}));

describe('FleetStore', () => {
  beforeEach(() => {
    // Clear store state using clearFleet
    useFleetStore.getState().clearFleet();
    useFleetStore.getState().clearError();
    jest.clearAllMocks();
  });

  it('initializes with empty members', () => {
    const { result } = renderHook(() => useFleetStore());
    expect(result.current.members).toEqual([]);
    expect(result.current.totalMembers).toBe(0);
    expect(result.current.activeMembers).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('fetches fleet members successfully', async () => {
    const mockMembers = [
      { id: '1', name: 'Member 1', status: 'active' as const },
      { id: '2', name: 'Member 2', status: 'inactive' as const },
    ];

    mockGet.mockResolvedValueOnce({ data: mockMembers });

    const { result } = renderHook(() => useFleetStore());

    await act(async () => {
      await result.current.fetchFleet();
    });

    expect(result.current.members).toEqual(mockMembers);
    expect(result.current.totalMembers).toBe(2);
    expect(result.current.activeMembers).toBe(1);
    expect(result.current.loading).toBe(false);
  });

  it('handles fetch error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Failed to fetch'));

    const { result } = renderHook(() => useFleetStore());

    await act(async () => {
      await result.current.fetchFleet();
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.error?.message).toBe('Failed to fetch');
    expect(result.current.loading).toBe(false);
  });

  it('adds a member', async () => {
    const newMember = { id: '3', name: 'New Member', status: 'active' as const };
    mockPost.mockResolvedValueOnce({ data: newMember });

    const { result } = renderHook(() => useFleetStore());

    await act(async () => {
      await result.current.addMember('3');
    });

    expect(mockPost).toHaveBeenCalledWith('/api/v2/fleets/members', { memberId: '3' });
    expect(result.current.members).toContainEqual(newMember);
    expect(result.current.totalMembers).toBe(1);
    expect(result.current.activeMembers).toBe(1);
  });

  it('removes a member', async () => {
    const mockMembers = [
      { id: '1', name: 'Member 1', status: 'active' as const },
      { id: '2', name: 'Member 2', status: 'active' as const },
    ];

    mockGet.mockResolvedValueOnce({ data: mockMembers });
    mockDelete.mockResolvedValueOnce({});

    const { result } = renderHook(() => useFleetStore());

    await act(async () => {
      await result.current.fetchFleet();
    });

    expect(result.current.members).toHaveLength(2);

    await act(async () => {
      await result.current.removeMember('1');
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0].id).toBe('2');
    expect(result.current.totalMembers).toBe(1);
  });

  it('updates a member', async () => {
    const mockMembers = [{ id: '1', name: 'Member 1', status: 'active' as const }];
    const updatedMember = { id: '1', username: 'Updated Member', status: 'inactive' as const };

    mockGet.mockResolvedValueOnce({ data: mockMembers });
    mockPut.mockResolvedValueOnce({ data: updatedMember });

    const { result } = renderHook(() => useFleetStore());

    await act(async () => {
      await result.current.fetchFleet();
    });

    await act(async () => {
      await result.current.updateMember('1', { username: 'Updated Member', status: 'inactive' });
    });

    expect(result.current.members[0].username).toBe('Updated Member');
    expect(result.current.members[0].status).toBe('inactive');
    expect(result.current.activeMembers).toBe(0);
  });

  it('clears fleet', () => {
    const { result } = renderHook(() => useFleetStore());

    act(() => {
      // Manually set some state
      result.current.fetchFleet();
    });

    act(() => {
      result.current.clearFleet();
    });

    expect(result.current.members).toEqual([]);
    expect(result.current.totalMembers).toBe(0);
    expect(result.current.activeMembers).toBe(0);
  });

  it('clears error', async () => {
    mockGet.mockRejectedValueOnce(new Error('Error'));

    const { result } = renderHook(() => useFleetStore());

    await act(async () => {
      await result.current.fetchFleet();
    });

    expect(result.current.error).toBeTruthy();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('tracks active member count correctly', async () => {
    const mockMembers = [
      { id: '1', name: 'Member 1', status: 'active' as const },
      { id: '2', name: 'Member 2', status: 'active' as const },
      { id: '3', name: 'Member 3', status: 'inactive' as const },
    ];

    mockGet.mockResolvedValueOnce({ data: mockMembers });

    const { result } = renderHook(() => useFleetStore());

    await act(async () => {
      await result.current.fetchFleet();
    });

    expect(result.current.activeMembers).toBe(2);
    expect(result.current.totalMembers).toBe(3);
  });
});
