import { useCurrentRoute } from '@/hooks/useCurrentRoute';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

const createWrapper =
  (initialPath: string): React.FC<{ children: React.ReactNode }> =>
  ({ children }) => <MemoryRouter initialEntries={[initialPath]}>{children}</MemoryRouter>;

describe('useCurrentRoute', () => {
  it('returns ops hub context for activities paths', () => {
    const { result } = renderHook(() => useCurrentRoute(), {
      wrapper: createWrapper('/activities'),
    });

    expect(result.current.hub?.id).toBe('ops');
    expect(result.current.route?.id).toBe('activities');
  });

  it('resolves activities calendar tab deep links to the calendar route definition', () => {
    const { result } = renderHook(() => useCurrentRoute(), {
      wrapper: createWrapper('/activities?tab=calendar'),
    });

    expect(result.current.hub?.id).toBe('ops');
    expect(result.current.route?.id).toBe('activities-calendar');
    expect(result.current.breadcrumbs.some(item => item.label === 'Calendar')).toBe(true);
  });

  it('returns organization context and org requirement for member management path', () => {
    const { result } = renderHook(() => useCurrentRoute(), {
      wrapper: createWrapper('/org-settings/members'),
    });

    expect(result.current.hub?.id).toBe('organization');
    expect(result.current.requiresOrg).toBe(true);
    expect(result.current.breadcrumbs.some(item => item.label === 'Members & Permissions')).toBe(
      true
    );
  });

  it('keeps community directory deep links in community hub context', () => {
    const { result } = renderHook(() => useCurrentRoute(), {
      wrapper: createWrapper('/directories'),
    });

    expect(result.current.hub?.id).toBe('community');
    expect(result.current.route?.id).toBe('directories');
  });

  it('resolves query-tab deep links to the tab-specific route definition', () => {
    const { result } = renderHook(() => useCurrentRoute(), {
      wrapper: createWrapper('/directories?tab=organizations'),
    });

    expect(result.current.hub?.id).toBe('community');
    expect(result.current.route?.id).toBe('directory-organizations');
    expect(result.current.breadcrumbs.some(item => item.label === 'Organizations')).toBe(true);
  });

  it('keeps tab-specific route resolution when deep links include extra query params', () => {
    const { result } = renderHook(() => useCurrentRoute(), {
      wrapper: createWrapper('/directories?view=grid&tab=organizations'),
    });

    expect(result.current.hub?.id).toBe('community');
    expect(result.current.route?.id).toBe('directory-organizations');
    expect(result.current.breadcrumbs.some(item => item.label === 'Organizations')).toBe(true);
  });
});
