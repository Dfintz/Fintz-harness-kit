/**
 * Tests for the global mutation invalidation handler wired in
 * `createQueryClient`. Verifies the `meta.invalidates` contract:
 *   - Static key list invalidates each declared query
 *   - Function form receives data + variables and resolves to keys
 *   - Mutations without `meta` are a no-op (no crash)
 *   - Failed mutations do NOT trigger invalidations
 */

import type { QueryKey } from '@tanstack/react-query';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import * as React from 'react';

import { createQueryClient } from '../queryClient';

function makeWrapper(client = createQueryClient()) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  }
  return { Wrapper, client };
}

describe('queryClient global mutation invalidation', () => {
  it('invalidates each key in a static meta.invalidates list on success', async () => {
    const { Wrapper, client } = makeWrapper();
    const keyA: QueryKey = ['a'];
    const keyB: QueryKey = ['b'];

    const queryFnA = jest.fn().mockResolvedValue('A1');
    const queryFnB = jest.fn().mockResolvedValue('B1');

    // Seed two queries so they are in the cache.
    const { result: qA } = renderHook(() => useQuery({ queryKey: keyA, queryFn: queryFnA }), {
      wrapper: Wrapper,
    });
    const { result: qB } = renderHook(() => useQuery({ queryKey: keyB, queryFn: queryFnB }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(qA.current.data).toBe('A1'));
    await waitFor(() => expect(qB.current.data).toBe('B1'));
    expect(queryFnA).toHaveBeenCalledTimes(1);
    expect(queryFnB).toHaveBeenCalledTimes(1);

    const { result: mut } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => 'done',
          meta: { invalidates: [keyA, keyB] },
        }),
      { wrapper: Wrapper }
    );

    await mut.current.mutateAsync(undefined);

    // Both queries are now invalidated → refetched.
    await waitFor(() => expect(queryFnA).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(queryFnB).toHaveBeenCalledTimes(2));

    client.clear();
  });

  it('invalidates keys returned by the function form using data + variables', async () => {
    const { Wrapper, client } = makeWrapper();
    const queryFn = jest.fn().mockResolvedValue('initial');
    const { result: q } = renderHook(
      () => useQuery({ queryKey: ['fleet', 'detail', '42'], queryFn }),
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(q.current.data).toBe('initial'));

    const builder = jest.fn((data: { ok: boolean }, variables: { fleetId: string }): QueryKey[] => [
      ['fleet', 'detail', variables.fleetId],
    ]);

    const { result: mut } = renderHook(
      () =>
        useMutation({
          mutationFn: async (vars: { fleetId: string }) => ({ ok: true, vars }),
          meta: { invalidates: builder },
        }),
      { wrapper: Wrapper }
    );

    await mut.current.mutateAsync({ fleetId: '42' });

    expect(builder).toHaveBeenCalledWith({ ok: true, vars: { fleetId: '42' } }, { fleetId: '42' });
    await waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));

    client.clear();
  });

  it('does nothing when meta.invalidates is omitted', async () => {
    const { Wrapper, client } = makeWrapper();
    const queryFn = jest.fn().mockResolvedValue('only');
    const { result: q } = renderHook(() => useQuery({ queryKey: ['untouched'], queryFn }), {
      wrapper: Wrapper,
    });
    await waitFor(() => expect(q.current.data).toBe('only'));

    const { result: mut } = renderHook(() => useMutation({ mutationFn: async () => 1 }), {
      wrapper: Wrapper,
    });
    await mut.current.mutateAsync(undefined);

    // Give the cache a microtask to settle then assert no refetch happened.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(queryFn).toHaveBeenCalledTimes(1);

    client.clear();
  });

  it('does not invalidate when the mutation fails', async () => {
    const { Wrapper, client } = makeWrapper();
    const queryFn = jest.fn().mockResolvedValue('value');
    const { result: q } = renderHook(
      () => useQuery({ queryKey: ['no-invalidate-on-error'], queryFn }),
      { wrapper: Wrapper }
    );
    await waitFor(() => expect(q.current.data).toBe('value'));

    const { result: mut } = renderHook(
      () =>
        useMutation({
          mutationFn: async () => {
            throw new Error('boom');
          },
          meta: { invalidates: [['no-invalidate-on-error']] },
        }),
      { wrapper: Wrapper }
    );

    await expect(mut.current.mutateAsync(undefined)).rejects.toThrow('boom');

    await new Promise(resolve => setTimeout(resolve, 0));
    expect(queryFn).toHaveBeenCalledTimes(1);

    client.clear();
  });
});
