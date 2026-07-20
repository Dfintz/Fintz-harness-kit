"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WizardSessionStore = void 0;
class WizardSessionStore {
    options;
    sessions = new Map();
    cleanupHandle;
    constructor(options) {
        this.options = options;
        this.cleanupHandle = setInterval(() => {
            this.cleanupExpired(this.currentTime());
        }, options.cleanupIntervalMs);
        if (typeof this.cleanupHandle.unref === 'function') {
            this.cleanupHandle.unref();
        }
    }
    makeKey(...parts) {
        return this.options.keyFactory(...parts);
    }
    set(key, session) {
        this.sessions.set(key, session);
    }
    get(key) {
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
    delete(key) {
        return this.sessions.delete(key);
    }
    size() {
        return this.sessions.size;
    }
    dispose() {
        clearInterval(this.cleanupHandle);
    }
    currentTime() {
        return this.options.now ? this.options.now() : Date.now();
    }
    cleanupExpired(now) {
        for (const [key, session] of this.sessions) {
            if (now - this.options.getLastInteraction(session) > this.options.ttlMs) {
                this.sessions.delete(key);
            }
        }
    }
}
exports.WizardSessionStore = WizardSessionStore;
//# sourceMappingURL=wizardSessionStore.js.map