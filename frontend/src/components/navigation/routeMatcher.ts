export interface RouteLocationInput {
  pathname: string;
  search?: string;
}

export interface RouteLike {
  path: string;
}

export interface RouteMatchOptions {
  allowPrefixMatch?: boolean;
  ignoreRouteSearch?: boolean;
}

interface ParsedRoutePath {
  pathname: string;
  search: string;
}

interface NormalizedRouteLocation {
  pathname: string;
  search: string;
}

function normalizePathname(rawPathname: string): string {
  if (!rawPathname) {
    return '/';
  }

  const pathname = rawPathname.split('?')[0].split('#')[0] || '/';
  const withLeadingSlash = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/')) {
    return withLeadingSlash.slice(0, -1);
  }

  return withLeadingSlash;
}

function normalizeSearch(rawSearch?: string): string {
  if (!rawSearch) {
    return '';
  }

  const withoutHash = rawSearch.split('#')[0].trim();
  if (!withoutHash || withoutHash === '?') {
    return '';
  }

  return withoutHash.startsWith('?') ? withoutHash : `?${withoutHash}`;
}

function getSearchParamEntries(rawSearch: string): Array<{ key: string; value: string }> {
  const normalized = normalizeSearch(rawSearch);
  if (!normalized) {
    return [];
  }

  const entries: Array<{ key: string; value: string }> = [];
  const params = new URLSearchParams(normalized);
  params.forEach((value, key) => {
    entries.push({ key, value });
  });

  return entries;
}

function locationSearchContainsRequiredParams(
  requiredSearch: string,
  locationSearch: string
): boolean {
  const requiredEntries = getSearchParamEntries(requiredSearch);
  if (requiredEntries.length === 0) {
    return true;
  }

  const locationParams = new URLSearchParams(normalizeSearch(locationSearch));
  return requiredEntries.every(({ key, value }) => locationParams.getAll(key).includes(value));
}

function parseRoutePath(path: string): ParsedRoutePath {
  const queryStart = path.indexOf('?');

  if (queryStart === -1) {
    return {
      pathname: normalizePathname(path),
      search: '',
    };
  }

  return {
    pathname: normalizePathname(path.slice(0, queryStart)),
    search: normalizeSearch(path.slice(queryStart + 1)),
  };
}

function normalizeRouteLocation(input: string | RouteLocationInput): NormalizedRouteLocation {
  if (typeof input === 'string') {
    return parseRoutePath(input);
  }

  return {
    pathname: normalizePathname(input.pathname),
    search: normalizeSearch(input.search),
  };
}

function getRouteSpecificity(path: string, ignoreRouteSearch: boolean): number {
  const parsed = parseRoutePath(path);
  const searchScore = ignoreRouteSearch || !parsed.search ? 0 : 10_000;
  return searchScore + parsed.pathname.length;
}

export function routePathMatchesLocation(
  routePath: string,
  location: string | RouteLocationInput,
  options?: RouteMatchOptions
): boolean {
  const parsedRoute = parseRoutePath(routePath);
  const normalizedLocation = normalizeRouteLocation(location);
  const allowPrefixMatch = options?.allowPrefixMatch ?? true;
  const ignoreRouteSearch = options?.ignoreRouteSearch ?? false;

  if (parsedRoute.search && !ignoreRouteSearch) {
    return (
      parsedRoute.pathname === normalizedLocation.pathname &&
      locationSearchContainsRequiredParams(parsedRoute.search, normalizedLocation.search)
    );
  }

  if (parsedRoute.pathname === normalizedLocation.pathname) {
    return true;
  }

  if (!allowPrefixMatch) {
    return false;
  }

  return normalizedLocation.pathname.startsWith(`${parsedRoute.pathname}/`);
}

export function findBestPathMatch<T extends RouteLike>(
  items: readonly T[],
  location: string | RouteLocationInput,
  options?: RouteMatchOptions
): T | undefined {
  const ignoreRouteSearch = options?.ignoreRouteSearch ?? false;

  const matches = items.filter(item => routePathMatchesLocation(item.path, location, options));
  if (matches.length === 0) {
    return undefined;
  }

  matches.sort(
    (left, right) =>
      getRouteSpecificity(right.path, ignoreRouteSearch) -
      getRouteSpecificity(left.path, ignoreRouteSearch)
  );

  return matches[0];
}
