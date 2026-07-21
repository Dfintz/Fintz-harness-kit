import { isSensitiveKey, REDACTED, redactionFormat, redactLogInfo } from '../../utils/logRedaction';

describe('logRedaction', () => {
  describe('isSensitiveKey', () => {
    it.each([
      'password',
      'Password',
      'userPassword',
      'passphrase',
      'token',
      'accessToken',
      'refresh_token',
      'secret',
      'clientSecret',
      'authorization',
      'Authorization',
      'oauthState',
      'apiKey',
      'api_key',
      'API_KEY',
      'credential',
      'cookie',
      'Cookie',
      'bearer',
      'jwt',
      'privateKey',
      'private_key',
      'sessionId',
      'session_id',
    ])('treats "%s" as sensitive', key => {
      expect(isSensitiveKey(key)).toBe(true);
    });

    it.each([
      'author',
      'authority',
      'cacheKey',
      'keyword',
      'username',
      'email',
      'id',
      'name',
      'count',
      'monkey',
    ])('treats "%s" as non-sensitive (no over-redaction)', key => {
      expect(isSensitiveKey(key)).toBe(false);
    });
  });

  describe('redactLogInfo', () => {
    it('redacts top-level secret-bearing keys', () => {
      const info: Record<string, unknown> = {
        level: 'info',
        message: 'login',
        password: 'hunter2',
        apiKey: 'sk-123',
        username: 'commander',
      };

      redactLogInfo(info);

      expect(info.password).toBe(REDACTED);
      expect(info.apiKey).toBe(REDACTED);
      expect(info.username).toBe('commander');
    });

    it('preserves Winston structural keys even when they look word-like', () => {
      const info: Record<string, unknown> = {
        level: 'error',
        message: 'token refresh failed',
        timestamp: '2026-06-11 10:00:00',
        service: 'sc-fleet-manager',
        userId: 'user-1',
        correlationId: 'corr-1',
      };

      redactLogInfo(info);

      expect(info.message).toBe('token refresh failed');
      expect(info.level).toBe('error');
      expect(info.userId).toBe('user-1');
      expect(info.correlationId).toBe('corr-1');
    });

    it('redacts secrets nested inside plain objects', () => {
      const info: Record<string, unknown> = {
        message: 'request',
        context: {
          headers: { authorization: 'Bearer abc', accept: 'application/json' },
          user: { id: 'u1', sessionId: 'sess-xyz' },
        },
      };

      redactLogInfo(info);

      const context = info.context as Record<string, Record<string, unknown>>;
      expect(context.headers.authorization).toBe(REDACTED);
      expect(context.headers.accept).toBe('application/json');
      expect(context.user.sessionId).toBe(REDACTED);
      expect(context.user.id).toBe('u1');
    });

    it('redacts secrets inside arrays of objects', () => {
      const info: Record<string, unknown> = {
        message: 'batch',
        items: [
          { id: 1, token: 'a' },
          { id: 2, token: 'b' },
        ],
      };

      redactLogInfo(info);

      const items = info.items as Array<Record<string, unknown>>;
      expect(items[0].token).toBe(REDACTED);
      expect(items[1].token).toBe(REDACTED);
      expect(items[0].id).toBe(1);
      expect(items[1].id).toBe(2);
    });

    it('handles circular references without throwing', () => {
      const node: Record<string, unknown> = { name: 'root' };
      node.self = node;
      const info: Record<string, unknown> = { message: 'cycle', data: node };

      expect(() => redactLogInfo(info)).not.toThrow();
      const data = info.data as Record<string, unknown>;
      expect(data.name).toBe('root');
      expect(data.self).toBe('[Circular]');
    });

    it('leaves Date, Buffer, and Error instances intact (not flattened)', () => {
      const when = new Date('2020-01-01T00:00:00.000Z');
      const buf = Buffer.from('payload');
      const err = new Error('boom');
      const info: Record<string, unknown> = { when, buf, err };

      redactLogInfo(info);

      expect(info.when).toBe(when);
      expect(info.buf).toBe(buf);
      expect(info.err).toBe(err);
    });

    it('does not over-redact ordinary debug fields', () => {
      const info: Record<string, unknown> = {
        message: 'cache',
        author: 'jane',
        cacheKey: 'fleet:42',
        keyword: 'mining',
      };

      redactLogInfo(info);

      expect(info.author).toBe('jane');
      expect(info.cacheKey).toBe('fleet:42');
      expect(info.keyword).toBe('mining');
    });

    it('mutates in place and preserves Symbol-keyed Winston internals', () => {
      const messageSymbol = Symbol.for('message');
      const info: Record<string | symbol, unknown> = {
        level: 'info',
        message: 'm',
        password: 'secret',
        [messageSymbol]: 'finalized-output',
      };

      const result = redactLogInfo(info as Record<string, unknown>);

      expect(result).toBe(info);
      expect(info.password).toBe(REDACTED);
      expect(info[messageSymbol]).toBe('finalized-output');
    });

    it('does not throw on deeply nested structures', () => {
      let deep: Record<string, unknown> = { token: 'leaf' };
      for (let i = 0; i < 20; i += 1) {
        deep = { nested: deep };
      }
      const info: Record<string, unknown> = { message: 'deep', deep };

      expect(() => redactLogInfo(info)).not.toThrow();
    });
  });

  describe('redactionFormat', () => {
    it('redacts info and returns the same object reference', () => {
      const format = redactionFormat();
      const info = { level: 'info', message: 'm', token: 'abc' } as unknown as Parameters<
        typeof format.transform
      >[0];

      const out = format.transform(info);

      expect(out).toBe(info);
      expect((info as unknown as Record<string, unknown>).token).toBe(REDACTED);
    });
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
