import { CircuitBreaker } from '../src/utils/circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('execute', () => {
    it('should execute function when circuit is closed', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const fn = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should transition to OPEN after threshold failures', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      for (let i = 0; i < 3; i++) {
        await expect(breaker.execute(fn)).rejects.toThrow('fail');
      }

      expect(breaker.getState()).toBe('OPEN');

      await expect(breaker.execute(fn)).rejects.toThrow(
        'Circuit breaker is OPEN - service unavailable'
      );
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 5000,
      });
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow('fail');
      await expect(breaker.execute(fn)).rejects.toThrow('fail');

      expect(breaker.getState()).toBe('OPEN');

      jest.advanceTimersByTime(5001);

      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe('HALF_OPEN');
    });

    it('should transition to CLOSED after successful attempts in HALF_OPEN', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 5000,
      });
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      expect(breaker.getState()).toBe('OPEN');

      jest.advanceTimersByTime(5001);

      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);
      await breaker.execute(successFn);

      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should reset failure count on success in CLOSED state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const failFn = jest.fn().mockRejectedValue(new Error('fail'));
      const successFn = jest.fn().mockResolvedValue('success');

      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      await breaker.execute(successFn);

      await expect(breaker.execute(failFn)).rejects.toThrow();
      await expect(breaker.execute(failFn)).rejects.toThrow();

      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('reset', () => {
    it('should reset circuit to CLOSED state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });
      const fn = jest.fn().mockRejectedValue(new Error('fail'));

      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(breaker.getState()).toBe('OPEN');

      breaker.reset();

      expect(breaker.getState()).toBe('CLOSED');

      const successFn = jest.fn().mockResolvedValue('success');
      await breaker.execute(successFn);
    });
  });

  describe('getState', () => {
    it('should return current state', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2 });

      expect(breaker.getState()).toBe('CLOSED');

      const fn = jest.fn().mockRejectedValue(new Error('fail'));
      await expect(breaker.execute(fn)).rejects.toThrow();
      await expect(breaker.execute(fn)).rejects.toThrow();

      expect(breaker.getState()).toBe('OPEN');
    });
  });
});
