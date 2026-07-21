import { Request, Response } from 'express';
import crypto from 'node:crypto';

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { discordWebhookVerification } from '../middleware/discordWebhookVerification';

/**
 * Generate a valid Ed25519 key pair and sign a payload for testing.
 */
function generateTestKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicKeyRaw = publicKey.export({ type: 'spki', format: 'der' });
  // Ed25519 SPKI DER is 44 bytes: 12-byte prefix + 32-byte raw key
  const publicKeyHex = publicKeyRaw.subarray(12).toString('hex');
  return { publicKeyHex, privateKey };
}

function signPayload(privateKey: crypto.KeyObject, timestamp: string, body: string): string {
  const message = Buffer.concat([Buffer.from(timestamp, 'utf-8'), Buffer.from(body, 'utf-8')]);
  const signature = crypto.sign(null, message, privateKey);
  return signature.toString('hex');
}

function createMockRequest(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: Buffer.from('{}'),
    ...overrides,
  } as unknown as Request;
}

function createMockResponse(): Response & {
  statusCode?: number;
  ended?: boolean;
  jsonBody?: unknown;
} {
  const res: Record<string, unknown> = {
    statusCode: undefined,
    ended: false,
    jsonBody: undefined,
  };
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = jest.fn((body: unknown) => {
    res.jsonBody = body;
    return res;
  });
  res.setHeader = jest.fn(() => res);
  res.end = jest.fn(() => {
    res.ended = true;
    return res;
  });
  return res as unknown as Response & { statusCode?: number; ended?: boolean; jsonBody?: unknown };
}

describe('discordWebhookVerification', () => {
  const originalEnv = process.env;
  let testKeys: ReturnType<typeof generateTestKeys>;

  beforeAll(() => {
    testKeys = generateTestKeys();
  });

  beforeEach(() => {
    process.env = { ...originalEnv, DISCORD_PUBLIC_KEY: testKeys.publicKeyHex };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 500 when DISCORD_PUBLIC_KEY is not set', () => {
    delete process.env.DISCORD_PUBLIC_KEY;
    const middleware = discordWebhookVerification();
    const req = createMockRequest();
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when signature headers are missing', () => {
    const middleware = discordWebhookVerification();
    const req = createMockRequest({ headers: {} });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid signature', () => {
    const middleware = discordWebhookVerification();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ type: 1 });

    const req = createMockRequest({
      headers: {
        'x-signature-ed25519': 'deadbeef'.repeat(16), // 64 bytes hex = 128 chars
        'x-signature-timestamp': timestamp,
      },
      body: Buffer.from(body),
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 204 for valid PING (type 0)', () => {
    const middleware = discordWebhookVerification();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ type: 0, version: 1, application_id: '123' });

    const signature = signPayload(testKeys.privateKey, timestamp, body);

    const req = createMockRequest({
      headers: {
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body: Buffer.from(body),
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() for valid event payloads (type 1)', () => {
    const middleware = discordWebhookVerification();
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      type: 1,
      version: 1,
      application_id: '123',
      event: { type: 'APPLICATION_AUTHORIZED', timestamp: new Date().toISOString() },
    });

    const signature = signPayload(testKeys.privateKey, timestamp, body);

    const req = createMockRequest({
      headers: {
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body: Buffer.from(body),
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.statusCode).toBeUndefined();
    // req.body should be parsed JSON, not Buffer
    expect(Buffer.isBuffer(req.body)).toBe(false);
    expect(req.body.type).toBe(1);
  });

  it('should return 401 for expired timestamps', () => {
    const middleware = discordWebhookVerification();
    // 10 minutes ago — beyond the 5-minute window
    const timestamp = Math.floor((Date.now() - 10 * 60 * 1000) / 1000).toString();
    const body = JSON.stringify({ type: 1, version: 1 });

    const signature = signPayload(testKeys.privateKey, timestamp, body);

    const req = createMockRequest({
      headers: {
        'x-signature-ed25519': signature,
        'x-signature-timestamp': timestamp,
      },
      body: Buffer.from(body),
    });
    const res = createMockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
