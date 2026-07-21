export interface WizardSessionStoreOptions<TSession> {
  ttlMs: number;
  cleanupIntervalMs: number;
  keyFactory: (...parts: string[]) => string;
  getLastInteraction: (session: TSession) => number;
  touch: (session: TSession, now: number) => void;
  now?: () => number;
}

export class WizardSessionStore<TSession> {
  private readonly sessions = new Map<string, TSession>();
  private readonly cleanupHandle: ReturnType<typeof setInterval>;

  constructor(private readonly options: WizardSessionStoreOptions<TSession>) {
    this.cleanupHandle = setInterval(() => {
      this.cleanupExpired(this.currentTime());
    }, options.cleanupIntervalMs);

    if (typeof this.cleanupHandle.unref === 'function') {
      this.cleanupHandle.unref();
    }
  }

  makeKey(...parts: string[]): string {
    return this.options.keyFactory(...parts);
  }

  set(key: string, session: TSession): void {
    this.sessions.set(key, session);
  }

  get(key: string): TSession | null {
    const session = this.sessions.get(key);
    if (!session) {
      return null;
    }

    const now = this.currentTime();
    if (now - this.options.getLastInteraction(session) > this.options.ttlMs) {
      this.sessions.delete(key);
      return null;
    }

    this.options.touch(session, now);
    return session;
  }

  delete(key: string): boolean {
    return this.sessions.delete(key);
  }

  size(): number {
    return this.sessions.size;
  }

  dispose(): void {
    clearInterval(this.cleanupHandle);
  }

  private currentTime(): number {
    return this.options.now ? this.options.now() : Date.now();
  }

  private cleanupExpired(now: number): void {
    for (const [key, session] of this.sessions) {
      if (now - this.options.getLastInteraction(session) > this.options.ttlMs) {
        this.sessions.delete(key);
      }
    }
  }
}
