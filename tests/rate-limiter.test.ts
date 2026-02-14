import { RateLimiter } from '../src/utils/rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('canProceed', () => {
    it('should allow requests within limit', () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
    });

    it('should block requests exceeding limit', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(false);
    });

    it('should reset after time window', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(true);
      expect(limiter.canProceed()).toBe(false);

      jest.advanceTimersByTime(1001);

      expect(limiter.canProceed()).toBe(true);
    });
  });

  describe('getTimeUntilReset', () => {
    it('should return 0 when no requests made', () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });
      expect(limiter.getTimeUntilReset()).toBe(0);
    });

    it('should return remaining time', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      limiter.canProceed();
      jest.advanceTimersByTime(300);

      const remaining = limiter.getTimeUntilReset();
      expect(remaining).toBeGreaterThan(600);
      expect(remaining).toBeLessThanOrEqual(700);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return max requests initially', () => {
      const limiter = new RateLimiter({ maxRequests: 5, windowMs: 1000 });
      expect(limiter.getRemainingRequests()).toBe(5);
    });

    it('should decrease with each request', () => {
      const limiter = new RateLimiter({ maxRequests: 3, windowMs: 1000 });

      limiter.canProceed();
      expect(limiter.getRemainingRequests()).toBe(2);

      limiter.canProceed();
      expect(limiter.getRemainingRequests()).toBe(1);
    });

    it('should not go below 0', () => {
      const limiter = new RateLimiter({ maxRequests: 1, windowMs: 1000 });

      limiter.canProceed();
      expect(limiter.getRemainingRequests()).toBe(0);

      limiter.canProceed();
      expect(limiter.getRemainingRequests()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all requests', () => {
      const limiter = new RateLimiter({ maxRequests: 2, windowMs: 1000 });

      limiter.canProceed();
      limiter.canProceed();
      expect(limiter.canProceed()).toBe(false);

      limiter.reset();
      expect(limiter.canProceed()).toBe(true);
    });
  });
});
