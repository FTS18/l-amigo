export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  shouldRetry: () => true,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 0; attempt < opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (!opts.shouldRetry(error)) {
        throw error;
      }

      if (attempt === opts.maxRetries - 1) {
        throw error;
      }

      const delay = Math.min(
        opts.baseDelay * Math.pow(2, attempt),
        opts.maxDelay
      );

      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export function isNetworkError(error: any): boolean {
  return !!(
    error?.message?.includes('fetch') ||
    error?.message?.includes('network') ||
    error?.message?.includes('timeout') ||
    error?.name === 'NetworkError' ||
    error?.name === 'TypeError'
  );
}

export function isRateLimitError(error: any): boolean {
  return !!(
    error?.status === 429 ||
    error?.message?.includes('rate limit') ||
    error?.message?.includes('too many requests')
  );
}
