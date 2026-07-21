import { MessageFlags } from 'discord.js';

import { deferInteraction, type DeferrableInteraction } from '../deferInteraction';

type MockInteraction = {
  replied: boolean;
  deferred: boolean;
  deferReply: jest.Mock;
  deferUpdate?: jest.Mock;
};

function createInteraction(overrides: Partial<MockInteraction> = {}): MockInteraction {
  return {
    replied: false,
    deferred: false,
    deferReply: jest.fn().mockResolvedValue(undefined),
    deferUpdate: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('deferInteraction', () => {
  it('defers publicly by default', async () => {
    const interaction = createInteraction();

    const result = await deferInteraction(interaction as unknown as DeferrableInteraction);

    expect(result).toBe(true);
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).toHaveBeenCalledWith();
  });

  it('defers ephemerally when mode is "ephemeral"', async () => {
    const interaction = createInteraction();

    const result = await deferInteraction(
      interaction as unknown as DeferrableInteraction,
      'ephemeral'
    );

    expect(result).toBe(true);
    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: MessageFlags.Ephemeral });
  });

  it('uses deferUpdate when mode is "update" and the interaction supports it', async () => {
    const interaction = createInteraction();

    const result = await deferInteraction(
      interaction as unknown as DeferrableInteraction,
      'update'
    );

    expect(result).toBe(true);
    expect(interaction.deferUpdate).toHaveBeenCalledTimes(1);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('falls back to deferReply for "update" when deferUpdate is unavailable', async () => {
    // e.g. a ChatInputCommandInteraction has no deferUpdate
    const interaction = createInteraction({ deferUpdate: undefined });

    const result = await deferInteraction(
      interaction as unknown as DeferrableInteraction,
      'update'
    );

    expect(result).toBe(true);
    expect(interaction.deferReply).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when the interaction is already deferred', async () => {
    const interaction = createInteraction({ deferred: true });

    const result = await deferInteraction(interaction as unknown as DeferrableInteraction);

    expect(result).toBe(false);
    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.deferUpdate).not.toHaveBeenCalled();
  });

  it('is a no-op when the interaction is already replied', async () => {
    const interaction = createInteraction({ replied: true });

    const result = await deferInteraction(
      interaction as unknown as DeferrableInteraction,
      'ephemeral'
    );

    expect(result).toBe(false);
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('propagates errors from the Discord client', async () => {
    const boom = new Error('Unknown interaction');
    const interaction = createInteraction({
      deferReply: jest.fn().mockRejectedValue(boom),
    });

    await expect(deferInteraction(interaction as unknown as DeferrableInteraction)).rejects.toBe(
      boom
    );
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
