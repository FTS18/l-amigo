import { withRetry, isNetworkError, isRateLimitError } from '../src/utils/retry';

describe('retry utilities', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success');

      const result = await withRetry(fn, { maxRetries: 2, baseDelay: 10 });
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      const error = new Error('persistent failure');
      const fn = jest.fn().mockRejectedValue(error);

      await expect(
        withRetry(fn, { maxRetries: 2, baseDelay: 10 })
      ).rejects.toThrow('persistent failure');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should respect shouldRetry filter', async () => {
      const error = new Error('do not retry');
      const fn = jest.fn().mockRejectedValue(error);
      const shouldRetry = jest.fn().mockReturnValue(false);

      await expect(
        withRetry(fn, { maxRetries: 3, shouldRetry })
      ).rejects.toThrow('do not retry');

      expect(fn).toHaveBeenCalledTimes(1);
      expect(shouldRetry).toHaveBeenCalledWith(error);
    });
  });

  describe('isNetworkError', () => {
    it('should detect network errors', () => {
      expect(isNetworkError(new Error('fetch failed'))).toBe(true);
      expect(isNetworkError(new Error('network timeout'))).toBe(true);
      expect(isNetworkError({ name: 'NetworkError' })).toBe(true);
      expect(isNetworkError({ name: 'TypeError' })).toBe(true);
    });

    it('should return false for non-network errors', () => {
      expect(isNetworkError(new Error('validation error'))).toBe(false);
      expect(isNetworkError({ message: 'other error' })).toBe(false);
    });
  });

  describe('isRateLimitError', () => {
    it('should detect rate limit errors', () => {
      expect(isRateLimitError({ status: 429 })).toBe(true);
      expect(isRateLimitError(new Error('rate limit exceeded'))).toBe(true);
      expect(isRateLimitError(new Error('too many requests'))).toBe(true);
    });

    it('should return false for non-rate-limit errors', () => {
      expect(isRateLimitError({ status: 500 })).toBe(false);
      expect(isRateLimitError(new Error('server error'))).toBe(false);
    });
  });
});
