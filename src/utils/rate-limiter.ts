/**
 * RateLimiter — enforces per-window request caps.
 *
 * The in-memory variant resets whenever the service worker is killed (every few minutes).
 * The persistent variant (PersistentRateLimiter) uses chrome.storage.session so limits
 * survive service worker restarts for the duration of the browser session.
 */

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  canProceed(): boolean {
    const now = Date.now();
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.windowMs);
    if (this.requests.length >= this.maxRequests) return false;
    this.requests.push(now);
    return true;
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) return 0;
    const now = Date.now();
    const oldestRequest = this.requests[0];
    return Math.max(0, this.windowMs - (now - oldestRequest));
  }

  getRemainingRequests(): number {
    const now = Date.now();
    this.requests = this.requests.filter((timestamp) => now - timestamp < this.windowMs);
    return Math.max(0, this.maxRequests - this.requests.length);
  }

  reset(): void {
    this.requests = [];
  }
}

/**
 * PersistentRateLimiter — same semantics as RateLimiter but survives
 * service worker restarts by storing timestamps in chrome.storage.session.
 * chrome.storage.session is cleared when the browser session ends (tab closed / browser quit).
 */
export class PersistentRateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly storageKey: string;

  constructor(options: RateLimiterOptions & { key: string }) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
    this.storageKey = `ratelimit:${options.key}`;
  }

  private async _load(): Promise<number[]> {
    try {
      const r = await chrome.storage.session.get(this.storageKey);
      const raw = r[this.storageKey];
      if (!Array.isArray(raw)) return [];
      const now = Date.now();
      return (raw as number[]).filter(ts => now - ts < this.windowMs);
    } catch {
      return [];
    }
  }

  private async _save(timestamps: number[]): Promise<void> {
    try {
      await chrome.storage.session.set({ [this.storageKey]: timestamps });
    } catch {
      // chrome.storage.session may not be available in all contexts — fail silently
    }
  }

  async canProceed(): Promise<boolean> {
    return navigator.locks.request(this.storageKey, async () => {
      const now = Date.now();
      const timestamps = await this._load();
      if (timestamps.length >= this.maxRequests) return false;
      timestamps.push(now);
      await this._save(timestamps);
      return true;
    });
  }

  async getTimeUntilReset(): Promise<number> {
    const timestamps = await this._load();
    if (timestamps.length === 0) return 0;
    return Math.max(0, this.windowMs - (Date.now() - timestamps[0]));
  }

  async getRemainingRequests(): Promise<number> {
    const timestamps = await this._load();
    return Math.max(0, this.maxRequests - timestamps.length);
  }

  async reset(): Promise<void> {
    return navigator.locks.request(this.storageKey, async () => {
      await this._save([]);
    });
  }
}

// Friend-add rate limiter: persistent across service worker restarts
export const friendAddRateLimiter = new PersistentRateLimiter({
  key: 'friend-add',
  maxRequests: 10,
  windowMs: 60_000,
});
