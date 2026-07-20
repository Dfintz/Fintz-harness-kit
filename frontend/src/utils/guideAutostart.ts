export const GUIDE_AUTOSTART_PARAM = 'guide';
export const GUIDE_AUTOSTART_SESSION_KEY = 'guide.liveDemo.autoStarted';
export const GUIDE_NEW_USER_DISMISSED_KEY_PREFIX = 'guide.newUser.dismissed';
export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

const TRUTHY_QUERY_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function buildGuideAutostartDestination(pathname: string): string {
  const [basePath = pathname, rawSearch = ''] = pathname.split('?', 2);
  const params = new URLSearchParams(rawSearch);
  params.set(GUIDE_AUTOSTART_PARAM, '1');

  const nextSearch = params.toString();
  return nextSearch ? `${basePath}?${nextSearch}` : basePath;
}

export function isGuideAutostartRequested(search: string): boolean {
  const params = new URLSearchParams(search);
  if (!params.has(GUIDE_AUTOSTART_PARAM)) {
    return false;
  }

  const value = params.get(GUIDE_AUTOSTART_PARAM)?.trim().toLowerCase();
  if (!value) {
    return true;
  }

  return TRUTHY_QUERY_VALUES.has(value);
}

export function clearGuideAutostartParam(pathname: string, search: string): string {
  const params = new URLSearchParams(search);
  params.delete(GUIDE_AUTOSTART_PARAM);

  const nextSearch = params.toString();
  return nextSearch ? `${pathname}?${nextSearch}` : pathname;
}

export function getGuideNewUserDismissedStorageKey(userId: string): string {
  return `${GUIDE_NEW_USER_DISMISSED_KEY_PREFIX}:${userId}`;
}
