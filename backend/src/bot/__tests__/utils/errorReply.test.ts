/**
 * Tests for the bot error reply helper.
 *
 * Verifies that ApiError subclasses, Joi validation errors, and unknown
 * errors are mapped to safe Discord-facing messages without leaking
 * internals.
 */

import Joi from 'joi';

import { MessageFlags } from 'discord.js';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils/apiErrors';
import { formatErrorForUser, replyWithError } from '../../utils/errorReply';

describe('errorReply.formatErrorForUser', () => {
  it('formats Joi validation errors with bullet list', () => {
    const schema = Joi.object({
      title: Joi.string().min(3).required(),
      reward: Joi.number().min(0),
    });
    const { error } = schema.validate({ title: 'a', reward: -5 }, { abortEarly: false });
    expect(error).toBeDefined();
    const out = formatErrorForUser(error);
    expect(out).toMatch(/Invalid input/);
    expect(out).toMatch(/title/);
    expect(out).toMatch(/reward/);
  });

  it('passes through ValidationError messages', () => {
    expect(formatErrorForUser(new ValidationError('Title is too short'))).toBe(
      '❌ Title is too short'
    );
  });

  it('uses NotFoundError message when present, otherwise default', () => {
    expect(formatErrorForUser(new NotFoundError('Bounty not found'))).toContain('Bounty not found');
  });

  it('returns generic auth message for UnauthorizedError', () => {
    const out = formatErrorForUser(new UnauthorizedError());
    expect(out).toContain('authenticate');
  });

  it('returns generic permission message for ForbiddenError', () => {
    const out = formatErrorForUser(new ForbiddenError());
    expect(out).toContain('permission');
  });

  it('formats ConflictError with warning emoji', () => {
    expect(formatErrorForUser(new ConflictError('Duplicate'))).toBe('⚠️ Duplicate');
  });

  it('returns rate-limit message for RateLimitError', () => {
    expect(formatErrorForUser(new RateLimitError())).toContain('too often');
  });

  it('hides details for unexpected errors', () => {
    const out = formatErrorForUser(new Error('postgres connection refused at 10.0.0.42:5432'));
    expect(out).not.toContain('postgres');
    expect(out).not.toContain('10.0.0');
    expect(out).toContain('unexpected');
  });

  it('hides details for non-Error throws', () => {
    expect(formatErrorForUser('boom')).toContain('unexpected');
  });
});

describe('errorReply.replyWithError', () => {
  function makeInteraction(state: { deferred?: boolean; replied?: boolean } = {}) {
    return {
      id: 'int-1',
      user: { id: 'user-1' },
      guildId: 'guild-1',
      deferred: state.deferred ?? false,
      replied: state.replied ?? false,
      reply: jest.fn().mockResolvedValue(undefined),
      editReply: jest.fn().mockResolvedValue(undefined),
    };
  }

  it('uses editReply when interaction is deferred', async () => {
    const interaction = makeInteraction({ deferred: true });
    await replyWithError(interaction as never, new NotFoundError('Mission not found'));
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: expect.stringContaining('Mission not found'),
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('uses reply when interaction has not been responded to', async () => {
    const interaction = makeInteraction();
    await replyWithError(interaction as never, new ForbiddenError());
    expect(interaction.reply).toHaveBeenCalledWith({
      content: expect.stringContaining('permission'),
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.editReply).not.toHaveBeenCalled();
  });

  it('does not throw when Discord reply fails', async () => {
    const interaction = makeInteraction({ deferred: true });
    interaction.editReply = jest.fn().mockRejectedValue(new Error('Discord API down'));
    await expect(
      replyWithError(interaction as never, new ValidationError('bad'))
    ).resolves.toBeUndefined();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
