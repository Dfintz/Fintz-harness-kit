import {
  BadRequestError,
  ConflictError,
  DatabaseError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils/apiErrors';
import {
  classifyInteractionError,
  INTERACTION_ERROR_CLASSES,
  isUserCorrectable,
  type InteractionErrorClass,
} from '../interactionErrorTaxonomy';

describe('classifyInteractionError', () => {
  describe('typed ApiError subclasses (by HTTP status)', () => {
    const cases: Array<[Error, InteractionErrorClass]> = [
      [new ValidationError('bad field'), 'user_input'],
      [new BadRequestError('malformed'), 'user_input'],
      [new UnauthorizedError(), 'permission'],
      [new ForbiddenError('no access'), 'permission'],
      [new NotFoundError('Fleet'), 'not_found'],
      [new ConflictError('already exists'), 'conflict'],
      [new RateLimitError(30), 'rate_limit'],
      [new ServiceUnavailableError('db not ready'), 'dependency'],
      [new DatabaseError('query failed'), 'internal'],
    ];

    it.each(cases)('classifies %s', (error, expected) => {
      expect(classifyInteractionError(error)).toBe(expected);
    });
  });

  describe('duck-typed status carriers (cross-module ApiError)', () => {
    it('classifies a plain error carrying a numeric statusCode', () => {
      const err = Object.assign(new Error('forbidden-ish'), { statusCode: 403 });
      expect(classifyInteractionError(err)).toBe('permission');
    });
  });

  describe('discord.js REST errors (duck-typed)', () => {
    it('classifies a DiscordAPIError as a dependency failure', () => {
      const err = new Error('Missing Permissions');
      Object.defineProperty(err, 'name', { value: 'DiscordAPIError[50013]' });
      (err as Error & { status?: number; rawError?: unknown }).status = 403;
      (err as Error & { rawError?: unknown }).rawError = { message: 'Missing Permissions' };
      expect(classifyInteractionError(err)).toBe('dependency');
    });

    it('classifies a Discord 429 as a rate limit', () => {
      const err = new Error('rate limited');
      Object.defineProperty(err, 'name', { value: 'DiscordAPIError[429]' });
      (err as Error & { status?: number; url?: string }).status = 429;
      (err as Error & { url?: string }).url = 'https://discord.com/api/v10/channels/1/messages';
      expect(classifyInteractionError(err)).toBe('rate_limit');
    });

    it('classifies a discord.js RateLimitError by name', () => {
      const err = new Error('global rate limit');
      Object.defineProperty(err, 'name', { value: 'RateLimitError' });
      expect(classifyInteractionError(err)).toBe('rate_limit');
    });

    it('classifies an HTTPError as a dependency failure', () => {
      const err = new Error('Service Unavailable');
      Object.defineProperty(err, 'name', { value: 'HTTPError' });
      (err as Error & { status?: number; url?: string }).status = 503;
      (err as Error & { url?: string }).url = 'https://discord.com/api/v10/gateway';
      expect(classifyInteractionError(err)).toBe('dependency');
    });
  });

  describe('timeouts', () => {
    it('classifies an AbortError by name', () => {
      const err = new Error('aborted');
      Object.defineProperty(err, 'name', { value: 'AbortError' });
      expect(classifyInteractionError(err)).toBe('timeout');
    });

    it('classifies an IPC timeout by message', () => {
      expect(classifyInteractionError(new Error('IPC request timed out after 10000ms'))).toBe(
        'timeout'
      );
    });

    it('classifies a generic timeout message', () => {
      expect(classifyInteractionError(new Error('Operation timeout'))).toBe('timeout');
    });
  });

  describe('fallback', () => {
    it('classifies an unrecognized error as internal', () => {
      expect(classifyInteractionError(new Error('something exploded'))).toBe('internal');
    });

    it('classifies a TypeError as internal', () => {
      expect(classifyInteractionError(new TypeError("cannot read 'x' of undefined"))).toBe(
        'internal'
      );
    });
  });

  describe('precedence', () => {
    it('prefers the ApiError status over a coincidental discord-looking name', () => {
      // An ApiError whose message happens to contain "timed out" must still
      // classify by its HTTP status, not as a timeout.
      const err = new ValidationError('request timed out waiting for input');
      expect(classifyInteractionError(err)).toBe('user_input');
    });
  });
});

describe('isUserCorrectable', () => {
  it('treats input/permission/not-found/conflict as user-correctable', () => {
    expect(isUserCorrectable('user_input')).toBe(true);
    expect(isUserCorrectable('permission')).toBe(true);
    expect(isUserCorrectable('not_found')).toBe(true);
    expect(isUserCorrectable('conflict')).toBe(true);
  });

  it('treats timeout/dependency/internal/rate_limit as not user-correctable', () => {
    expect(isUserCorrectable('timeout')).toBe(false);
    expect(isUserCorrectable('dependency')).toBe(false);
    expect(isUserCorrectable('internal')).toBe(false);
    expect(isUserCorrectable('rate_limit')).toBe(false);
  });

  it('covers every taxonomy class', () => {
    for (const cls of INTERACTION_ERROR_CLASSES) {
      expect(typeof isUserCorrectable(cls)).toBe('boolean');
    }
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
