import { WizardSessionStore } from '../wizardSessionStore';

type Session = {
  lastInteraction: number;
  value: string;
};

describe('WizardSessionStore', () => {
  let nowMs = 0;

  const createStore = () =>
    new WizardSessionStore<Session>({
      ttlMs: 100,
      cleanupIntervalMs: 10,
      keyFactory: (...parts) => parts.join(':'),
      getLastInteraction: session => session.lastInteraction,
      touch: (session, now) => {
        session.lastInteraction = now;
      },
      now: () => nowMs,
    });

  it('returns an active session and touches lastInteraction on get', () => {
    const store = createStore();
    const key = store.makeKey('guild-1', 'user-1');
    const session: Session = { lastInteraction: 0, value: 'draft' };

    store.set(key, session);

    nowMs = 25;
    const active = store.get(key);

    expect(active).toBe(session);
    expect(session.lastInteraction).toBe(25);

    store.dispose();
  });

  it('expires sessions that exceed ttl', () => {
    const store = createStore();
    const key = store.makeKey('guild-1', 'user-2');

    store.set(key, { lastInteraction: 0, value: 'old' });

    nowMs = 101;
    const active = store.get(key);

    expect(active).toBeNull();
    expect(store.size()).toBe(0);

    store.dispose();
  });

afterAll(() => {
  jest.restoreAllMocks();
});
});
