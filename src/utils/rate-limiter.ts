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

    if (this.requests.length >= this.maxRequests) {
      return false;
    }

    this.requests.push(now);
    return true;
  }

  getTimeUntilReset(): number {
    if (this.requests.length === 0) {
      return 0;
    }

    const now = Date.now();
    const oldestRequest = this.requests[0];
    const timeElapsed = now - oldestRequest;
    
    return Math.max(0, this.windowMs - timeElapsed);
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

export const syncRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 60000,
});

export const apiRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 60000,
});

export const friendAddRateLimiter = new RateLimiter({
  maxRequests: 10,
  windowMs: 60000,
});
